import { useState, type FormEvent } from 'react'
import Modal from '../Modal'
import { apiFetch } from '../../lib/api'
import type { Project } from '../../lib/types'
import { formatProjectName } from '../../lib/projectLabel'

interface ProjectDuplicateModalProps {
  customerId: string
  project: Project
  onClose: () => void
  onDuplicated: () => void
}

const inputClass =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'

function ProjectDuplicateModal({
  customerId,
  project,
  onClose,
  onDuplicated,
}: ProjectDuplicateModalProps) {
  const [projectYear, setProjectYear] = useState(project.projectYear ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await apiFetch(
        `/api/customers/${customerId}/projects/${project.id}/duplicate`,
        {
          method: 'POST',
          body: JSON.stringify({ projectYear: projectYear.trim() || null }),
        },
      )
      onDuplicated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'คัดลอกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`คัดลอกโปรเจค — ${formatProjectName(project)}`}
      onClose={onClose}
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          จะสร้างโปรเจคใหม่โดยคัดลอกชื่อ, เลขที่/วันที่สัญญา, SLA และรายการ
          อุปกรณ์ทั้งหมดของโปรเจคนี้ (ไม่รวมไฟล์แนบ) — โปรเจคใหม่จะเปิดใช้งาน
          เสมอ ระบุแค่ปีของโปรเจคใหม่ด้านล่าง
        </p>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            ปี (ไม่บังคับ)
          </label>
          <input
            autoFocus
            value={projectYear}
            onChange={(event) => setProjectYear(event.target.value)}
            placeholder="เช่น 2569"
            className={inputClass}
          />
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
            {saving ? 'กำลังคัดลอก...' : 'คัดลอก'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default ProjectDuplicateModal
