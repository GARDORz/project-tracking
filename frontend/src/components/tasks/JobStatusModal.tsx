import { useState } from 'react'
import Modal from '../Modal'
import { apiFetch } from '../../lib/api'
import type { ServiceJob, ServiceStatus } from '../../lib/types'
import { statusLabels } from '../../lib/serviceJobLabels'

interface JobStatusModalProps {
  job: ServiceJob
  onClose: () => void
  onSaved: () => void
}

function JobStatusModal({ job, onClose, onSaved }: JobStatusModalProps) {
  const [status, setStatus] = useState<ServiceStatus>(job.status)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      await apiFetch(`/api/service-jobs/${job.jobNo}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'อัปเดตสถานะไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`อัปเดตสถานะ ${job.jobNo}`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">สถานะ</label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as ServiceStatus)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
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
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-dark disabled:opacity-60"
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default JobStatusModal
