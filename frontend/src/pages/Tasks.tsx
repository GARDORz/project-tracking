import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { getUser } from '../lib/auth'
import type {
  Customer,
  ServiceJob,
  ServiceStatus,
  UserSummary,
} from '../lib/types'
import {
  formatDuration,
  formatServiceType,
  statusColors,
  statusLabels,
} from '../lib/serviceJobLabels'
import { formatProjectName } from '../lib/projectLabel'
import IconButton from '../components/IconButton'
import Pagination from '../components/Pagination'
import {
  IconCheck,
  IconEye,
  IconPaperclip,
  IconPencil,
  IconPlus,
  IconRefreshCw,
  IconSearch,
  IconShare,
  IconTrash,
  IconX,
} from '../components/icons'
import JobCreateModal from '../components/tasks/JobCreateModal'
import JobDetailsModal from '../components/tasks/JobDetailsModal'
import JobEditModal from '../components/tasks/JobEditModal'
import JobStatusModal from '../components/tasks/JobStatusModal'
import JobDeleteModal from '../components/tasks/JobDeleteModal'
import JobAttachmentModal from '../components/tasks/JobAttachmentModal'

type ActiveModal =
  | { type: 'create' }
  | {
      type: 'details' | 'edit' | 'status' | 'delete' | 'attachment'
      job: ServiceJob
    }
  | null

function Badge({
  className,
  children,
}: {
  className: string
  children: string
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  )
}

const validStatuses: ServiceStatus[] = [
  'NEW',
  'IN_PROGRESS',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
]

