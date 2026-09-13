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

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

const projectIdParamsSchema = z.object({ projectId: z.string().min(1) })
const attachmentParamsSchema = z.object({
  projectId: z.string().min(1),
  attachmentId: z.string().min(1),
})
const downloadQuerySchema = z.object({ ids: z.string().optional() })

// Project attachments have no extra role/ownership gate beyond being logged
// in — project management itself (create/edit/delete) has no role
// restriction anymore (see customers.ts), so attachments follow the same rule.
// Bodies here are multipart file uploads (handled by @fastify/multipart), not
// JSON — so only params/querystring get a Zod schema, never `body`.
const projectAttachmentRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  // A project can have multiple attachments, same upload flow as ServiceJob's:
  // every file is validated before any of them is written to disk.
  fastify.post(
    '/projects/:projectId/attachments',
    { schema: { params: projectIdParamsSchema } },
    async (request, reply) => {
      const project = await fastify.prisma.project.findUnique({
        where: { id: request.params.projectId },
      })
      if (!project) {
        return reply.code(404).send({ error: 'Project not found' })
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
          await fastify.prisma.projectAttachment.create({
            data: {
              projectId: request.params.projectId,
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
        action: 'project_attachment.upload',
        entityType: 'Project',
        entityId: project.id,
        message: `แนบไฟล์ในโปรเจค ${project.name} จำนวน ${created.length} ไฟล์: ${created.map((a) => a.fileName).join(', ')}`,
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

  // Same single-file-vs-zip resolution as ServiceJob attachments — open to any
  // authenticated user, no additional gate.
  fastify.get(
    '/projects/:projectId/attachments/download',
    {
      schema: {
        params: projectIdParamsSchema,
        querystring: downloadQuerySchema,
      },
    },
    async (request, reply) => {
      const project = await fastify.prisma.project.findUnique({
        where: { id: request.params.projectId },
        include: { attachments: true },
      })
      if (!project) {
        return reply.code(404).send({ error: 'Project not found' })
      }

      const requestedIds = request.query.ids?.split(',').filter(Boolean)
      const targets = requestedIds
        ? project.attachments.filter((a) => requestedIds.includes(a.id))
        : project.attachments
      if (targets.length === 0) {
        return reply.code(404).send({ error: 'ไม่พบไฟล์แนบที่เลือก' })
      }

      // Deliberately not audit-logged — same reasoning as ServiceJob attachment
      // downloads (see serviceJobs.ts): too frequent in normal use to be a
      // meaningful audit signal.
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
        `attachment; filename="${encodeURIComponent(project.name)}-attachments.zip"`,
      )
      const archive = new ZipArchive()
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
    '/projects/:projectId/attachments/:attachmentId',
    { schema: { params: attachmentParamsSchema } },
    async (request, reply) => {
      const attachment = await fastify.prisma.projectAttachment.findUnique({
        where: { id: request.params.attachmentId },
      })
      if (!attachment || attachment.projectId !== request.params.projectId) {
        return reply.code(404).send({ error: 'ไม่พบไฟล์แนบ' })
      }

      await fastify.prisma.projectAttachment.delete({
        where: { id: attachment.id },
      })
      await deleteAttachmentFile(attachment.storedName)

      const project = await fastify.prisma.project.findUnique({
        where: { id: attachment.projectId },
        select: { name: true },
      })
      await recordAudit(fastify, {
        actorId: request.user.sub,
        action: 'project_attachment.delete',
        entityType: 'Project',
        entityId: attachment.projectId,
        message: `ลบไฟล์แนบ "${attachment.fileName}" จากโปรเจค ${project?.name ?? attachment.projectId}`,
      })

      return reply.code(204).send()
    },
  )
}

export default projectAttachmentRoutes
