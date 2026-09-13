import { useState, type FormEvent } from 'react'
import Modal from '../Modal'
import { apiFetch } from '../../lib/api'
import type { Project } from '../../lib/types'

interface ProjectFormModalProps {
  customerId: string
  project?: Project
  onClose: () => void
  onSaved: () => void
}

const inputClass =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'

function ProjectFormModal({
  customerId,
  project,
  onClose,
  onSaved,
}: ProjectFormModalProps) {
  const [name, setName] = useState(project?.name ?? '')
  const [projectYear, setProjectYear] = useState(project?.projectYear ?? '')
  const [contractNumber, setContractNumber] = useState(
    project?.contractNumber ?? '',
  )
  const [contractStartDate, setContractStartDate] = useState(
    project?.contractStartDate?.slice(0, 10) ?? '',
  )
  const [contractEndDate, setContractEndDate] = useState(
    project?.contractEndDate?.slice(0, 10) ?? '',
  )
  const [contractNotifyMonths, setContractNotifyMonths] = useState(
    project?.contractNotifyMonths ?? 1,
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const body = {
        name,
        projectYear: projectYear.trim() || null,
        contractNumber: contractNumber || null,
        contractStartDate: contractStartDate || null,
        contractEndDate: contractEndDate || null,
        contractNotifyMonths,
      }
      if (project) {
        await apiFetch(`/api/customers/${customerId}/projects/${project.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      } else {
        await apiFetch(`/api/customers/${customerId}/projects`, {
          method: 'POST',
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
    <Modal title={project ? 'แก้ไขโปรเจค' : 'เพิ่มโปรเจค'} onClose={onClose}>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            ชื่อโปรเจค
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
            ปี
          </label>
          <input
            value={projectYear}
            onChange={(event) => setProjectYear(event.target.value)}
            placeholder="เช่น 2568"
            className={inputClass}
          />
          <p className="text-xs text-gray-400 dark:text-gray-500">
            ข้อความนี้จะแสดงในวงเล็บต่อท้ายชื่อโปรเจค
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-600">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            สัญญา
          </span>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">
              เลขที่สัญญา
            </label>
            <input
              value={contractNumber}
              onChange={(event) => setContractNumber(event.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">
                วันเริ่มต้นสัญญา
              </label>
              <input
                type="date"
                value={contractStartDate}
                onChange={(event) => setContractStartDate(event.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">
                วันที่สิ้นสุดสัญญา
              </label>
              <input
                type="date"
                value={contractEndDate}
                onChange={(event) => setContractEndDate(event.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">
              แจ้งเตือนล่วงหน้าก่อนหมดสัญญา
            </label>
            <select
              value={contractNotifyMonths}
              onChange={(event) =>
                setContractNotifyMonths(Number(event.target.value))
              }
              className={inputClass}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {month} เดือน
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              ถ้าไม่เลือก ระบบจะใช้ค่าเริ่มต้น 1 เดือน — จะแจ้งเตือน ADMIN
              ทุกคนและผู้รับผิดชอบงานล่าสุดของโปรเจคนี้ทุกคืนตั้งแต่เข้าช่วงเวลาที่ตั้งไว้จนถึงวันที่สิ้นสุดสัญญา
            </p>
          </div>
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

export default ProjectFormModal