function Tasks() {
  const currentUser = getUser()
  const isAdmin = currentUser?.role === 'ADMIN'
  const isSuperEngineering = currentUser?.role === 'SUPER_ENGINEERING'
  const isSales = currentUser?.role === 'SALES'

  function canManage(job: ServiceJob) {
    // SALES is view/download/share-only, even on jobs they somehow reported or were assigned to.
    if (isSales) return false
    // SUPER_ENGINEERING can manage any job, same as ADMIN — it just can't delete one
    // (the delete button below stays gated to isAdmin only).
    return (
      isAdmin ||
      isSuperEngineering ||
      job.reporterId === currentUser?.id ||
      job.assignees.some((a) => a.id === currentUser?.id)
    )
  }

  const [jobs, setJobs] = useState<ServiceJob[]>([])
  const [users, setUsers] = useState<UserSummary[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)
  const [searchText, setSearchText] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const [copiedJobNo, setCopiedJobNo] = useState<string | null>(null)

  const statusParam = searchParams.get('status')
  const statusFilter = validStatuses.includes(statusParam as ServiceStatus)
    ? (statusParam as ServiceStatus)
    : null
  const mineFilter = searchParams.get('mine') === '1'
  const fromFilter = searchParams.get('from') ?? ''
  const toFilter = searchParams.get('to') ?? ''
  const employeeIdFilter = searchParams.get('employeeId') ?? ''
  const customerIdFilter = searchParams.get('customerId') ?? ''
  const projectIdFilter = searchParams.get('projectId') ?? ''

  // Every project of the chosen customer — active or not, since past jobs may
  // reference a project that's since been deactivated.
  const projectOptions =
    customers.find((customer) => customer.id === customerIdFilter)?.projects ??
    []

  const searchQuery = searchText.trim().toLowerCase()

  const filteredJobs = jobs
    .filter((job) => !statusFilter || job.status === statusFilter)
    .filter(
      (job) =>
        !mineFilter ||
        job.reporterId === currentUser?.id ||
        job.assignees.some((a) => a.id === currentUser?.id),
    )
    .filter((job) => {
      const jobDate = job.reportedAt.slice(0, 10)
      return (
        (!fromFilter || jobDate >= fromFilter) &&
        (!toFilter || jobDate <= toFilter)
      )
    })
    .filter(
      (job) =>
        !employeeIdFilter ||
        job.reporterId === employeeIdFilter ||
        job.assignees.some((a) => a.id === employeeIdFilter),
    )
    .filter((job) => !customerIdFilter || job.customerId === customerIdFilter)
    .filter((job) => !projectIdFilter || job.projectId === projectIdFilter)
    .filter(
      (job) =>
        !searchQuery ||
        job.title.toLowerCase().includes(searchQuery) ||
        job.jobNo.toLowerCase().includes(searchQuery) ||
        formatServiceType(job).toLowerCase().includes(searchQuery) ||
        job.customer.name.toLowerCase().includes(searchQuery),
    )
    // Completed jobs sink to the bottom; Array.prototype.sort is stable, so within
    // each group the existing order (reportedAt desc, from the API) is preserved.
    .sort(
      (a, b) =>
        (a.status === 'COMPLETED' ? 1 : 0) - (b.status === 'COMPLETED' ? 1 : 0),
    )

  const PAGE_SIZE = 20
  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE))
  const pageParam = Number(searchParams.get('page') ?? '1')
  const currentPage = Math.min(
    totalPages,
    Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1,
  )
  const pagedJobs = filteredJobs.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  function goToPage(page: number) {
    const next = new URLSearchParams(searchParams)
    if (page <= 1) {
      next.delete('page')
    } else {
      next.set('page', String(page))
    }
    setSearchParams(next)
  }

  function updateParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    next.delete('page')
    setSearchParams(next)
  }

  function clearStatusFilter() {
    updateParams({ status: null })
  }

  function clearMineFilter() {
    updateParams({ mine: null })
  }

  function handleSearchChange(value: string) {
    setSearchText(value)
    goToPage(1)
  }

  function handleFromChange(value: string) {
    updateParams({ from: value || null })
  }

  function handleToChange(value: string) {
    updateParams({ to: value || null })
  }

  function handleEmployeeChange(value: string) {
    updateParams({ employeeId: value || null })
  }

  function handleStatusSelectChange(value: string) {
    updateParams({ status: value || null })
  }

  function handleCustomerChange(value: string) {
    // A project picked for the previous customer wouldn't belong to this one.
    updateParams({ customerId: value || null, projectId: null })
  }

  function handleProjectChange(value: string) {
    updateParams({ projectId: value || null })
  }

  // navigator.clipboard needs a secure context (HTTPS or localhost) — falls back to
  // the legacy execCommand technique so the share button still works over plain HTTP.
  async function copyToClipboard(text: string): Promise<boolean> {
    if (window.isSecureContext && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch {
        // fall through to the legacy method
      }
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    let success = false
    try {
      success = document.execCommand('copy')
    } catch {
      // success stays false
    }
    document.body.removeChild(textarea)
    return success
  }

  async function handleShare(job: ServiceJob) {
    const url = `${window.location.origin}/track/${job.shareToken}`
    const success = await copyToClipboard(url)
    if (success) {
      setCopiedJobNo(job.jobNo)
      setTimeout(() => {
        setCopiedJobNo((current) => (current === job.jobNo ? null : current))
      }, 2000)
    }
  }

  async function loadJobs() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<ServiceJob[]>('/api/service-jobs')
      setJobs(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
    loadJobs()
    async function loadFilterOptions() {
      try {
        const [userData, customerData] = await Promise.all([
          apiFetch<UserSummary[]>('/api/users'),
          apiFetch<Customer[]>('/api/customers'),
        ])
        setUsers(userData)
        setCustomers(customerData)
      } catch {
        // Non-critical — the employee/customer/project filters just won't have
        // options until this succeeds; the job list itself still loads fine.
      }
    }
    loadFilterOptions()
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            งาน
          </h1>
          {statusFilter && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-green/10 py-1 pr-1.5 pl-3 text-sm font-medium text-brand-green dark:bg-brand-green/20 dark:text-green-400">
              {statusLabels[statusFilter]}
              <button
                type="button"
                onClick={clearStatusFilter}
                aria-label="ล้างตัวกรองสถานะ"
                className="rounded-full p-0.5 hover:bg-brand-green/20"
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
          {mineFilter && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-green/10 py-1 pr-1.5 pl-3 text-sm font-medium text-brand-green dark:bg-brand-green/20 dark:text-green-400">
              งานของฉัน
              <button
                type="button"
                onClick={clearMineFilter}
                aria-label="ล้างตัวกรองงานของฉัน"
                className="rounded-full p-0.5 hover:bg-brand-green/20"
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              value={searchText}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="ค้นหาหัวข้อ, Job No., ประเภทงาน หรือลูกค้า"
              className="w-56 rounded-lg border border-gray-300 bg-white py-2 pr-3 pl-9 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          {!isSales && (
            <button
              type="button"
              onClick={() => setActiveModal({ type: 'create' })}
              className="flex items-center gap-1.5 rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-dark"
            >
              <IconPlus className="h-4 w-4" />
              เพิ่ม Job
            </button>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <input
          type="date"
          value={fromFilter}
          onChange={(event) => handleFromChange(event.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
        <span className="text-sm text-gray-400 dark:text-gray-500">ถึง</span>
        <input
          type="date"
          value={toFilter}
          onChange={(event) => handleToChange(event.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
        <select
          value={employeeIdFilter}
          onChange={(event) => handleEmployeeChange(event.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">พนักงานทุกคน</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter ?? ''}
          onChange={(event) => handleStatusSelectChange(event.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">ทุกสถานะ</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={customerIdFilter}
          onChange={(event) => handleCustomerChange(event.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">ลูกค้าทุกคน</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
        <select
          value={projectIdFilter}
          onChange={(event) => handleProjectChange(event.target.value)}
          disabled={!customerIdFilter}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">
            {customerIdFilter ? 'ทุกโปรเจค' : 'เลือกลูกค้าก่อน'}
          </option>
          {projectOptions.map((project) => (
            <option key={project.id} value={project.id}>
              {formatProjectName(project)}
            </option>
          ))}
        </select>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-gray-200 bg-white text-xs text-gray-400 uppercase dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">ลำดับ</th>
              <th className="px-4 py-3 font-medium">Job No.</th>
              <th className="px-4 py-3 font-medium">หัวข้อ</th>
              <th className="px-4 py-3 font-medium">ประเภท</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
              <th className="px-4 py-3 font-medium">เวลาที่ใช้ทำงาน</th>
              <th className="px-4 py-3 font-medium">หมายเหตุ</th>
              <th className="px-4 py-3 font-medium">การจัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-6 text-center text-gray-400 dark:text-gray-500"
                >
                  กำลังโหลด...
                </td>
              </tr>
            )}

            {!loading && error && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-6 text-center text-brand-red"
                >
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && filteredJobs.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-6 text-center text-gray-400 dark:text-gray-500"
                >
                  {statusFilter ||
                  mineFilter ||
                  searchQuery ||
                  fromFilter ||
                  toFilter ||
                  employeeIdFilter ||
                  customerIdFilter ||
                  projectIdFilter
                    ? 'ไม่พบงานตามตัวกรองนี้'
                    : 'ยังไม่มีงาน'}
                </td>
              </tr>
            )}

            {!loading &&
              !error &&
              pagedJobs.map((job, index) => (
                <tr
                  key={job.jobNo}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {(currentPage - 1) * PAGE_SIZE + index + 1}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">
                    {job.jobNo}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                    {job.title}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {formatServiceType(job)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={statusColors[job.status]}>
                      {statusLabels[job.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {formatDuration(job)}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-gray-500 dark:text-gray-400">
                    {job.remark ?? '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <IconButton
                        label="รายละเอียด"
                        onClick={() => setActiveModal({ type: 'details', job })}
                      >
                        <IconEye className="h-4 w-4" />
                      </IconButton>
                      {canManage(job) && (
                        <>
                          <IconButton
                            label="แก้ไข"
                            onClick={() =>
                              setActiveModal({ type: 'edit', job })
                            }
                          >
                            <IconPencil className="h-4 w-4" />
                          </IconButton>
                          <IconButton
                            label="อัปเดตสถานะ"
                            onClick={() =>
                              setActiveModal({ type: 'status', job })
                            }
                          >
                            <IconRefreshCw className="h-4 w-4" />
                          </IconButton>
                        </>
                      )}
                      <IconButton
                        label={
                          job.attachments.length > 0 ? 'ไฟล์แนบ' : 'แนบไฟล์'
                        }
                        onClick={() =>
                          setActiveModal({ type: 'attachment', job })
                        }
                      >
                        <IconPaperclip
                          className={`h-4 w-4 ${job.attachments.length > 0 ? 'text-brand-green' : ''}`}
                        />
                      </IconButton>
                      <IconButton
                        label={
                          copiedJobNo === job.jobNo
                            ? 'คัดลอกลิงก์แล้ว!'
                            : 'แชร์'
                        }
                        onClick={() => handleShare(job)}
                      >
                        {copiedJobNo === job.jobNo ? (
                          <IconCheck className="h-4 w-4 text-brand-green" />
                        ) : (
                          <IconShare className="h-4 w-4" />
                        )}
                      </IconButton>
                      {isAdmin && (
                        <IconButton
                          label="ลบ"
                          variant="danger"
                          onClick={() =>
                            setActiveModal({ type: 'delete', job })
                          }
                        >
                          <IconTrash className="h-4 w-4" />
                        </IconButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={goToPage}
      />

      {activeModal?.type === 'create' && (
        <JobCreateModal
          onClose={() => setActiveModal(null)}
          onSaved={loadJobs}
        />
      )}
      {activeModal?.type === 'details' && (
        <JobDetailsModal
          job={activeModal.job}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal?.type === 'edit' && (
        <JobEditModal
          job={activeModal.job}
          onClose={() => setActiveModal(null)}
          onSaved={loadJobs}
        />
      )}
      {activeModal?.type === 'status' && (
        <JobStatusModal
          job={activeModal.job}
          onClose={() => setActiveModal(null)}
          onSaved={loadJobs}
        />
      )}
      {activeModal?.type === 'delete' && (
        <JobDeleteModal
          job={activeModal.job}
          onClose={() => setActiveModal(null)}
          onDeleted={loadJobs}
        />
      )}
      {activeModal?.type === 'attachment' && (
        <JobAttachmentModal
          job={activeModal.job}
          canManage={canManage(activeModal.job)}
          onClose={() => setActiveModal(null)}
          onSaved={loadJobs}
        />
      )}
    </div>
  )
}

export default Tasks
