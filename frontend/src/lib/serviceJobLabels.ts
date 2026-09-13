import type {
  ContactChannel,
  DurationStat,
  ServiceCategory,
  ServiceJob,
  ServiceStatus,
  ServiceType,
} from './types'

export const typeLabels: Record<ServiceType, string> = {
  WARRANTY: 'WARRANTY',
  MA_SERVICE: 'MA SERVICE',
  PERCALL: 'PERCALL',
  OTHER: 'OTHER',
}

export const contactChannelLabels: Record<ContactChannel, string> = {
  PHONE: 'PHONE NUMBER',
  EMAIL: 'E-MAIL',
  LINE: 'LINE',
}

export const serviceCategoryLabels: Record<ServiceCategory, string> = {
  HARDWARE: 'HARDWARE',
  SOFTWARE: 'SOFTWARE',
  PROFESSIONAL_SERVICE: 'PROFESSIONAL SERVICE',
  OTHER: 'OTHER',
}

// Appends the reporter's free-text label for OTHER-type jobs, e.g. "OTHER (ติดตั้งเพิ่มเติม)".
// Every other type reuses the same field for its CM/PM checkboxes, e.g. "MA SERVICE (CM, PM)".
export function formatServiceType(
  job: Pick<ServiceJob, 'type' | 'typeOther'>,
): string {
  if (job.typeOther) {
    return `${typeLabels[job.type]} (${job.typeOther})`
  }
  return typeLabels[job.type]
}

// "PROFESSIONAL SERVICE" or "OTHER (ระบุเอง)" — empty string when not set.
export function formatServiceCategory(
  job: Pick<ServiceJob, 'serviceCategory' | 'serviceCategoryOther'>,
): string {
  if (!job.serviceCategory) return ''
  const label = serviceCategoryLabels[job.serviceCategory]
  return job.serviceCategoryOther
    ? `${label} (${job.serviceCategoryOther})`
    : label
}

// "3 ชม. 17 นาที"
export function formatSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  return `${hours} ชม. ${minutes} นาที`
}

// Hidden ('-') until the job has actually started once.
export function formatDuration(
  job: Pick<ServiceJob, 'elapsedSeconds' | 'startedAt'>,
): string {
  if (!job.startedAt) return '-'
  return formatSeconds(job.elapsedSeconds)
}

// "3 ชม. 17 นาที (5 งาน)" — includes the sample count so an average isn't
// mistaken for a single data point.
export function formatDurationStat(stat: DurationStat): string {
  if (stat.avgSeconds === null) return '-'
  return `${formatSeconds(stat.avgSeconds)} (${stat.sampleCount} งาน)`
}

export const statusLabels: Record<ServiceStatus, string> = {
  NEW: 'รอดำเนินการ',
  IN_PROGRESS: 'กำลังดำเนินการ',
  ON_HOLD: 'พักงาน',
  COMPLETED: 'เสร็จสิ้น',
  CANCELLED: 'ยกเลิก',
}

export const statusColors: Record<ServiceStatus, string> = {
  NEW: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  IN_PROGRESS:
    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  ON_HOLD: 'bg-brand-yellow/20 text-amber-700 dark:text-amber-400',
  COMPLETED:
    'bg-brand-green/10 text-brand-green dark:bg-brand-green/20 dark:text-green-400',
  CANCELLED: 'bg-brand-red/10 text-brand-red dark:bg-brand-red/20',
}
