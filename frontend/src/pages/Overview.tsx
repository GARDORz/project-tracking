import { useEffect, useMemo, useState } from 'react'
import { apiFetch, apiFetchBlob } from '../lib/api'
import { getUser } from '../lib/auth'
import type { OverviewReport } from '../lib/types'
import {
  formatDurationStat,
  formatSeconds,
  typeLabels,
} from '../lib/serviceJobLabels'
import { roleColors, roleLabels } from '../lib/userLabels'
import StatCard from '../components/dashboard/StatCard'
import {
  IconBarChart,
  IconDownload,
  IconUser,
  IconUsers,
} from '../components/icons'

const typeOrder = ['WARRANTY', 'MA_SERVICE', 'PERCALL', 'OTHER'] as const

function isEngineer(role: string): boolean {
  return role === 'ENGINEERING' || role === 'SUPER_ENGINEERING'
}

function toLocalInputValue(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

// Defaults to "this month so far" — a report page, not a scrolling log, so a
// wide-open range is the more useful starting point than just today.
function startOfMonthLocal(): string {
  const now = new Date()
  return toLocalInputValue(new Date(now.getFullYear(), now.getMonth(), 1))
}

function Overview() {
  const currentRole = getUser()?.role
  const canView = currentRole === 'ADMIN' || currentRole === 'SUPER_ENGINEERING'
  const [report, setReport] = useState<OverviewReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [onlyEngineers, setOnlyEngineers] = useState(false)
  const [from, setFrom] = useState(startOfMonthLocal())
  const [to, setTo] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  useEffect(() => {
    if (!canView) return

    async function load() {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (from) params.set('from', from)
        if (to) params.set('to', to)
        setReport(
          await apiFetch<OverviewReport>(
            `/api/reports/overview?${params.toString()}`,
          ),
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ')
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- canView never changes mid-session
  }, [from, to])

  const visibleByPerson = useMemo(
    () =>
      report
        ? onlyEngineers
          ? report.byPerson.filter((p) => isEngineer(p.role))
          : report.byPerson
        : [],
    [report, onlyEngineers],
  )

  const visibleByPersonType = useMemo(
    () =>
      report
        ? onlyEngineers
          ? report.byPersonType.filter((p) => isEngineer(p.role))
          : report.byPersonType
        : [],
    [report, onlyEngineers],
  )

  async function handleExport() {
    setExporting(true)
    setExportError(null)
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (onlyEngineers) params.set('onlyEngineers', '1')
      const blob = await apiFetchBlob(
        `/api/reports/overview/export?${params.toString()}`,
      )
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const rangeSuffix =
        from || to ? `_${from || 'เริ่มต้น'}_ถึง_${to || 'ปัจจุบัน'}` : ''
      link.download = `รายงานภาพรวม${rangeSuffix}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'ส่งออกไฟล์ไม่สำเร็จ')
    } finally {
      setExporting(false)
    }
  }

  if (!canView) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-2">
        <p className="text-gray-500 dark:text-gray-400">
          หน้านี้เปิดให้เฉพาะผู้ดูแลระบบและหัวหน้าวิศวกรเท่านั้น
        </p>
      </div>
    )
  }

  if (loading) {
    return <p className="text-sm text-gray-400">กำลังโหลด...</p>
  }

  if (error || !report) {
    return (
      <p className="text-sm text-brand-red">{error ?? 'โหลดข้อมูลไม่สำเร็จ'}</p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
          ภาพรวม
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <input
              type="datetime-local"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            <span className="text-sm text-gray-400 dark:text-gray-500">
              ถึง
            </span>
            <input
              type="datetime-local"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <button
            type="button"
            onClick={() => setOnlyEngineers((current) => !current)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              onlyEngineers
                ? 'border-brand-green bg-brand-green text-white'
                : 'border-gray-300 text-gray-600 hover:border-brand-green hover:text-brand-green dark:border-gray-600 dark:text-gray-300'
            }`}
          >
            เฉพาะช่าง
          </button>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="งานทั้งหมด"
          value={report.totals.totalJobs}
          icon={IconBarChart}
          accentClass="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
          onClick={() => {}}
        />
        <StatCard
          label="ช่างทั้งหมด"
          value={report.totals.totalEngineers}
          icon={IconUsers}
          accentClass="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
          onClick={() => {}}
        />
        <StatCard
          label="แอดมินทั้งหมด"
          value={report.totals.totalAdmins}
          icon={IconUser}
          accentClass="bg-brand-green/10 text-brand-green dark:bg-brand-green/20 dark:text-green-400"
          onClick={() => {}}
        />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-200">
          งานรายบุคคล
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-gray-200 text-xs text-gray-400 uppercase dark:border-gray-700 dark:text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">ชื่อ</th>
                <th className="px-3 py-2 font-medium">บทบาท</th>
                <th className="px-3 py-2 font-medium">รอดำเนินการ</th>
                <th className="px-3 py-2 font-medium">กำลังดำเนินการ</th>
                <th className="px-3 py-2 font-medium">พักงาน</th>
                <th className="px-3 py-2 font-medium">เสร็จแล้ว</th>
                <th className="px-3 py-2 font-medium">ยกเลิก</th>
                <th className="px-3 py-2 font-medium">รวม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {visibleByPerson.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-6 text-center text-gray-400 dark:text-gray-500"
                  >
                    ยังไม่มีข้อมูล
                  </td>
                </tr>
              )}
              {visibleByPerson.map((person) => (
                <tr key={person.userId}>
                  <td className="px-3 py-2.5 font-medium text-gray-800 dark:text-gray-100">
                    {person.name}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${roleColors[person.role]}`}
                    >
                      {roleLabels[person.role]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">
                    {person.newJobs.toLocaleString('th-TH')}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">
                    {person.inProgressJobs.toLocaleString('th-TH')}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">
                    {person.onHoldJobs.toLocaleString('th-TH')}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">
                    {person.completedJobs.toLocaleString('th-TH')}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">
                    {person.cancelledJobs.toLocaleString('th-TH')}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-gray-800 dark:text-gray-100">
                    {person.totalJobs.toLocaleString('th-TH')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-200">
          เวลาทำงานเฉลี่ยต่อประเภทงาน (เฉพาะงานที่เสร็จสิ้นแล้ว)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="border-b border-gray-200 text-xs text-gray-400 uppercase dark:border-gray-700 dark:text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">ประเภทงาน</th>
                <th className="px-3 py-2 font-medium">เวลาเฉลี่ย</th>
                <th className="px-3 py-2 font-medium">จำนวนงานที่ใช้คำนวณ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {report.avgDurationByType.map((row) => (
                <tr key={row.type}>
                  <td className="px-3 py-2.5 text-gray-700 dark:text-gray-200">
                    {typeLabels[row.type]}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-gray-800 dark:text-gray-100">
                    {row.avgSeconds !== null
                      ? formatSeconds(row.avgSeconds)
                      : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">
                    {row.sampleCount.toLocaleString('th-TH')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-200">
          เวลาทำงานเฉลี่ยต่อประเภทงาน แยกตามคน (เฉพาะงานที่เสร็จสิ้นแล้ว)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-gray-200 text-xs text-gray-400 uppercase dark:border-gray-700 dark:text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">ชื่อ</th>
                <th className="px-3 py-2 font-medium">บทบาท</th>
                {typeOrder.map((type) => (
                  <th key={type} className="px-3 py-2 font-medium">
                    {typeLabels[type]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {visibleByPersonType.length === 0 && (
                <tr>
                  <td
                    colSpan={2 + typeOrder.length}
                    className="px-3 py-6 text-center text-gray-400 dark:text-gray-500"
                  >
                    ยังไม่มีข้อมูล
                  </td>
                </tr>
              )}
              {visibleByPersonType.map((person) => (
                <tr key={person.userId}>
                  <td className="px-3 py-2.5 font-medium text-gray-800 dark:text-gray-100">
                    {person.name}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${roleColors[person.role]}`}
                    >
                      {roleLabels[person.role]}
                    </span>
                  </td>
                  {typeOrder.map((type) => (
                    <td
                      key={type}
                      className="px-3 py-2.5 text-gray-500 dark:text-gray-400"
                    >
                      {formatDurationStat(person.durations[type])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Overview
