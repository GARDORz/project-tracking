import { useEffect, useMemo, useState } from 'react'
import { apiFetch, apiFetchBlob } from '../lib/api'
import type {
  Customer,
  ServiceJob,
  ServiceStatus,
  UserSummary,
} from '../lib/types'
import {
  contactChannelLabels,
  formatDuration,
  formatServiceCategory,
  formatServiceType,
  statusColors,
  statusLabels,
} from '../lib/serviceJobLabels'
import { formatSla } from '../lib/slaLabel'
import { formatProjectName } from '../lib/projectLabel'
import {
  IconBarChart,
  IconCheckSquare,
  IconClock,
  IconDownload,
  IconRefreshCw,
} from '../components/icons'
import Pagination from '../components/Pagination'

const PAGE_SIZE = 20

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

function SummaryCard({
  label,
  value,
  icon: Icon,
  accentClass,
}: {
  label: string
  value: number
  icon: typeof IconBarChart
  accentClass: string
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accentClass}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
          {value.toLocaleString('th-TH')}
        </p>
      </div>
    </div>
  )
}

function firstDayOfMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function Reports() {
  const [jobs, setJobs] = useState<ServiceJob[]>([])
  const [users, setUsers] = useState<UserSummary[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [from, setFrom] = useState(firstDayOfMonth())
  const [to, setTo] = useState(today())
  const [employeeId, setEmployeeId] = useState('')
  const [status, setStatus] = useState<ServiceStatus | ''>('')
  const [customerId, setCustomerId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const [jobData, userData, customerData] = await Promise.all([
          apiFetch<ServiceJob[]>('/api/service-jobs'),
          apiFetch<UserSummary[]>('/api/users'),
          apiFetch<Customer[]>('/api/customers'),
        ])
        setJobs(jobData)
        setUsers(userData)
        setCustomers(customerData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Every project of the chosen customer — active or not, since past jobs may
  // reference a project that's since been deactivated and reports still need it.
  const projectOptions =
    customers.find((customer) => customer.id === customerId)?.projects ?? []

  const filteredJobs = useMemo(
    () =>
      jobs
        .filter((job) => {
          const jobDate = job.reportedAt.slice(0, 10)
          return (!from || jobDate >= from) && (!to || jobDate <= to)
        })
        .filter(
          (job) =>
            !employeeId ||
            job.reporterId === employeeId ||
            job.assignees.some((a) => a.id === employeeId),
        )
        .filter((job) => !status || job.status === status)
        .filter((job) => !customerId || job.customerId === customerId)
        .filter((job) => !projectId || job.projectId === projectId),
    [jobs, from, to, employeeId, status, customerId, projectId],
  )

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE))
  const pagedJobs = filteredJobs.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  function handleFromChange(value: string) {
    setFrom(value)
    setCurrentPage(1)
  }

  function handleToChange(value: string) {
    setTo(value)
    setCurrentPage(1)
  }

  function handleEmployeeChange(value: string) {
    setEmployeeId(value)
    setCurrentPage(1)
  }

  function handleStatusChange(value: ServiceStatus | '') {
    setStatus(value)
    setCurrentPage(1)
  }

  function handleCustomerChange(value: string) {
    setCustomerId(value)
    // A project picked for the previous customer wouldn't belong to this one.
    setProjectId('')
    setCurrentPage(1)
  }

  function handleProjectChange(value: string) {
    setProjectId(value)
    setCurrentPage(1)
  }

  const statusCounts = useMemo(() => {
    const counts: Record<ServiceStatus, number> = {
      NEW: 0,
      IN_PROGRESS: 0,
      ON_HOLD: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    }
    for (const job of filteredJobs) counts[job.status] += 1
    return counts
  }, [filteredJobs])

  async function handleExport() {
    setExporting(true)
    setExportError(null)
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (employeeId) params.set('employeeId', employeeId)
      if (status) params.set('status', status)
      if (customerId) params.set('customerId', customerId)
      if (projectId) params.set('projectId', projectId)
      const blob = await apiFetchBlob(
        `/api/reports/service-jobs/export?${params.toString()}`,
      )
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `รายงานงาน_${from}_ถึง_${to}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'ส่งออกไฟล์ไม่สำเร็จ')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
          รายงาน
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(event) => handleFromChange(event.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
          <span className="text-sm text-gray-400 dark:text-gray-500">ถึง</span>
          <input
            type="date"
            value={to}
            onChange={(event) => handleToChange(event.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
          <select
            value={employeeId}
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
            value={status}
            onChange={(event) =>
              handleStatusChange(event.target.value as ServiceStatus | '')
            }
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
            value={customerId}
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
            value={projectId}
            onChange={(event) => handleProjectChange(event.target.value)}
            disabled={!customerId}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">
              {customerId ? 'ทุกโปรเจค' : 'เลือกลูกค้าก่อน'}
            </option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>
                {formatProjectName(project)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-dark disabled:opacity-60"
          >
            <IconDownload className="h-4 w-4" />
            {exporting ? 'กำลังส่งออก...' : 'Export Excel'}
          </button>
        </div>
      </div>

      {exportError && <p className="text-sm text-brand-red">{exportError}</p>}

      {loading && (
        <p className="text-sm text-gray-400 dark:text-gray-500">กำลังโหลด...</p>
      )}
      {!loading && error && <p className="text-sm text-brand-red">{error}</p>}

      {!loading && !error && (
        <>
          <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard
              label="งานทั้งหมด"
              value={filteredJobs.length}
              icon={IconBarChart}
              accentClass="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
            />
            <SummaryCard
              label="รอดำเนินการ"
              value={statusCounts.NEW}
              icon={IconClock}
              accentClass="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
            />
            <SummaryCard
              label="กำลังดำเนินการ"
              value={statusCounts.IN_PROGRESS}
              icon={IconRefreshCw}
              accentClass="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
            />
            <SummaryCard
              label="เสร็จสิ้น"
              value={statusCounts.COMPLETED}
              icon={IconCheckSquare}
              accentClass="bg-brand-green/10 text-brand-green dark:bg-brand-green/20 dark:text-green-400"
            />
            <SummaryCard
              label="ยกเลิก"
              value={statusCounts.CANCELLED}
              icon={IconClock}
              accentClass="bg-brand-red/10 text-brand-red dark:bg-brand-red/20"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <table className="w-full min-w-[2140px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-gray-200 bg-white text-xs text-gray-400 uppercase dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">ลำดับ</th>
                  <th className="px-4 py-3 font-medium">Job No.</th>
                  <th className="px-4 py-3 font-medium">ลูกค้า</th>
                  <th className="px-4 py-3 font-medium">โปรเจค</th>
                  <th className="px-4 py-3 font-medium">เลขที่สัญญา</th>
                  <th className="px-4 py-3 font-medium">วันเริ่มต้นสัญญา</th>
                  <th className="px-4 py-3 font-medium">วันที่สิ้นสุดสัญญา</th>
                  <th className="px-4 py-3 font-medium">SLA</th>
                  <th className="px-4 py-3 font-medium">หัวข้อ</th>
                  <th className="px-4 py-3 font-medium">รายละเอียด</th>
                  <th className="px-4 py-3 font-medium">ประเภท</th>
                  <th className="px-4 py-3 font-medium">SERVICE TYPE</th>
                  <th className="px-4 py-3 font-medium">สถานะ</th>
                  <th className="px-4 py-3 font-medium">START TIME</th>
                  <th className="px-4 py-3 font-medium">END TIME</th>
                  <th className="px-4 py-3 font-medium">เวลาที่ใช้ทำงาน</th>
                  <th className="px-4 py-3 font-medium">ผู้แจ้ง</th>
                  <th className="px-4 py-3 font-medium">ผู้รับผิดชอบ</th>
                  <th className="px-4 py-3 font-medium">วันที่แจ้ง</th>
                  <th className="px-4 py-3 font-medium">ติดต่อมาจาก</th>
                  <th className="px-4 py-3 font-medium">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredJobs.length === 0 && (
                  <tr>
                    <td
                      colSpan={21}
                      className="px-4 py-6 text-center text-gray-400 dark:text-gray-500"
                    >
                      ไม่พบงานในช่วงเวลานี้
                    </td>
                  </tr>
                )}
                {pagedJobs.map((job, index) => (
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
                      {job.customer.name}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {job.project ? formatProjectName(job.project) : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {job.project?.contractNumber ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {job.project?.contractStartDate
                        ? new Date(
                            job.project.contractStartDate,
                          ).toLocaleDateString('th-TH', {
                            dateStyle: 'medium',
                          })
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {job.project?.contractEndDate
                        ? new Date(
                            job.project.contractEndDate,
                          ).toLocaleDateString('th-TH', {
                            dateStyle: 'medium',
                          })
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {job.sla ? formatSla(job.sla) : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                      {job.title}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-gray-500 dark:text-gray-400">
                      {job.description ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {formatServiceType(job)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {formatServiceCategory(job) || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={statusColors[job.status]}>
                        {statusLabels[job.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {job.startedAt
                        ? new Date(job.startedAt).toLocaleString('th-TH', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {job.completedAt
                        ? new Date(job.completedAt).toLocaleString('th-TH', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {formatDuration(job)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                      {job.reporter.name}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                      {job.assignees.length > 0
                        ? job.assignees.map((a) => a.name).join(', ')
                        : 'ยังไม่มอบหมาย'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(job.reportedAt).toLocaleDateString('th-TH', {
                        dateStyle: 'medium',
                      })}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {job.contactChannel
                        ? contactChannelLabels[job.contactChannel]
                        : '-'}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-gray-500 dark:text-gray-400">
                      {job.remark ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </>
      )}
    </div>
  )
}

export default Reports
