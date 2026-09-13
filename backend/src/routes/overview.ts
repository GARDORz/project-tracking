import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import ExcelJS from 'exceljs'

type ServiceType = 'WARRANTY' | 'MA_SERVICE' | 'PERCALL' | 'OTHER'
type Role = 'ADMIN' | 'ENGINEERING' | 'SALES' | 'SUPER_ENGINEERING'

const typeOrder: ServiceType[] = ['WARRANTY', 'MA_SERVICE', 'PERCALL', 'OTHER']

const typeLabels: Record<ServiceType, string> = {
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

const roleLabels: Record<Role, string> = {
  ADMIN: 'ผู้ดูแลระบบ',
  ENGINEERING: 'ช่าง/วิศวกร',
  SALES: 'ฝ่ายขาย',
  SUPER_ENGINEERING: 'หัวหน้าวิศวกร',
}

function formatSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  return `${hours} ชม. ${minutes} นาที`
}

// "3 ชม. 17 นาที (5 งาน)" — includes the sample count so an average isn't
// mistaken for a single data point.
function formatDurationStat(stat: DurationStat): string {
  if (stat.avgSeconds === null) return '-'
  return `${formatSeconds(stat.avgSeconds)} (${stat.sampleCount} งาน)`
}

interface DurationStat {
  avgSeconds: number | null
  sampleCount: number
}

// Average worked time, counted over COMPLETED jobs only — an in-progress or
// cancelled job's elapsed time isn't a finished measurement.
function averageDuration(
  jobs: { status: string; workedSeconds: number }[],
): DurationStat {
  const completed = jobs.filter((j) => j.status === 'COMPLETED')
  const sampleCount = completed.length
  const avgSeconds =
    sampleCount > 0
      ? Math.round(
          completed.reduce((sum, j) => sum + j.workedSeconds, 0) / sampleCount,
        )
      : null
  return { avgSeconds, sampleCount }
}

function elapsedSecondsOf(job: {
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

interface DateRange {
  from?: Date
  to?: Date
}

// A management-level summary report — job/people totals plus a per-person and
// per-type breakdown. Restricted to ADMIN and SUPER_ENGINEERING: it surfaces
// individual work-output numbers, which isn't something every role should see.
async function computeOverview(fastify: FastifyInstance, range: DateRange) {
  const reportedAt: { gte?: Date; lte?: Date } = {}
  if (range.from) reportedAt.gte = range.from
  if (range.to) reportedAt.lte = range.to

  const [people, jobs] = await Promise.all([
    // SALES never gets assigned jobs (excluded from the assignee picker), so
    // it has no place in a workload report.
    fastify.prisma.user.findMany({
      where: { role: { not: 'SALES' } },
      select: { id: true, name: true, role: true },
    }),
    fastify.prisma.serviceJob.findMany({
      where: Object.keys(reportedAt).length > 0 ? { reportedAt } : undefined,
      select: {
        jobNo: true,
        title: true,
        type: true,
        status: true,
        reportedAt: true,
        workedSeconds: true,
        currentSegmentStartedAt: true,
        assignees: { select: { userId: true } },
      },
    }),
  ])

  const totalEngineers = people.filter(
    (p) => p.role === 'ENGINEERING' || p.role === 'SUPER_ENGINEERING',
  ).length
  const totalAdmins = people.filter((p) => p.role === 'ADMIN').length

  // Busiest person first — same order used for every per-person breakdown below.
  const peopleWithJobs = people
    .map((person) => ({
      person,
      assigned: jobs.filter((job) =>
        job.assignees.some((a) => a.userId === person.id),
      ),
    }))
    .sort((a, b) => b.assigned.length - a.assigned.length)

  const byPerson = peopleWithJobs.map(({ person, assigned }) => ({
    userId: person.id,
    name: person.name,
    role: person.role,
    totalJobs: assigned.length,
    newJobs: assigned.filter((j) => j.status === 'NEW').length,
    inProgressJobs: assigned.filter((j) => j.status === 'IN_PROGRESS').length,
    onHoldJobs: assigned.filter((j) => j.status === 'ON_HOLD').length,
    completedJobs: assigned.filter((j) => j.status === 'COMPLETED').length,
    cancelledJobs: assigned.filter((j) => j.status === 'CANCELLED').length,
  }))

  const avgDurationByType = typeOrder.map((type) => ({
    type,
    ...averageDuration(jobs.filter((j) => j.type === type)),
  }))

  const byPersonType = peopleWithJobs.map(({ person, assigned }) => ({
    userId: person.id,
    name: person.name,
    role: person.role,
    durations: Object.fromEntries(
      typeOrder.map((type) => [
        type,
        averageDuration(assigned.filter((j) => j.type === type)),
      ]),
    ) as Record<ServiceType, DurationStat>,
  }))

  // The actual job list behind each person's numbers — same order as above,
  // each person's own jobs sorted most-recently-reported first.
  const byPersonJobs = peopleWithJobs.map(({ person, assigned }) => ({
    userId: person.id,
    name: person.name,
    role: person.role,
    jobs: [...assigned]
      .sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime())
      .map((job) => ({
        jobNo: job.jobNo,
        title: job.title,
        type: job.type as ServiceType,
        status: job.status,
        reportedAt: job.reportedAt,
        elapsedSeconds: elapsedSecondsOf(job),
      })),
  }))

  return {
    totals: { totalJobs: jobs.length, totalEngineers, totalAdmins },
    byPerson,
    avgDurationByType,
    byPersonType,
    byPersonJobs,
  }
}

function isEngineer(role: Role): boolean {
  return role === 'ENGINEERING' || role === 'SUPER_ENGINEERING'
}

function parseDateRange(query: { from?: string; to?: string }): DateRange {
  return {
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
  }
}

// --- Excel styling helpers — a shared look across every sheet in the export ---

const BRAND_GREEN = 'FF1A5F3F'
const HEADER_FONT_COLOR = 'FFFFFFFF'
const STRIPE_COLOR = 'FFF3F4F6'
const BORDER_COLOR = 'FFE5E7EB'

const thinBorder = {
  style: 'thin' as const,
  color: { argb: BORDER_COLOR },
}

function styleHeaderRow(sheet: ExcelJS.Worksheet) {
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
    cell.border = {
      top: thinBorder,
      left: thinBorder,
      bottom: thinBorder,
      right: thinBorder,
    }
  })
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
}

