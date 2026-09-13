import { z } from 'zod'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import ExcelJS from 'exceljs'
import { userSummarySelect } from '../services/userSelect.js'

const typeLabels: Record<string, string> = {
  WARRANTY: 'WARRANTY',
  MA_SERVICE: 'MA SERVICE',
  PERCALL: 'PERCALL',
  OTHER: 'OTHER',
}

const statusLabels: Record<string, string> = {
  NEW: 'รอดำเนินการ',
  IN_PROGRESS: 'กำลังดำเนินการ',
  ON_HOLD: 'พักงาน',
  COMPLETED: 'เสร็จสิ้น',
  CANCELLED: 'ยกเลิก',
}

const contactChannelLabels: Record<string, string> = {
  PHONE: 'PHONE NUMBER',
  EMAIL: 'E-MAIL',
  LINE: 'LINE',
}

const serviceCategoryLabels: Record<string, string> = {
  HARDWARE: 'HARDWARE',
  SOFTWARE: 'SOFTWARE',
  PROFESSIONAL_SERVICE: 'PROFESSIONAL SERVICE',
  OTHER: 'OTHER',
}

function formatType(type: string, typeOther: string | null) {
  return typeOther ? `${typeLabels[type]} (${typeOther})` : typeLabels[type]
}

function formatServiceCategory(
  category: string | null,
  categoryOther: string | null,
) {
  if (!category) return ''
  const label = serviceCategoryLabels[category] ?? category
  return categoryOther ? `${label} (${categoryOther})` : label
}

// "ชื่อโปรเจค (2568)" — appends the project's Buddhist-era year, if set.
function formatProjectName(
  project: { name: string; projectYear: string | null } | null,
) {
  if (!project) return ''
  return project.projectYear
    ? `${project.name} (${project.projectYear})`
    : project.name
}

// Mirrors serviceJobs.ts's serializeJob(): banked workedSeconds plus whatever has
// elapsed in the current segment if the job is in progress right now.
function computeElapsedSeconds(job: {
  status: string
  workedSeconds: number
  currentSegmentStartedAt: Date | null
}): number {
  return (
    job.workedSeconds +
    (job.status === 'IN_PROGRESS' && job.currentSegmentStartedAt
      ? Math.floor((Date.now() - job.currentSegmentStartedAt.getTime()) / 1000)
      : 0)
  )
}

function formatDuration(
  elapsedSeconds: number,
  startedAt: Date | null,
): string {
  if (!startedAt) return ''
  const hours = Math.floor(elapsedSeconds / 3600)
  const minutes = Math.floor((elapsedSeconds % 3600) / 60)
  return `${hours} ชม. ${minutes} นาที`
}

// "n x n respond n hr." — resolution time as days x hours, then response time in hours.
function formatSla(sla: {
  slaResolutionDays: number
  slaResolutionHours: number
  slaResponseHours: number
}): string {
  return `${sla.slaResolutionDays} x ${sla.slaResolutionHours} respond ${sla.slaResponseHours} hr.`
}

const exportQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  employeeId: z.string().optional(),
  status: z
    .enum(['NEW', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'])
    .optional(),
  customerId: z.string().optional(),
  projectId: z.string().optional(),
})

const reportRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get(
    '/reports/service-jobs/export',
    { schema: { querystring: exportQuerySchema } },
    async (request, reply) => {
      const { from, to, employeeId, status, customerId, projectId } =
        request.query

      const reportedAt: { gte?: Date; lte?: Date } = {}
      if (from) reportedAt.gte = new Date(`${from}T00:00:00`)
      if (to) reportedAt.lte = new Date(`${to}T23:59:59.999`)

      const jobs = await fastify.prisma.serviceJob.findMany({
        where: {
          ...(Object.keys(reportedAt).length > 0 && { reportedAt }),
          // Optional: only jobs where the chosen person is the reporter or one of the assignees.
          ...(employeeId && {
            OR: [
              { reporterId: employeeId },
              { assignees: { some: { userId: employeeId } } },
            ],
          }),
          ...(status && { status }),
          ...(customerId && { customerId }),
          // Only meaningful alongside customerId — when no project is chosen, every project
          // (and jobs with no project) under that customer stays included.
          ...(projectId && { projectId }),
        },
        orderBy: { reportedAt: 'desc' },
        include: {
          customer: true,
          project: {
            select: {
              name: true,
              projectYear: true,
              contractNumber: true,
              contractStartDate: true,
              contractEndDate: true,
            },
          },
          sla: {
            select: {
              slaResolutionDays: true,
              slaResolutionHours: true,
              slaResponseHours: true,
            },
          },
          reporter: { select: userSummarySelect },
          assignees: { select: { user: { select: userSummarySelect } } },
        },
      })

      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('รายงานงาน')

      sheet.columns = [
        { header: 'ลำดับ', key: 'index', width: 8 },
        { header: 'Job No.', key: 'jobNo', width: 16 },
        { header: 'ลูกค้า', key: 'customer', width: 24 },
        { header: 'โปรเจค', key: 'project', width: 20 },
        { header: 'เลขที่สัญญา', key: 'contractNumber', width: 18 },
        { header: 'วันเริ่มต้นสัญญา', key: 'contractStartDate', width: 16 },
        { header: 'วันที่สิ้นสุดสัญญา', key: 'contractEndDate', width: 16 },
        { header: 'SLA', key: 'sla', width: 20 },
        { header: 'หัวข้อ', key: 'title', width: 30 },
        { header: 'รายละเอียด', key: 'description', width: 30 },
        { header: 'ประเภท', key: 'type', width: 20 },
        { header: 'SERVICE TYPE', key: 'serviceCategory', width: 22 },
        { header: 'สถานะ', key: 'status', width: 16 },
        { header: 'START TIME', key: 'startedAt', width: 18 },
        { header: 'END TIME', key: 'completedAt', width: 18 },
        { header: 'เวลาที่ใช้ทำงาน', key: 'duration', width: 20 },
        { header: 'ผู้แจ้ง', key: 'reporter', width: 18 },
        { header: 'ผู้รับผิดชอบ', key: 'assignees', width: 24 },
        { header: 'วันที่แจ้ง', key: 'reportedAt', width: 18 },
        { header: 'ติดต่อมาจาก', key: 'contactChannel', width: 16 },
        { header: 'หมายเหตุ', key: 'remark', width: 30 },
      ]
      sheet.getRow(1).font = { bold: true }

      jobs.forEach((job, index) => {
        sheet.addRow({
          index: index + 1,
          jobNo: job.jobNo,
          customer: job.customer.name,
          project: formatProjectName(job.project),
          contractNumber: job.project?.contractNumber ?? '',
          contractStartDate: job.project?.contractStartDate
            ? job.project.contractStartDate.toLocaleDateString('th-TH', {
                dateStyle: 'medium',
              })
            : '',
          contractEndDate: job.project?.contractEndDate
            ? job.project.contractEndDate.toLocaleDateString('th-TH', {
                dateStyle: 'medium',
              })
            : '',
          sla: job.sla ? formatSla(job.sla) : '',
          title: job.title,
          description: job.description ?? '',
          type: formatType(job.type, job.typeOther),
          serviceCategory: formatServiceCategory(
            job.serviceCategory,
            job.serviceCategoryOther,
          ),
          status: statusLabels[job.status],
          startedAt: job.startedAt
            ? job.startedAt.toLocaleString('th-TH', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })
            : '',
          completedAt: job.completedAt
            ? job.completedAt.toLocaleString('th-TH', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })
            : '',
          duration: formatDuration(computeElapsedSeconds(job), job.startedAt),
          reporter: job.reporter.name,
          assignees:
            job.assignees.map((a) => a.user.name).join(', ') || 'ยังไม่มอบหมาย',
          reportedAt: job.reportedAt.toLocaleString('th-TH', {
            dateStyle: 'medium',
            timeStyle: 'short',
          }),
          contactChannel: job.contactChannel
            ? (contactChannelLabels[job.contactChannel] ?? job.contactChannel)
            : '',
          remark: job.remark ?? '',
        })
      })

      const buffer = await workbook.xlsx.writeBuffer()

      reply.header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      reply.header(
        'Content-Disposition',
        'attachment; filename="service-jobs-report.xlsx"',
      )
      return reply.send(buffer)
    },
  )
}

export default reportRoutes
