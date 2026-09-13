import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { getUser } from '../lib/auth'
import type { ServiceJob, ServiceStatus, ServiceType } from '../lib/types'
import StatCard from '../components/dashboard/StatCard'
import StatusDonutChart from '../components/dashboard/StatusDonutChart'
import TypeBarChart from '../components/dashboard/TypeBarChart'
import {
  IconBarChart,
  IconCheckSquare,
  IconClock,
  IconRefreshCw,
  IconUser,
} from '../components/icons'

const emptyStatusCounts: Record<ServiceStatus, number> = {
  NEW: 0,
  IN_PROGRESS: 0,
  ON_HOLD: 0,
  COMPLETED: 0,
  CANCELLED: 0,
}

const emptyTypeCounts: Record<ServiceType, number> = {
  WARRANTY: 0,
  MA_SERVICE: 0,
  PERCALL: 0,
  OTHER: 0,
}

function Dashboard() {
  const navigate = useNavigate()
  const currentUser = getUser()
  const [jobs, setJobs] = useState<ServiceJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadJobs() {
      try {
        setJobs(await apiFetch<ServiceJob[]>('/api/service-jobs'))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ')
      } finally {
        setLoading(false)
      }
    }
    loadJobs()
  }, [])

  const statusCounts = useMemo(() => {
    const counts = { ...emptyStatusCounts }
    for (const job of jobs) counts[job.status] += 1
    return counts
  }, [jobs])

  const typeCounts = useMemo(() => {
    const counts = { ...emptyTypeCounts }
    for (const job of jobs) counts[job.type] += 1
    return counts
  }, [jobs])

  const myJobsCount = useMemo(
    () =>
      jobs.filter(
        (job) =>
          job.reporterId === currentUser?.id ||
          job.assignees.some((a) => a.id === currentUser?.id),
      ).length,
    [jobs, currentUser?.id],
  )

  function goToTasks(status?: ServiceStatus) {
    navigate(status ? `/tasks?status=${status}` : '/tasks')
  }

  if (loading) {
    return <p className="text-sm text-gray-400">กำลังโหลด...</p>
  }

  if (error) {
    return <p className="text-sm text-brand-red">{error}</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">หน้าหลัก</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="งานทั้งหมด"
          value={jobs.length}
          icon={IconBarChart}
          accentClass="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
          onClick={() => goToTasks()}
        />
        <StatCard
          label="งานของฉัน"
          value={myJobsCount}
          icon={IconUser}
          accentClass="bg-brand-yellow/20 text-amber-700 dark:text-amber-400"
          onClick={() => navigate('/tasks?mine=1')}
        />
        <StatCard
          label="รอดำเนินการ"
          value={statusCounts.NEW}
          icon={IconClock}
          accentClass="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
          onClick={() => goToTasks('NEW')}
        />
        <StatCard
          label="กำลังดำเนินการ"
          value={statusCounts.IN_PROGRESS}
          icon={IconRefreshCw}
          accentClass="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
          onClick={() => goToTasks('IN_PROGRESS')}
        />
        <StatCard
          label="เสร็จสิ้น"
          value={statusCounts.COMPLETED}
          icon={IconCheckSquare}
          accentClass="bg-brand-green/10 text-brand-green dark:bg-brand-green/20 dark:text-green-400"
          onClick={() => goToTasks('COMPLETED')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-200">สัดส่วนสถานะงาน</h2>
          <StatusDonutChart counts={statusCounts} />
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-200">จำนวนงานตามประเภท</h2>
          <TypeBarChart counts={typeCounts} />
        </div>
      </div>
    </div>
  )
}

export default Dashboard
