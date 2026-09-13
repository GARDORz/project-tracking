import path from 'node:path'
import { z } from 'zod'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { ZipArchive } from 'archiver'
import { recordAudit } from '../services/auditLog.js'
import {
  deleteAttachmentFile,
  readAttachmentFile,
  saveAttachmentFile,
} from '../services/attachmentStorage.js'
import { canManageJob } from './serviceJobs.js'

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

const jobNoParamsSchema = z.object({ jobNo: z.string().min(1) })
const attachmentParamsSchema = z.object({
  jobNo: z.string().min(1),
  attachmentId: z.string().min(1),
})
const downloadQuerySchema = z.object({ ids: z.string().optional() })

// Split out of serviceJobs.ts — this is ServiceJob's file-attachment sub-resource
// (upload/download/delete), kept separate so the core job CRUD file stays a
// manageable size. Registered under the same '/api' prefix as serviceJobs.ts.
// Bodies here are multipart file uploads (handled by @fastify/multipart), not
// JSON — so only params/querystring get a Zod schema, never `body`.
const jobAttachmentRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  // A job can have multiple attachments. Upload accepts several files in one
  // multipart request; every file is validated before any of them is written
  // to disk, so a bad file in the batch doesn't leave orphaned partial uploads.
  fastify.post(
    '/service-jobs/:jobNo/attachments',
    { schema: { params: jobNoParamsSchema } },
    async (request, reply) => {
      const existing = await fastify.prisma.serviceJob.findUnique({
        where: { jobNo: request.params.jobNo },
        include: { assignees: { select: { userId: true } } },
      })
      if (!existing) {
        return reply.code(404).send({ error: 'Service job not found' })
      }
      if (!canManageJob(request.user.role, request.user.sub, existing)) {
        return reply.code(403).send({
          error:
            'คุณไม่มีสิทธิ์แนบไฟล์ในงานนี้ (ต้องเป็นผู้แจ้ง ผู้รับผิดชอบ หรือแอดมิน)',
        })
      }

      const parts: { filename: string; mimetype: string; buffer: Buffer }[] = []
      try {
        for await (const part of request.files()) {
          parts.push({
            filename: part.filename,
            mimetype: part.mimetype,
            buffer: await part.toBuffer(),
          })
        }
      } catch {
        return reply.code(400).send({
          error:
            'อัปโหลดไม่สำเร็จ (ไฟล์อาจมีขนาดใหญ่เกินไป จำกัด 100MB ต่อไฟล์)',
        })
      }
      if (parts.length === 0) {
        return reply.code(400).send({ error: 'กรุณาแนบไฟล์อย่างน้อย 1 ไฟล์' })
      }
      const invalid = parts.find(
        (part) => !ALLOWED_ATTACHMENT_MIME_TYPES.has(part.mimetype),
      )
      if (invalid) {
        return reply.code(400).send({
          error: `รองรับเฉพาะไฟล์รูปภาพ, PDF และ Word เท่านั้น (${invalid.filename})`,
        })
      }

      const created = []
      for (const part of parts) {
        const storedName = await saveAttachmentFile(part.filename, part.buffer)
        created.push(
          await fastify.prisma.attachment.create({
            data: {
              jobNo: request.params.jobNo,
              fileName: part.filename,
              storedName,
              mimeType: part.mimetype,
              size: part.buffer.length,
            },
          }),
        )
      }

      await recordAudit(fastify, {
        actorId: request.user.sub,
        action: 'attachment.upload',
        entityType: 'ServiceJob',
        entityId: request.params.jobNo,
        message: `แนบไฟล์ในใบงาน ${request.params.jobNo} (หัวข้อ: ${existing.title}) จำนวน ${created.length} ไฟล์: ${created.map((a) => a.fileName).join(', ')}`,
      })

      return reply.code(201).send(
        created.map((attachment) => ({
          id: attachment.id,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          size: attachment.size,
          uploadedAt: attachment.uploadedAt,
        })),
      )
    },
  )

  // Downloads either a single file directly, or zips multiple into one archive —
  // `ids` (comma-separated) picks specific attachments; omitted/empty means "all".
  // Open to any authenticated user, same as before (view/download isn't gated by
  // canManageJob — only uploading and deleting are).
  fastify.get(
    '/service-jobs/:jobNo/attachments/download',
    { schema: { params: jobNoParamsSchema, querystring: downloadQuerySchema } },
    async (request, reply) => {
      const job = await fastify.prisma.serviceJob.findUnique({
        where: { jobNo: request.params.jobNo },
        include: { attachments: true },
      })
      if (!job) {
        return reply.code(404).send({ error: 'Service job not found' })
      }

      const requestedIds = request.query.ids?.split(',').filter(Boolean)
      const targets = requestedIds
        ? job.attachments.filter((a) => requestedIds.includes(a.id))
        : job.attachments
      if (targets.length === 0) {
        return reply.code(404).send({ error: 'ไม่พบไฟล์แนบที่เลือก' })
      }

      // Deliberately not audit-logged — downloading/viewing a file happens far
      // too often in normal use (unlike upload/delete) and would flood the
      // audit log with low-signal rows.
      if (targets.length === 1) {
        const [only] = targets
        const buffer = await readAttachmentFile(only.storedName)
        reply.header('Content-Type', only.mimeType)
        reply.header(
          'Content-Disposition',
          `attachment; filename="${encodeURIComponent(only.fileName)}"`,
        )
        return reply.send(buffer)
      }

      reply.header('Content-Type', 'application/zip')
      reply.header(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(request.params.jobNo)}-attachments.zip"`,
      )
      const archive = new ZipArchive()
      // Guard against two attachments sharing a filename colliding inside the zip.
      const usedNames = new Set<string>()
      for (const target of targets) {
        const buffer = await readAttachmentFile(target.storedName)
        let name = target.fileName
        if (usedNames.has(name)) {
          const ext = path.extname(name)
          name = `${path.basename(name, ext)}-${target.id.slice(0, 8)}${ext}`
        }
        usedNames.add(name)
        archive.append(buffer, { name })
      }
      archive.finalize()
      return reply.send(archive)
    },
  )

  fastify.delete(
    '/service-jobs/:jobNo/attachments/:attachmentId',
    { schema: { params: attachmentParamsSchema } },
    async (request, reply) => {
      const existing = await fastify.prisma.serviceJob.findUnique({
        where: { jobNo: request.params.jobNo },
        include: { assignees: { select: { userId: true } } },
      })
      if (!existing) {
        return reply.code(404).send({ error: 'Service job not found' })
      }
      if (!canManageJob(request.user.role, request.user.sub, existing)) {
        return reply.code(403).send({
          error:
            'คุณไม่มีสิทธิ์ลบไฟล์แนบในงานนี้ (ต้องเป็นผู้แจ้ง ผู้รับผิดชอบ หรือแอดมิน)',
        })
      }

      const attachment = await fastify.prisma.attachment.findUnique({
        where: { id: request.params.attachmentId },
      })
      if (!attachment || attachment.jobNo !== request.params.jobNo) {
        return reply.code(404).send({ error: 'ไม่พบไฟล์แนบ' })
      }

      await fastify.prisma.attachment.delete({ where: { id: attachment.id } })
      await deleteAttachmentFile(attachment.storedName)

      await recordAudit(fastify, {
        actorId: request.user.sub,
        action: 'attachment.delete',
        entityType: 'ServiceJob',
        entityId: request.params.jobNo,
        message: `ลบไฟล์แนบ "${attachment.fileName}" จากใบงาน ${request.params.jobNo} (หัวข้อ: ${existing.title})`,
      })

      return reply.code(204).send()
    },
  )
}

export default jobAttachmentRoutes
