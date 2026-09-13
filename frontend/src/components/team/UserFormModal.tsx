import { useState, type FormEvent } from 'react'
import Modal from '../Modal'
import { apiFetch } from '../../lib/api'
import type { Role, UserSummary } from '../../lib/types'

interface UserFormModalProps {
  mode: 'create' | 'edit'
  user?: UserSummary
  onClose: () => void
  onSaved: () => void
}

const inputClass =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-700 dark:disabled:text-gray-500'

function UserFormModal({ mode, user, onClose, onSaved }: UserFormModalProps) {
  const [userID, setUserID] = useState(user?.userID ?? '')
  const [name, setName] = useState(user?.name ?? '')
  const [role, setRole] = useState<Role>(user?.role ?? 'ENGINEERING')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      if (mode === 'create') {
        await apiFetch('/api/users', {
          method: 'POST',
          body: JSON.stringify({ userID, name, password, role }),
        })
      } else if (user) {
        const body: { name: string; role: Role; password?: string } = {
          name,
          role,
        }
        if (password) {
          body.password = password
        }
        await apiFetch(`/api/users/${user.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={
        mode === 'create' ? 'เพิ่มผู้ใช้งาน' : `แก้ไขผู้ใช้งาน ${user?.userID}`
      }
      onClose={onClose}
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            รหัสผู้ใช้ (userID)
          </label>
          <input
            value={userID}
            onChange={(event) => setUserID(event.target.value)}
            required
            disabled={mode === 'edit'}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            ชื่อ
          </label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            รหัสผ่าน{' '}
            {mode === 'edit' && (
              <span className="font-normal text-gray-400 dark:text-gray-500">
                (เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน)
              </span>
            )}
          </label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required={mode === 'create'}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            สิทธิ์ (role)
          </label>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
            className={inputClass}
          >
            <option value="ENGINEERING">ENGINEERING</option>
            <option value="SUPER_ENGINEERING">SUPER ENGINEERING</option>
            <option value="SALES">SALES</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>

        {error && <p className="text-sm text-brand-red">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-dark disabled:opacity-60"
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default UserFormModal
