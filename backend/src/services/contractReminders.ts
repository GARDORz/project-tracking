import type { PrismaClient } from '@prisma/client'

function monthsBefore(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() - months)
  return result
}

function startOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function contractLabel(project: {
  name: string
  contractNumber: string | null
  customer: { name: string }
}): string {
  const base = `${project.customer.name} - ${project.name}`
  return project.contractNumber
    ? `${base} (เลขที่ ${project.contractNumber})`
    : base
}

// Runs once per day (see services/scheduler.ts). For every project whose contract
// falls inside its own notify-before-expiry window, notifies every ADMIN plus the
// assignees of that project's most recent job (per-project "responsible person"
// choice — the app has no assignee concept at the project level itself). Fires
// again on each subsequent day the contract stays inside the window (no
// once-only dedup), stopping once the contract has actually expired.
export async function checkContractExpiries(
  prisma: PrismaClient,
): Promise<void> {
  const today = startOfDay(new Date())

  const projects = await prisma.project.findMany({
    where: { contractEndDate: { not: null } },
    include: { customer: { select: { name: true } } },
  })

  const dueProjects = projects.filter((project) => {
    if (!project.contractEndDate) return false
    const notifyFrom = startOfDay(
      monthsBefore(project.contractEndDate, project.contractNotifyMonths),
    )
    const endDay = startOfDay(project.contractEndDate)
    return today >= notifyFrom && today <= endDay
  })

  if (dueProjects.length === 0) return

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true },
  })
  const adminIds = admins.map((admin) => admin.id)

  for (const project of dueProjects) {
    const latestJob = await prisma.serviceJob.findFirst({
      where: { projectId: project.id },
      orderBy: { reportedAt: 'desc' },
      include: { assignees: { select: { userId: true } } },
    })
    const recipientIds = new Set([
      ...adminIds,
      ...(latestJob?.assignees.map((a) => a.userId) ?? []),
    ])
    if (recipientIds.size === 0) continue

    const endDate = project.contractEndDate as Date
    const daysLeft = Math.round(
      (startOfDay(endDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    )
    const message =
      daysLeft <= 0
        ? `สัญญาของ ${contractLabel(project)} หมดอายุวันนี้`
        : `สัญญาของ ${contractLabel(project)} จะหมดอายุในอีก ${daysLeft} วัน (${endDate.toLocaleDateString('th-TH')})`

    await prisma.notification.createMany({
      data: [...recipientIds].map((userId) => ({
        userId,
        jobNo: latestJob?.jobNo ?? null,
        message,
      })),
    })
  }
}
