import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { PublicServiceJob, ServiceStatus } from '../lib/types'
import { typeLabels } from '../lib/serviceJobLabels'
import { IconCheck, IconClock, IconRefreshCw, IconX } from '../components/icons'

const POLL_INTERVAL_MS = 20000

const steps: { status: ServiceStatus; label: string }[] = [
  { status: 'NEW', label: 'รับเรื่องแล้ว' },
  { status: 'IN_PROGRESS', label: 'กำลังดำเนินการ' },
  { status: 'COMPLETED', label: 'เสร็จสิ้น' },
]

function stepIndexForStatus(status: ServiceStatus) {
  if (status === 'NEW') return 0
  if (status === 'IN_PROGRESS' || status === 'ON_HOLD') return 1
  if (status === 'COMPLETED') return 2
  return -1
}

function TrackJob() {
  const { shareToken } = useParams<{ shareToken: string }>()
  const [job, setJob] = useState<PublicServiceJob | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const response = await fetch(`/api/public/service-jobs/${shareToken}`)
        if (cancelled) return
        if (!response.ok) {
          setNotFound(true)
        } else {
          setJob(await response.json())
          setLastChecked(new Date())
        }
      } catch {
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    const interval = setInterval(load, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [shareToken])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">กำลังโหลด...</p>
      </div>
    )
  }

  if (notFound || !job) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm">
          <img src="/logo_1.png" alt="Syscomp" className="mx-auto mb-4 h-16 w-16 object-contain" />
          <p className="text-gray-600">ไม่พบข้อมูลงานนี้ ลิงก์อาจไม่ถูกต้องหรือหมดอายุ</p>
        </div>
      </div>
    )
  }

  const currentIndex = stepIndexForStatus(job.status)
  const isCancelled = job.status === 'CANCELLED'
  const isOnHold = job.status === 'ON_HOLD'

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <img src="/logo_1.png" alt="Syscomp" className="h-14 w-14 object-contain" />
          <p className="text-xs text-gray-400">ติดตามสถานะงานบริการ</p>
        </div>

        <div className="mb-6 rounded-xl bg-gray-50 p-4">
          <p className="text-xs text-gray-400">Job No.</p>
          <p className="font-medium text-gray-800">{job.jobNo}</p>
          <p className="mt-2 text-xs text-gray-400">หัวข้อ</p>
          <p className="font-medium text-gray-800">{job.title}</p>
          <p className="mt-2 text-xs text-gray-400">ลูกค้า</p>
          <p className="font-medium text-gray-800">{job.customer.name}</p>
          <p className="mt-2 text-xs text-gray-400">ประเภทงาน</p>
          <p className="font-medium text-gray-800">{typeLabels[job.type]}</p>
        </div>

        {isCancelled ? (
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-brand-red/10 p-4">
            <IconX className="h-6 w-6 shrink-0 text-brand-red" />
            <p className="text-sm font-medium text-brand-red">งานนี้ถูกยกเลิกแล้ว</p>
          </div>
        ) : (
          <div className="mb-6">
            {isOnHold && (
              <p className="mb-3 rounded-lg bg-brand-yellow/20 px-3 py-2 text-center text-xs font-medium text-amber-700">
                งานถูกพักไว้ชั่วคราว
              </p>
            )}
            <div className="flex items-start">
              {steps.map((step, index) => {
                const done = index < currentIndex
                const active = index === currentIndex
                const Icon = done ? IconCheck : index === 0 ? IconClock : IconRefreshCw
                return (
                  <div key={step.status} className="contents">
                    <div className="flex w-16 shrink-0 flex-col items-center">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          done || active
                            ? isOnHold && active
                              ? 'bg-brand-yellow/30 text-amber-700'
                              : 'bg-brand-green text-white'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <p
                        className={`mt-2 text-center text-xs ${
                          done || active ? 'font-medium text-gray-800' : 'text-gray-400'
                        }`}
                      >
                        {step.label}
                      </p>
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={`mt-4 h-0.5 flex-1 ${index < currentIndex ? 'bg-brand-green' : 'bg-gray-100'}`}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {job.remark && (
          <div className="mb-4 rounded-xl border border-gray-200 p-4">
            <p className="mb-1 text-xs text-gray-400">หมายเหตุ</p>
            <p className="text-sm text-gray-700">{job.remark}</p>
          </div>
        )}

        <p className="text-center text-xs text-gray-300">
          อัปเดตล่าสุด{' '}
          {lastChecked?.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

export default TrackJob