// Zebra-stripes and borders every data row (everything after the header).
function styleDataRows(sheet: ExcelJS.Worksheet) {
  for (let i = 2; i <= sheet.rowCount; i++) {
    const isStriped = i % 2 === 0
    sheet.getRow(i).eachCell({ includeEmpty: true }, (cell) => {
      if (isStriped) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: STRIPE_COLOR },
        }
      }
      cell.border = {
        top: thinBorder,
        left: thinBorder,
        bottom: thinBorder,
        right: thinBorder,
      }
    })
  }
}

const dateRangeQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
})

const exportQuerySchema = dateRangeQuerySchema.extend({
  onlyEngineers: z.string().optional(),
})

const overviewRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get(
    '/reports/overview',
    { schema: { querystring: dateRangeQuerySchema } },
    async (request, reply) => {
      if (
        request.user.role !== 'ADMIN' &&
        request.user.role !== 'SUPER_ENGINEERING'
      ) {
        return reply.code(403).send({ error: 'ไม่มีสิทธิ์เข้าถึงรายงานนี้' })
      }

      return computeOverview(fastify, parseDateRange(request.query))
    },
  )

  fastify.get(
    '/reports/overview/export',
    { schema: { querystring: exportQuerySchema } },
    async (request, reply) => {
      if (
        request.user.role !== 'ADMIN' &&
        request.user.role !== 'SUPER_ENGINEERING'
      ) {
        return reply.code(403).send({ error: 'ไม่มีสิทธิ์เข้าถึงรายงานนี้' })
      }

      const onlyEngineers = request.query.onlyEngineers === '1'
      const range = parseDateRange(request.query)
      const {
        totals,
        byPerson,
        avgDurationByType,
        byPersonType,
        byPersonJobs,
      } = await computeOverview(fastify, range)
      const people = onlyEngineers
        ? byPerson.filter((p) => isEngineer(p.role))
        : byPerson
      const peopleTypes = onlyEngineers
        ? byPersonType.filter((p) => isEngineer(p.role))
        : byPersonType
      const peopleJobs = onlyEngineers
        ? byPersonJobs.filter((p) => isEngineer(p.role))
        : byPersonJobs

      const workbook = new ExcelJS.Workbook()

      const summarySheet = workbook.addWorksheet('ภาพรวม')
      summarySheet.columns = [
        { header: 'รายการ', key: 'label', width: 44 },
        { header: 'จำนวน', key: 'value', width: 20 },
      ]
      summarySheet.addRow({ label: 'งานทั้งหมด', value: totals.totalJobs })
      summarySheet.addRow({
        label: 'ช่างทั้งหมด',
        value: totals.totalEngineers,
      })
      summarySheet.addRow({ label: 'แอดมินทั้งหมด', value: totals.totalAdmins })
      for (const row of avgDurationByType) {
        summarySheet.addRow({
          label: `เวลาทำงานเฉลี่ย — ${typeLabels[row.type]} (เฉพาะงานที่เสร็จสิ้นแล้ว)`,
          value: formatDurationStat(row),
        })
      }
      styleHeaderRow(summarySheet)
      styleDataRows(summarySheet)

      const personSheet = workbook.addWorksheet('งานรายบุคคล')
      personSheet.columns = [
        { header: 'ชื่อ', key: 'name', width: 24 },
        { header: 'บทบาท', key: 'role', width: 18 },
        { header: 'รอดำเนินการ', key: 'newJobs', width: 14 },
        { header: 'กำลังดำเนินการ', key: 'inProgressJobs', width: 16 },
        { header: 'พักงาน', key: 'onHoldJobs', width: 12 },
        { header: 'เสร็จแล้ว', key: 'completedJobs', width: 12 },
        { header: 'ยกเลิก', key: 'cancelledJobs', width: 12 },
        { header: 'รวม', key: 'totalJobs', width: 12 },
      ]
      for (const person of people) {
        personSheet.addRow({
          name: person.name,
          role: roleLabels[person.role],
          newJobs: person.newJobs,
          inProgressJobs: person.inProgressJobs,
          onHoldJobs: person.onHoldJobs,
          completedJobs: person.completedJobs,
          cancelledJobs: person.cancelledJobs,
          totalJobs: person.totalJobs,
        })
      }
      personSheet.getColumn('totalJobs').font = { bold: true }
      styleHeaderRow(personSheet)
      styleDataRows(personSheet)

      const durationSheet = workbook.addWorksheet('เฉลี่ยเวลารายบุคคล')
      durationSheet.columns = [
        { header: 'ชื่อ', key: 'name', width: 24 },
        { header: 'บทบาท', key: 'role', width: 18 },
        ...typeOrder.map((type) => ({
          header: typeLabels[type],
          key: type,
          width: 26,
        })),
      ]
      for (const person of peopleTypes) {
        const row: Record<string, string> = {
          name: person.name,
          role: roleLabels[person.role],
        }
        for (const type of typeOrder) {
          row[type] = formatDurationStat(person.durations[type])
        }
        durationSheet.addRow(row)
      }
      styleHeaderRow(durationSheet)
      styleDataRows(durationSheet)

      // The actual jobs behind every person's numbers above — one row per
      // (person, job) pair, so a job with several assignees appears once per person.
      const detailSheet = workbook.addWorksheet('รายละเอียดงานรายบุคคล')
      detailSheet.columns = [
        { header: 'ชื่อ', key: 'name', width: 24 },
        { header: 'บทบาท', key: 'role', width: 18 },
        { header: 'Job No.', key: 'jobNo', width: 16 },
        { header: 'หัวข้อ', key: 'title', width: 32 },
        { header: 'ประเภทงาน', key: 'type', width: 16 },
        { header: 'สถานะ', key: 'status', width: 16 },
        { header: 'วันที่แจ้ง', key: 'reportedAt', width: 18 },
        { header: 'เวลาที่ใช้ทำงาน', key: 'duration', width: 20 },
      ]
      for (const person of peopleJobs) {
        for (const job of person.jobs) {
          detailSheet.addRow({
            name: person.name,
            role: roleLabels[person.role],
            jobNo: job.jobNo,
            title: job.title,
            type: typeLabels[job.type],
            status: statusLabels[job.status] ?? job.status,
            reportedAt: job.reportedAt.toLocaleString('th-TH', {
              dateStyle: 'medium',
              timeStyle: 'short',
            }),
            duration: formatSeconds(job.elapsedSeconds),
          })
        }
      }
      styleHeaderRow(detailSheet)
      styleDataRows(detailSheet)

      const buffer = await workbook.xlsx.writeBuffer()

      reply.header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      reply.header(
        'Content-Disposition',
        'attachment; filename="overview-report.xlsx"',
      )
      return reply.send(buffer)
    },
  )
}

export default overviewRoutes
