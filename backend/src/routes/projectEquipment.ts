import { z } from 'zod'
import type { FastifyInstance, FastifyReply } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import ExcelJS from 'exceljs'
import { recordAudit } from '../services/auditLog.js'

export const equipmentBodySchema = z.object({
  brand: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  serialNo: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
})
export type EquipmentBody = z.infer<typeof equipmentBodySchema>

export const projectIdParamsSchema = z.object({ projectId: z.string().min(1) })
export const equipmentParamsSchema = z.object({
  projectId: z.string().min(1),
  equipmentId: z.string().min(1),
})

type EquipmentField = 'brand' | 'model' | 'serialNo' | 'description'

// Header text (lowercased, stripped of anything but a-z0-9) -> our field.
export const HEADER_ALIASES: Record<string, EquipmentField> = {
  brand: 'brand',
  maker: 'brand',
  manufacturer: 'brand',
  model: 'model',
  modelno: 'model',
  serialno: 'serialNo',
  serial: 'serialNo',
  serialnumber: 'serialNo',
  sn: 'serialNo',
  sno: 'serialNo',
  description: 'description',
  desc: 'description',
  detail: 'description',
  details: 'description',
  note: 'description',
  notes: 'description',
  remark: 'description',
  remarks: 'description',
}

export function normalizeHeader(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function cellText(cell: ExcelJS.Cell | undefined): string {
  if (!cell) return ''
  const value = cell.value
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    // Rich text, hyperlink, formula result, date, etc. — `cell.text` renders it.
    return String(cell.text ?? '').trim()
  }
  return String(value).trim()
}

const EQUIPMENT_SELECT = {
  id: true,
  brand: true,
  model: true,
  serialNo: true,
  description: true,
  createdAt: true,
} as const

// A short human-readable label for one equipment/fault row, used in audit-log
// messages — e.g. "Dell R740 (SN: ABC123)".
export function describeEquipment(item: {
  brand: string | null
  model: string | null
  serialNo: string | null
}): string {
  const label = [item.brand, item.model].filter(Boolean).join(' ')
  return item.serialNo
    ? `${label || 'ไม่ระบุยี่ห้อ/รุ่น'} (SN: ${item.serialNo})`
    : label || 'ไม่ระบุยี่ห้อ/รุ่น'
}

// Shared with projectEquipmentFaults.ts — both files register routes under
// '/projects/:projectId/equipment...' and need the same "does this project
// exist" guard / display-name lookup.
export async function requireProject(
  fastify: FastifyInstance,
  projectId: string,
  reply: FastifyReply,
) {
  const project = await fastify.prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, projectYear: true },
  })
  if (!project) {
    reply.code(404).send({ error: 'Project not found' })
    return null
  }
  return project
}

// Used where a row's project isn't already in scope (e.g. after looking up
// the equipment/fault row directly by id) — just for a readable audit message.
export async function projectNameById(
  fastify: FastifyInstance,
  projectId: string,
): Promise<string> {
  const project = await fastify.prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  })
  return project?.name ?? projectId
}

