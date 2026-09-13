import { useState, type FormEvent } from 'react'
import { getUser } from '../lib/auth'
import { apiFetch } from '../lib/api'
import { roleLabels } from '../lib/userLabels'
import { getTheme, setTheme as applyTheme, type Theme } from '../lib/theme'
import FormField from '../components/FormField'
import { IconMoon, IconSun } from '../components/icons'

const fieldInputClass =
  'w-full border-0 bg-transparent p-0 text-sm text-gray-900 outline-none focus:ring-0 dark:text-gray-100'

function Settings() {
  const user = getUser()
  const [theme, setThemeState] = useState<Theme>(getTheme())

  function handleThemeChange(next: Theme) {
    applyTheme(next)
    setThemeState(next)
  }

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(false)

    if (newPassword !== confirmPassword) {
      setError('รหัสผ่านใหม่และรหัสผ่านยืนยันไม่ตรงกัน')
      return
    }
    if (newPassword.length < 6) {
      setError('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร')
      return
    }

    setSaving(true)
    try {
      await apiFetch('/api/users/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เปลี่ยนรหัสผ่านไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">ตั้งค่า</h1>

      <div className="max-w-lg rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-200">บัญชีของฉัน</h2>
        <div className="mb-6 flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">รหัสผู้ใช้</span>
            <span className="font-medium text-gray-800 dark:text-gray-100">{user?.userID ?? '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">ชื่อ</span>
            <span className="font-medium text-gray-800 dark:text-gray-100">{user?.name ?? '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">สิทธิ์</span>
            <span className="font-medium text-gray-800 dark:text-gray-100">
              {user ? roleLabels[user.role] : '-'}
            </span>
          </div>
        </div>

        <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-200">เปลี่ยนรหัสผ่าน</h2>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <FormField label="รหัสผ่านเดิม">
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              className={fieldInputClass}
            />
          </FormField>

          <FormField label="รหัสผ่านใหม่">
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              minLength={6}
              className={fieldInputClass}
            />
          </FormField>

          <FormField label="ยืนยันรหัสผ่านใหม่">
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={6}
              className={fieldInputClass}
            />
          </FormField>

          {error && <p className="text-sm text-brand-red">{error}</p>}
          {success && <p className="text-sm text-brand-green">เปลี่ยนรหัสผ่านสำเร็จ</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-dark disabled:opacity-60"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>

      <div className="max-w-lg rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-200">ธีม</h2>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleThemeChange('light')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition ${
              theme === 'light'
                ? 'border-brand-green bg-brand-green text-white'
                : 'border-gray-300 text-gray-600 hover:border-brand-green hover:text-brand-green dark:border-gray-600 dark:text-gray-300'
            }`}
          >
            <IconSun className="h-4 w-4" />
            สว่าง
          </button>
          <button
            type="button"
            onClick={() => handleThemeChange('dark')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition ${
              theme === 'dark'
                ? 'border-brand-green bg-brand-green text-white'
                : 'border-gray-300 text-gray-600 hover:border-brand-green hover:text-brand-green dark:border-gray-600 dark:text-gray-300'
            }`}
          >
            <IconMoon className="h-4 w-4" />
            มืด
          </button>
        </div>
      </div>
    </div>
  )
}

export default Settings
