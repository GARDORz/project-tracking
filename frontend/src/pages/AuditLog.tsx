import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { getUser } from '../lib/auth'
import type { AuditLogEntry, UserSummary } from '../lib/types'
import Pagination from '../components/Pagination'

const PAGE_SIZE = 50

const inputClass =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'

interface AuditLogResponse {
  entries: AuditLogEntry[]
  total: number
  page: number
  limit: number
}

function actorDisplay(entry: AuditLogEntry): string {
  if (entry.actor) return `${entry.actor.name} (${entry.actor.userID})`
  if (entry.actorLabel) return entry.actorLabel
  return 'ระบบ'
}

// Default the "จาก" filter to midnight of today, so opening the page shows
// today's entries first instead of the entire history at once — the "ถึง"
// side stays empty (no upper bound needed; that already means "up to now").
function startOfTodayLocal(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T00:00`
}

function AuditLog() {
  const isAdmin = getUser()?.role === 'ADMIN'
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [users, setUsers] = useState<UserSummary[]>([])
  const [from, setFrom] = useState(startOfTodayLocal())
  const [to, setTo] = useState('')
  const [actorId, setActorId] = useState('')

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  useEffect(() => {
    if (!isAdmin) return

    async function loadUsers() {
      try {
        setUsers(await apiFetch<UserSummary[]>('/api/users'))
      } catch {
        // Non-critical — the actor filter just has no options if this fails.
      }
    }
    loadUsers()
  }, [isAdmin])

  useEffect(() => {
    if (!isAdmin) return

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        })
        if (from) params.set('from', from)
        if (to) params.set('to', to)
        if (actorId) params.set('actorId', actorId)
        const data = await apiFetch<AuditLogResponse>(
          `/api/audit-log?${params.toString()}`,
        )
        setEntries(data.entries)
        setTotal(data.total)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isAdmin, page, from, to, actorId])

  function handleFromChange(value: string) {
    setFrom(value)
    setPage(1)
  }

  function handleToChange(value: string) {
    setTo(value)
    setPage(1)
  }

  function handleActorChange(value: string) {
    setActorId(value)
    setPage(1)
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-2">
        <p className="text-gray-500 dark:text-gray-400">
          หน้านี้เปิดให้เฉพาะผู้ดูแลระบบ (ADMIN) เท่านั้น
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
          ประวัติการตรวจสอบ
        </h1>
      </div>

      <p className="shrink-0 text-sm text-gray-400 dark:text-gray-500">
        บันทึกเฉพาะการกระทำที่สำคัญ/อ่อนไหว เช่น การลบงาน/ลูกค้า/โปรเจค,
        การแก้ไขสัญญา, การจัดการผู้ใช้งาน, การเข้าสู่ระบบ, การอัปโหลด/ลบไฟล์แนบ
        และการจัดการอุปกรณ์ของโปรเจค (ไม่รวมการดาวน์โหลดหรือเปิดดูไฟล์
        เพราะเกิดบ่อยเกินไปในการใช้งานจริง) —
        ไม่ได้บันทึกทุกการเปลี่ยนแปลงในระบบ
      </p>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <input
          type="datetime-local"
          value={from}
          onChange={(event) => handleFromChange(event.target.value)}
          className={inputClass}
        />
        <span className="text-sm text-gray-400 dark:text-gray-500">ถึง</span>
        <input
          type="datetime-local"
          value={to}
          onChange={(event) => handleToChange(event.target.value)}
          className={inputClass}
        />
        <select
          value={actorId}
          onChange={(event) => handleActorChange(event.target.value)}
          className={inputClass}
        >
          <option value="">ผู้กระทำทุกคน</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} ({user.userID})
            </option>
          ))}
        </select>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-gray-200 bg-white text-xs text-gray-400 uppercase dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">วันที่/เวลา</th>
              <th className="px-4 py-3 font-medium">ผู้กระทำ</th>
              <th className="px-4 py-3 font-medium">รายละเอียด</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-6 text-center text-gray-400 dark:text-gray-500"
                >
                  กำลังโหลด...
                </td>
              </tr>
            )}

            {!loading && error && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-6 text-center text-brand-red"
                >
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && entries.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-6 text-center text-gray-400 dark:text-gray-500"
                >
                  ยังไม่มีบันทึก
                </td>
              </tr>
            )}

            {!loading &&
              !error &&
              entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {new Date(entry.createdAt).toLocaleString('th-TH', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                    {actorDisplay(entry)}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                    {entry.message}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  )
}

export default AuditLog