// Equipment has no extra role gate beyond being logged in — same as project
// attachments / SLAs (project management itself has no role restriction).
const projectEquipmentRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get(
    '/projects/:projectId/equipment',
    { schema: { params: projectIdParamsSchema } },
    async (request, reply) => {
      const project = await requireProject(
        fastify,
        request.params.projectId,
        reply,
      )
      if (!project) return

      const [equipment, faultCount] = await Promise.all([
        fastify.prisma.projectEquipment.findMany({
          where: { projectId: project.id },
          select: EQUIPMENT_SELECT,
          orderBy: { createdAt: 'asc' },
        }),
        fastify.prisma.projectEquipmentFault.count({
          where: { projectId: project.id },
        }),
      ])
      return { project, equipment, faultCount }
    },
  )

  // The faulty-equipment log (GET/POST/DELETE .../equipment/faults and
  // POST .../equipment/:id/fault) lives in projectEquipmentFaults.ts,
  // registered separately in app.ts under the same prefix.

  // Bulk import from an .xlsx file — replaces the project's whole equipment
  // list. Multipart body (handled by @fastify/multipart), so only params get
  // a Zod schema here.
  fastify.post(
    '/projects/:projectId/equipment/import',
    { schema: { params: projectIdParamsSchema } },
    async (request, reply) => {
      const project = await requireProject(
        fastify,
        request.params.projectId,
        reply,
      )
      if (!project) return

      let buffer: Buffer
      let filename: string
      try {
        const file = await request.file()
        if (!file) {
          return reply.code(400).send({ error: 'กรุณาแนบไฟล์ Excel' })
        }
        if (!/\.xlsx$/i.test(file.filename)) {
          return reply
            .code(400)
            .send({ error: 'รองรับเฉพาะไฟล์ Excel (.xlsx) เท่านั้น' })
        }
        filename = file.filename
        buffer = Buffer.from(await file.toBuffer())
      } catch {
        return reply.code(400).send({
          error: 'อัปโหลดไม่สำเร็จ (ไฟล์อาจมีขนาดใหญ่เกินไป จำกัด 100MB)',
        })
      }

      const workbook = new ExcelJS.Workbook()
      try {
        // @ts-expect-error exceljs's load() Buffer param disagrees with the
        // installed @types/node Buffer type; the value is a real Buffer that
        // load() reads fine at runtime.
        await workbook.xlsx.load(buffer)
      } catch {
        return reply
          .code(400)
          .send({ error: 'อ่านไฟล์ Excel ไม่ได้ — ไฟล์อาจเสียหาย' })
      }
      const sheet = workbook.worksheets[0]
      if (!sheet || sheet.rowCount < 1) {
        return reply.code(400).send({ error: 'ไฟล์ Excel ว่างเปล่า' })
      }

      // Map each column index -> field, from the first row's headers.
      const columnMap = new Map<number, EquipmentField>()
      sheet.getRow(1).eachCell((cell, colNumber) => {
        const field = HEADER_ALIASES[normalizeHeader(cellText(cell))]
        if (field && ![...columnMap.values()].includes(field)) {
          columnMap.set(colNumber, field)
        }
      })
      if (columnMap.size === 0) {
        return reply.code(400).send({
          error:
            'ไม่พบหัวคอลัมน์ที่รู้จักในแถวแรก (ต้องมีอย่างน้อยหนึ่งใน Brand, Model, Serial No., Description)',
        })
      }

      const rows: EquipmentBody[] = []
      let skipped = 0
      for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
        const row = sheet.getRow(rowNumber)
        const record: EquipmentBody = {}
        for (const [colNumber, field] of columnMap) {
          const value = cellText(row.getCell(colNumber))
          record[field] = value || null
        }
        const allBlank = (
          ['brand', 'model', 'serialNo', 'description'] as const
        ).every((f) => !record[f])
        if (allBlank) {
          skipped++
          continue
        }
        rows.push(record)
      }

      // Replace the whole list atomically, then read it back.
      await fastify.prisma.$transaction([
        fastify.prisma.projectEquipment.deleteMany({
          where: { projectId: project.id },
        }),
        ...(rows.length > 0
          ? [
              fastify.prisma.projectEquipment.createMany({
                data: rows.map((r) => ({ projectId: project.id, ...r })),
              }),
            ]
          : []),
      ])
      const equipment = await fastify.prisma.projectEquipment.findMany({
        where: { projectId: project.id },
        select: EQUIPMENT_SELECT,
        orderBy: { createdAt: 'asc' },
      })

      await recordAudit(fastify, {
        actorId: request.user.sub,
        action: 'equipment.import',
        entityType: 'Project',
        entityId: project.id,
        message: `นำเข้าอุปกรณ์จากไฟล์ Excel "${filename}" ในโปรเจค ${project.name} — แทนที่รายการเดิม, นำเข้า ${rows.length} รายการ (ข้าม ${skipped} แถวว่าง)`,
      })

      return { imported: rows.length, skipped, equipment }
    },
  )

  // A blank template with just the header row, so users know the expected format.
  fastify.get(
    '/projects/:projectId/equipment/template',
    { schema: { params: projectIdParamsSchema } },
    async (request, reply) => {
      const project = await requireProject(
        fastify,
        request.params.projectId,
        reply,
      )
      if (!project) return

      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('อุปกรณ์')
      sheet.columns = [
        { header: 'Brand', key: 'brand', width: 24 },
        { header: 'Model', key: 'model', width: 24 },
        { header: 'Serial No.', key: 'serialNo', width: 24 },
        { header: 'Description', key: 'description', width: 40 },
      ]
      sheet.getRow(1).font = { bold: true }

      const out = await workbook.xlsx.writeBuffer()
      reply.header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      reply.header(
        'Content-Disposition',
        'attachment; filename="equipment-template.xlsx"',
      )
      return reply.send(out)
    },
  )

  // Add one row by hand.
  fastify.post(
    '/projects/:projectId/equipment',
    { schema: { params: projectIdParamsSchema, body: equipmentBodySchema } },
    async (request, reply) => {
      const project = await requireProject(
        fastify,
        request.params.projectId,
        reply,
      )
      if (!project) return

      const { brand, model, serialNo, description } = request.body
      if (!brand && !model && !serialNo && !description) {
        return reply
          .code(400)
          .send({ error: 'กรุณากรอกข้อมูลอย่างน้อยหนึ่งช่อง' })
      }

      const created = await fastify.prisma.projectEquipment.create({
        data: {
          projectId: project.id,
          brand: brand?.trim() || null,
          model: model?.trim() || null,
          serialNo: serialNo?.trim() || null,
          description: description?.trim() || null,
        },
        select: EQUIPMENT_SELECT,
      })

      await recordAudit(fastify, {
        actorId: request.user.sub,
        action: 'equipment.create',
        entityType: 'Project',
        entityId: project.id,
        message: `เพิ่มอุปกรณ์ในโปรเจค ${project.name}: ${describeEquipment(created)}`,
      })

      return reply.code(201).send(created)
    },
  )

  // Edit one row in place — only the fields present in the body are touched, so
  // the equipment table can offer inline editing of a single cell.
  fastify.patch(
    '/projects/:projectId/equipment/:equipmentId',
    { schema: { params: equipmentParamsSchema, body: equipmentBodySchema } },
    async (request, reply) => {
      const existing = await fastify.prisma.projectEquipment.findUnique({
        where: { id: request.params.equipmentId },
      })
      if (!existing || existing.projectId !== request.params.projectId) {
        return reply.code(404).send({ error: 'ไม่พบอุปกรณ์' })
      }

      const body = request.body
      const data: Partial<Record<EquipmentField, string | null>> = {}
      for (const field of [
        'brand',
        'model',
        'serialNo',
        'description',
      ] as const) {
        if (body[field] !== undefined) {
          data[field] = body[field]?.trim() || null
        }
      }

      const updated = await fastify.prisma.projectEquipment.update({
        where: { id: existing.id },
        data,
        select: EQUIPMENT_SELECT,
      })

      const fieldLabels: Record<EquipmentField, string> = {
        brand: 'Brand',
        model: 'Model',
        serialNo: 'Serial No.',
        description: 'Description',
      }
      const changes = (Object.keys(data) as EquipmentField[])
        .filter((field) => existing[field] !== updated[field])
        .map(
          (field) =>
            `${fieldLabels[field]}: "${existing[field] ?? ''}" → "${updated[field] ?? ''}"`,
        )

      await recordAudit(fastify, {
        actorId: request.user.sub,
        action: 'equipment.update',
        entityType: 'Project',
        entityId: existing.projectId,
        message: `แก้ไขอุปกรณ์ในโปรเจค ${await projectNameById(fastify, existing.projectId)} (${describeEquipment(existing)})${changes.length > 0 ? ' — ' + changes.join(', ') : ''}`,
      })

      return updated
    },
  )

  fastify.delete(
    '/projects/:projectId/equipment/:equipmentId',
    { schema: { params: equipmentParamsSchema } },
    async (request, reply) => {
      const existing = await fastify.prisma.projectEquipment.findUnique({
        where: { id: request.params.equipmentId },
      })
      if (!existing || existing.projectId !== request.params.projectId) {
        return reply.code(404).send({ error: 'ไม่พบอุปกรณ์' })
      }
      await fastify.prisma.projectEquipment.delete({
        where: { id: existing.id },
      })

      await recordAudit(fastify, {
        actorId: request.user.sub,
        action: 'equipment.delete',
        entityType: 'Project',
        entityId: existing.projectId,
        message: `ลบอุปกรณ์ในโปรเจค ${await projectNameById(fastify, existing.projectId)}: ${describeEquipment(existing)}`,
      })

      return reply.code(204).send()
    },
  )

  fastify.delete(
    '/projects/:projectId/equipment',
    { schema: { params: projectIdParamsSchema } },
    async (request, reply) => {
      const project = await requireProject(
        fastify,
        request.params.projectId,
        reply,
      )
      if (!project) return
      const { count } = await fastify.prisma.projectEquipment.deleteMany({
        where: { projectId: project.id },
      })

      if (count > 0) {
        await recordAudit(fastify, {
          actorId: request.user.sub,
          action: 'equipment.delete_all',
          entityType: 'Project',
          entityId: project.id,
          message: `ลบอุปกรณ์ทั้งหมดในโปรเจค ${project.name} จำนวน ${count} รายการ`,
        })
      }

      return reply.code(204).send()
    },
  )
}

export default projectEquipmentRoutes
