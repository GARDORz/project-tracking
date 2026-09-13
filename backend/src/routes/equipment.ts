import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import ExcelJS from 'exceljs'

// Cross-project equipment browser (read-only). Row edits / deletes / fault
// flagging all still happen on the per-project page (backend/src/routes/
// projectEquipment.ts) — this route only lists and exports.

const exportQuerySchema = z.object({
  scope: z.string().optional(),
  search: z.string().optional(),
  customerId: z.string().optional(),
  projectId: z.string().optional(),
})
type ListQuery = z.infer<typeof exportQuerySchema>

const projectRef = {
  select: {
    id: true,
    name: true,
    projectYear: true,
    customer: { select: { id: true, name: true } },
  },
} as const

const activeSelect = {
  id: true,
  brand: true,
  model: true,
  serialNo: true,
  description: true,
  createdAt: true,
  projectId: true,
  project: projectRef,
} as const

const faultSelect = {
  id: true,
  brand: true,
  model: true,
  serialNo: true,
  description: true,
  reportedAt: true,
  projectId: true,
  project: projectRef,
} as const

function buildWhere(query: ListQuery) {
  const where: Record<string, unknown> = {}
  if (query.projectId) where.projectId = query.projectId
  if (query.customerId) where.project = { customerId: query.customerId }

  const search = query.search?.trim()
  if (search) {
    where.OR = (['brand', 'model', 'serialNo', 'description'] as const).map(
      (field) => ({ [field]: { contains: search, mode: 'insensitive' } }),
    )
  }
  return where
}

async function computeSummary(fastify: FastifyInstance) {
  const [totalEquipment, totalFaults, projectsWithEquipment] =
    await Promise.all([
      fastify.prisma.projectEquipment.count(),
      fastify.prisma.projectEquipmentFault.count(),
      fastify.prisma.project.findMany({
        where: { equipment: { some: {} } },
        select: { id: true, customerId: true },
      }),
    ])
  return {
    totalEquipment,
    totalFaults,
    projectsWithEquipment: projectsWithEquipment.length,
    customersWithEquipment: new Set(
      projectsWithEquipment.map((p) => p.customerId),
    ).size,
  }
}

// --- Excel styling — matches the look of the reports / overview exports ---

const BRAND_GREEN = 'FF1A5F3F'
const HEADER_FONT_COLOR = 'FFFFFFFF'
const STRIPE_COLOR = 'FFF3F4F6'
const BORDER_COLOR = 'FFE5E7EB'
const thinBorder = { style: 'thin' as const, color: { argb: BORDER_COLOR } }
const allBorders = {
  top: thinBorder,
  left: thinBorder,
  bottom: thinBorder,
  right: thinBorder,
}

function styleSheet(sheet: ExcelJS.Worksheet) {
  const headerRow = sheet.getRow(1)
  headerRow.height = 22
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FONT_COLOR } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: BRAND_GREEN },
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = allBorders
  })
  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  for (let i = 2; i <= sheet.rowCount; i++) {
    sheet.getRow(i).eachCell({ includeEmpty: true }, (cell) => {
      if (i % 2 === 0) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: STRIPE_COLOR },
        }
      }
      cell.border = allBorders
    })
  }
}

function projectLabel(project: {
  name: string
  projectYear: string | null
}): string {
  return project.projectYear
    ? `${project.name} (${project.projectYear})`
    : project.name
}

function formatDateTime(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}` +
    ` ${pad(value.getHours())}:${pad(value.getMinutes())}`
  )
}

const equipmentRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/equipment', async () => {
    const [equipment, faults, summary] = await Promise.all([
      fastify.prisma.projectEquipment.findMany({
        select: activeSelect,
        orderBy: { createdAt: 'desc' },
      }),
      fastify.prisma.projectEquipmentFault.findMany({
        select: faultSelect,
        orderBy: { reportedAt: 'desc' },
      }),
      computeSummary(fastify),
    ])
    return { equipment, faults, summary }
  })

  fastify.get(
    '/equipment/export',
    { schema: { querystring: exportQuerySchema } },
    async (request, reply) => {
      const scope = request.query.scope === 'faulty' ? 'faulty' : 'active'
      const where = buildWhere(request.query)

      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet(
        scope === 'faulty' ? 'อุปกรณ์เสีย' : 'อุปกรณ์',
      )
      sheet.columns = [
        { header: 'ลูกค้า', key: 'customer', width: 28 },
        { header: 'โปรเจค', key: 'project', width: 28 },
        { header: 'Brand', key: 'brand', width: 20 },
        { header: 'Model', key: 'model', width: 20 },
        { header: 'Serial No.', key: 'serialNo', width: 24 },
        { header: 'Description', key: 'description', width: 40 },
        ...(scope === 'faulty'
          ? [{ header: 'วันที่แจ้ง', key: 'reportedAt', width: 18 }]
          : []),
      ]

      if (scope === 'faulty') {
        const rows = await fastify.prisma.projectEquipmentFault.findMany({
          where,
          select: faultSelect,
          orderBy: { reportedAt: 'desc' },
        })
        for (const row of rows) {
          sheet.addRow({
            customer: row.project.customer.name,
            project: projectLabel(row.project),
            brand: row.brand ?? '',
            model: row.model ?? '',
            serialNo: row.serialNo ?? '',
            description: row.description ?? '',
            reportedAt: formatDateTime(row.reportedAt),
          })
        }
      } else {
        const rows = await fastify.prisma.projectEquipment.findMany({
          where,
          select: activeSelect,
          orderBy: { createdAt: 'desc' },
        })
        for (const row of rows) {
          sheet.addRow({
            customer: row.project.customer.name,
            project: projectLabel(row.project),
            brand: row.brand ?? '',
            model: row.model ?? '',
            serialNo: row.serialNo ?? '',
            description: row.description ?? '',
          })
        }
      }

      styleSheet(sheet)

      const buffer = await workbook.xlsx.writeBuffer()
      reply.header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      reply.header(
        'Content-Disposition',
        `attachment; filename="equipment-${scope}.xlsx"`,
      )
      return reply.send(buffer)
    },
  )
}

export default equipmentRoutes
