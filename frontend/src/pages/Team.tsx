import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { getUser } from '../lib/auth'
import type { UserSummary } from '../lib/types'
import { roleColors, roleLabels } from '../lib/userLabels'
import IconButton from '../components/IconButton'
import Pagination from '../components/Pagination'
import { IconPencil, IconPlus, IconTrash } from '../components/icons'
import UserFormModal from '../components/team/UserFormModal'
import UserDeleteModal from '../components/team/UserDeleteModal'

const PAGE_SIZE = 20

type ActiveModal =
  | { type: 'create' }
  | { type: 'edit'; user: UserSummary }
  | { type: 'delete'; user: UserSummary }
  | null

function Team() {
  const [users, setUsers] = useState<UserSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)
  const [page, setPage] = useState(1)
  const currentUser = getUser()
  const isAdmin = currentUser?.role === 'ADMIN'

  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE))
  // Clamp rather than trust `page` directly — deleting users can shrink totalPages
  // below whatever page the user was previously sitting on.
  const currentPage = Math.min(page, totalPages)
  const pagedUsers = users.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  async function loadUsers() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<UserSummary[]>('/api/users')
      setUsers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
    loadUsers()
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">ทีม</h1>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveModal({ type: 'create' })}
            className="flex items-center gap-1.5 rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-dark"
          >
            <IconPlus className="h-4 w-4" />
            เพิ่มผู้ใช้งาน
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-gray-200 bg-white text-xs text-gray-400 uppercase dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">ลำดับ</th>
              <th className="px-4 py-3 font-medium">รหัสผู้ใช้</th>
              <th className="px-4 py-3 font-medium">ชื่อ</th>
              <th className="px-4 py-3 font-medium">สิทธิ์</th>
              <th className="px-4 py-3 font-medium">วันที่สร้าง</th>
              <th className="px-4 py-3 font-medium">การจัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400 dark:text-gray-500">
                  กำลังโหลด...
                </td>
              </tr>
            )}

            {!loading && error && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-brand-red">
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400 dark:text-gray-500">
                  ยังไม่มีผู้ใช้งาน
                </td>
              </tr>
            )}

            {!loading &&
              !error &&
              pagedUsers.map((user, index) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {(currentPage - 1) * PAGE_SIZE + index + 1}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{user.userID}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{user.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${roleColors[user.role]}`}
                    >
                      {roleLabels[user.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {new Date(user.createdAt).toLocaleDateString('th-TH', { dateStyle: 'medium' })}
                  </td>
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <div className="flex items-center gap-1">
                        <IconButton
                          label="แก้ไข"
                          onClick={() => setActiveModal({ type: 'edit', user })}
                        >
                          <IconPencil className="h-4 w-4" />
                        </IconButton>
                        {user.id !== currentUser?.id && (
                          <IconButton
                            label="ลบ"
                            variant="danger"
                            onClick={() => setActiveModal({ type: 'delete', user })}
                          >
                            <IconTrash className="h-4 w-4" />
                          </IconButton>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-600">-</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />

      {activeModal?.type === 'create' && (
        <UserFormModal mode="create" onClose={() => setActiveModal(null)} onSaved={loadUsers} />
      )}
      {activeModal?.type === 'edit' && (
        <UserFormModal
          mode="edit"
          user={activeModal.user}
          onClose={() => setActiveModal(null)}
          onSaved={loadUsers}
        />
      )}
      {activeModal?.type === 'delete' && (
        <UserDeleteModal
          user={activeModal.user}
          onClose={() => setActiveModal(null)}
          onDeleted={loadUsers}
        />
      )}
    </div>
  )
}

export default Team
