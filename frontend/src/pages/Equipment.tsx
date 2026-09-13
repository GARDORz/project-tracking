import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, apiFetchBlob } from '../lib/api'
import type {
  Customer,
  EquipmentFaultRow,
  EquipmentOverview,
  EquipmentRow,
} from '../lib/types'
import { formatProjectName } from '../lib/projectLabel'
import { SHOW_FAULTY_EQUIPMENT } from '../lib/featureFlags'
import {
  IconAlertTriangle,
  IconBox,
  IconBuilding,
  IconChevronDown,
  IconDownload,
  IconFolder,
  IconRefreshCw,
  IconSearch,
} from '../components/icons'
import Pagination from '../components/Pagination'

const PAGE_SIZE = 30

type EquipmentTab = 'active' | 'faulty'

const inputClass =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'

function SummaryCard({
  label,
  value,
  icon: Icon,
  accentClass,
}: {
  label: string
  value: number
  icon: typeof IconBox
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

function matchesQuery(row: EquipmentRow, query: string): boolean {
  return [row.brand, row.model, row.serialNo, row.description]
    .filter(Boolean)
    .some((field) => field!.toLowerCase().includes(query))
}

function Equipment() {
  const navigate = useNavigate()

  const [data, setData] = useState<EquipmentOverview | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [tab, setTab] = useState<EquipmentTab>('active')
  const [search, setSearch] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [page, setPage] = useState(1)

  const [exporting, setExporting] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [overview, customerList] = await Promise.all([
        apiFetch<EquipmentOverview>('/api/equipment'),
        apiFetch<Customer[]>('/api/customers'),
      ])
      setData(overview)
      setCustomers(customerList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
    load()
  }, [])

  const projectOptions = useMemo(() => {
    const list = customerId
      ? (customers.find((c) => c.id === customerId)?.projects ?? [])
      : customers.flatMap((c) => c.projects)
    return list.slice().sort((a, b) => a.name.localeCompare(b.name, 'th'))
  }, [customers, customerId])

  const rows: (EquipmentRow | EquipmentFaultRow)[] = useMemo(() => {
    if (!data) return []
    const source = tab === 'active' ? data.equipment : data.faults
    const query = search.trim().toLowerCase()
    return source.filter((row) => {
      if (customerId && row.project.customer.id !== customerId) return false
      if (projectId && row.projectId !== projectId) return false
      if (query && !matchesQuery(row, query)) return false
      return true
    })
  }, [data, tab, search, customerId, projectId])

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function handleTabChange(next: EquipmentTab) {
    setTab(next)
    setPage(1)
  }

  function handleCustomerChange(value: string) {
    setCustomerId(value)
    setProjectId('')
    setPage(1)
  }

  async function handleExport() {
    setExporting(true)
    setError(null)
    try {
      const params = new URLSearchParams({ scope: tab })
      if (search.trim()) params.set('search', search.trim())
      if (customerId) params.set('customerId', customerId)
      if (projectId) params.set('projectId', projectId)
      const blob = await apiFetchBlob(
        `/api/equipment/export?${params.toString()}`,
      )
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `equipment-${tab}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ส่งออกไฟล์ไม่สำเร็จ')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-400">กำลังโหลด...</p>
  }
  if (error && !data) {
    return <p className="text-sm text-brand-red">{error}</p>
  }
  if (!data) return null

  const colSpan = tab === 'faulty' ? 7 : 6

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
          อุปกรณ์
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <IconRefreshCw className="h-4 w-4" />
            รีเฟรช
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || rows.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-dark disabled:opacity-60"
          >
            <IconDownload className="h-4 w-4" />
            {exporting ? 'กำลังส่งออก...' : 'Export Excel'}
          </button>
        </div>
      </div>

      {error && <p className="shrink-0 text-sm text-brand-red">{error}</p>}

      <div
        className={`grid shrink-0 grid-cols-2 gap-4 ${
          SHOW_FAULTY_EQUIPMENT ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
        }`}
      >
        <SummaryCard
          label="อุปกรณ์ทั้งหมด"
          value={data.summary.totalEquipment}
          icon={IconBox}
          accentClass="bg-brand-green/10 text-brand-green dark:bg-brand-green/20"
        />
        {SHOW_FAULTY_EQUIPMENT && (
          <SummaryCard
            label="อุปกรณ์เสีย"
            value={data.summary.totalFaults}
            icon={IconAlertTriangle}
            accentClass="bg-brand-red/10 text-brand-red dark:bg-brand-red/20"
          />
        )}
        <SummaryCard
          label="โปรเจคที่มีอุปกรณ์"
          value={data.summary.projectsWithEquipment}
          icon={IconFolder}
          accentClass="bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
        />
        <SummaryCard
          label="ลูกค้าที่มีอุปกรณ์"
          value={data.summary.customersWithEquipment}
          icon={IconBuilding}
          accentClass="bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          {SHOW_FAULTY_EQUIPMENT ? (
            <div className="inline-flex rounded-lg border border-gray-200 p-0.5 text-xs font-medium dark:border-gray-700">
              <button
                type="button"
                onClick={() => handleTabChange('active')}
                className={`rounded-md px-3 py-1.5 ${
                  tab === 'active'
                    ? 'bg-brand-green text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                ทั้งหมด ({data.summary.totalEquipment})
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('faulty')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${
                  tab === 'faulty'
                    ? 'bg-brand-red text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                <IconAlertTriangle className="h-3.5 w-3.5" />
                อุปกรณ์เสีย ({data.summary.totalFaults})
              </button>
            </div>
          ) : (
            <span />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="ค้นหา brand / model / serial / รายละเอียด"
                className={inputClass + ' w-64 py-1.5 pl-8 text-xs'}
              />
            </div>
            <select
              value={customerId}
              onChange={(event) => handleCustomerChange(event.target.value)}
              className={inputClass + ' py-1.5 text-xs'}
            >
              <option value="">ลูกค้าทั้งหมด</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
            <select
              value={projectId}
              onChange={(event) => {
                setProjectId(event.target.value)
                setPage(1)
              }}
              className={inputClass + ' py-1.5 text-xs'}
            >
              <option value="">โปรเจคทั้งหมด</option>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.id}>
                  {formatProjectName(project)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
          {rows.length.toLocaleString('th-TH')} รายการ
        </p>

        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-100 dark:border-gray-700">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 text-xs text-gray-400 uppercase dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">ลูกค้า</th>
                <th className="px-3 py-2 font-medium">โปรเจค</th>
                <th className="px-3 py-2 font-medium">Brand</th>
                <th className="px-3 py-2 font-medium">Model</th>
                <th className="px-3 py-2 font-medium">Serial No.</th>
                <th className="px-3 py-2 font-medium">Description</th>
                {tab === 'faulty' && (
                  <th className="px-3 py-2 font-medium">วันที่แจ้ง</th>
                )}
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={colSpan + 1}
                    className="px-3 py-8 text-center text-sm text-gray-400 dark:text-gray-500"
                  >
                    {data.summary.totalEquipment === 0 &&
                    data.summary.totalFaults === 0
                      ? 'ยังไม่มีอุปกรณ์ในระบบ — เพิ่มได้จากหน้าโปรเจคแต่ละอัน'
                      : 'ไม่พบอุปกรณ์ที่ตรงกับตัวกรอง'}
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/40"
                  >
                    <td className="px-3 py-2.5 text-gray-700 dark:text-gray-200">
                      {row.project.customer.name}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 dark:text-gray-200">
                      {formatProjectName(row.project)}
                    </td>
                    <td className="px-3 py-2.5 text-gray-800 dark:text-gray-100">
                      {row.brand ?? '-'}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 dark:text-gray-200">
                      {row.model ?? '-'}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 dark:text-gray-200">
                      {row.serialNo ?? '-'}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">
                      {row.description ?? '-'}
                    </td>
                    {tab === 'faulty' && (
                      <td className="px-3 py-2.5 whitespace-nowrap text-gray-500 dark:text-gray-400">
                        {new Date(
                          (row as EquipmentFaultRow).reportedAt,
                        ).toLocaleString('th-TH', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/projects/${row.projectId}/equipment`)
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        ไปที่โปรเจค
                        <IconChevronDown className="h-3.5 w-3.5 -rotate-90" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>
    </div>
  )
}

export default Equipment
