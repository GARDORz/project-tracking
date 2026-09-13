export type Role = 'ADMIN' | 'ENGINEERING' | 'SALES' | 'SUPER_ENGINEERING'

export interface UserSummary {
  id: string
  userID: string
  name: string
  role: Role
  createdAt: string
}

export interface AuditLogEntry {
  id: string
  actorId: string | null
  actorLabel: string | null
  actor: { userID: string; name: string } | null
  action: string
  entityType: string | null
  entityId: string | null
  message: string
  createdAt: string
}

export interface CustomerContact {
  id: string
  name: string
  phone: string | null
  email: string | null
  isActive: boolean
}

export interface ProjectSla {
  id: string
  slaResolutionDays: number
  slaResolutionHours: number
  slaResponseHours: number
  isActive: boolean
}

export interface ProjectEquipment {
  id: string
  brand: string | null
  model: string | null
  serialNo: string | null
  description: string | null
  createdAt: string
}

export interface ProjectEquipmentFault {
  id: string
  brand: string | null
  model: string | null
  serialNo: string | null
  description: string | null
  reportedAt: string
}

// Rows returned by the cross-project equipment browser (GET /api/equipment).
export interface EquipmentRow {
  id: string
  brand: string | null
  model: string | null
  serialNo: string | null
  description: string | null
  projectId: string
  project: {
    id: string
    name: string
    projectYear: string | null
    customer: { id: string; name: string }
  }
}

export interface EquipmentFaultRow extends EquipmentRow {
  reportedAt: string
}

export interface EquipmentOverview {
  equipment: EquipmentRow[]
  faults: EquipmentFaultRow[]
  summary: {
    totalEquipment: number
    totalFaults: number
    projectsWithEquipment: number
    customersWithEquipment: number
  }
}

export interface Project {
  id: string
  name: string
  isActive: boolean
  projectYear: string | null
  contractNumber: string | null
  contractStartDate: string | null
  contractEndDate: string | null
  contractNotifyMonths: number
  attachments: Attachment[]
  slaEntries: ProjectSla[]
  _count: { equipment: number }
}

export interface Customer {
  id: string
  name: string
  // Free text, not a link to another customer record.
  parentName: string | null
  comment: string | null
  isActive: boolean
  createdAt: string
  contacts: CustomerContact[]
  projects: Project[]
}

export type ServiceType = 'WARRANTY' | 'MA_SERVICE' | 'PERCALL' | 'OTHER'
export type ServiceStatus =
  'NEW' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED'
export type ContactChannel = 'PHONE' | 'EMAIL' | 'LINE'
export type ServiceCategory =
  'HARDWARE' | 'SOFTWARE' | 'PROFESSIONAL_SERVICE' | 'OTHER'

export interface Notification {
  id: string
  userId: string
  message: string
  jobNo: string | null
  read: boolean
  createdAt: string
}

export interface Attachment {
  id: string
  fileName: string
  mimeType: string
  size: number
  uploadedAt: string
}

export interface ServiceJob {
  jobNo: string
  reporterId: string
  customerId: string
  projectId: string | null
  project: {
    id: string
    name: string
    projectYear: string | null
    contractNumber: string | null
    contractStartDate: string | null
    contractEndDate: string | null
  } | null
  slaId: string | null
  sla: Pick<
    ProjectSla,
    'id' | 'slaResolutionDays' | 'slaResolutionHours' | 'slaResponseHours'
  > | null
  title: string
  description: string | null
  type: ServiceType
  typeOther: string | null
  contactChannel: ContactChannel | null
  serviceCategory: ServiceCategory | null
  serviceCategoryOther: string | null
  remark: string | null
  status: ServiceStatus
  reportedAt: string
  shareToken: string
  // Time tracking — see backend/prisma/schema.prisma's comment on ServiceJob for the
  // pause/resume model. `elapsedSeconds` is the ready-to-display total (computed
  // server-side, includes the current in-progress segment if the job is running now).
  startedAt: string | null
  completedAt: string | null
  elapsedSeconds: number
  attachments: Attachment[]
  customer: Customer
  reporter: UserSummary
  assignees: UserSummary[]
}

export interface PublicServiceJob {
  jobNo: string
  title: string
  type: ServiceType
  status: ServiceStatus
  remark: string | null
  reportedAt: string
  customer: { name: string }
}

export interface DurationStat {
  avgSeconds: number | null
  sampleCount: number
}

export interface OverviewReport {
  totals: {
    totalJobs: number
    totalEngineers: number
    totalAdmins: number
  }
  byPerson: {
    userId: string
    name: string
    role: Role
    totalJobs: number
    newJobs: number
    inProgressJobs: number
    onHoldJobs: number
    completedJobs: number
    cancelledJobs: number
  }[]
  avgDurationByType: ({ type: ServiceType } & DurationStat)[]
  byPersonType: {
    userId: string
    name: string
    role: Role
    durations: Record<ServiceType, DurationStat>
  }[]
}
