import { useState } from 'react'
import Modal from '../Modal'
import { apiFetch } from '../../lib/api'
import type { UserSummary } from '../../lib/types'

interface UserDeleteModalProps {
  user: UserSummary
  onClose: () => void
  onDeleted: () => void
}

function UserDeleteModal({ user, onClose, onDeleted }: UserDeleteModalProps) {
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setError(null)
    setDeleting(true)
    try {
      await apiFetch(`/api/users/${user.id}`, { method: 'DELETE' })
      onDeleted()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ลบไม่สำเร็จ')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal title="ยืนยันการลบ" onClose={onClose}>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        ต้องการลบผู้ใช้ <span className="font-medium text-gray-800 dark:text-gray-100">{user.userID}</span> —{' '}
        {user.name} ใช่หรือไม่? การลบไม่สามารถย้อนกลับได้
      </p>

      {error && <p className="mt-2 text-sm text-brand-red">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-lg bg-brand-red px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          {deleting ? 'กำลังลบ...' : 'ลบ'}
        </button>
      </div>
    </Modal>
  )
}

export default UserDeleteModal
