import { useState } from 'react'
import Modal from '../Modal'
import IconButton from '../IconButton'
import { apiFetch } from '../../lib/api'
import type { Project, ProjectSla } from '../../lib/types'
import { formatSla } from '../../lib/slaLabel'
import { formatProjectName } from '../../lib/projectLabel'
import { IconPencil, IconPlus } from '../icons'

interface ProjectSlaModalProps {
  customerId: string
  project: Project
  onClose: () => void
  onSaved: () => void
}

const inputClass =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'

interface SlaFormValues {
  slaResolutionDays: number
  slaResolutionHours: number
  slaResponseHours: number
}

function SlaFields({
  values,
  onChange,
}: {
  values: SlaFormValues
  onChange: (values: SlaFormValues) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 dark:text-gray-400">
          เวลาแก้ไข (Resolution Time)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            list="sla-days-options"
            value={values.slaResolutionDays}
            onChange={(event) =>
              onChange({
                ...values,
                slaResolutionDays: Number(event.target.value),
              })
            }
            className={`${inputClass} w-full`}
          />
          <datalist id="sla-days-options">
            {[0, 1, 2, 3, 5, 7, 14, 30].map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
            วัน
          </span>
          <input
            type="number"
            min={0}
            list="sla-hours-options"
            value={values.slaResolutionHours}
            onChange={(event) =>
              onChange({
                ...values,
                slaResolutionHours: Number(event.target.value),
              })
            }
            className={`${inputClass} w-full`}
          />
          <datalist id="sla-hours-options">
            {[0, 1, 2, 4, 8, 12, 24].map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
            ชม.
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 dark:text-gray-400">
          เวลาตอบสนอง (Response Time)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            list="sla-response-hours-options"
            value={values.slaResponseHours}
            onChange={(event) =>
              onChange({
                ...values,
                slaResponseHours: Number(event.target.value),
              })
            }
            className={`${inputClass} w-full`}
          />
          <datalist id="sla-response-hours-options">
            {[0, 1, 2, 4, 8, 24].map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
            ชม.
          </span>
        </div>
      </div>
    </div>
  )
}

const emptyValues: SlaFormValues = {
  slaResolutionDays: 0,
  slaResolutionHours: 0,
  slaResponseHours: 0,
}

function ProjectSlaModal({
  customerId,
  project,
  onClose,
  onSaved,
}: ProjectSlaModalProps) {
  const [slaEntries, setSlaEntries] = useState<ProjectSla[]>(project.slaEntries)
  const [newValues, setNewValues] = useState<SlaFormValues>(emptyValues)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<SlaFormValues>(emptyValues)
  const [savingEdit, setSavingEdit] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    setAdding(true)
    setError(null)
    try {
      const created = await apiFetch<ProjectSla>(
        `/api/customers/${customerId}/projects/${project.id}/slas`,
        { method: 'POST', body: JSON.stringify(newValues) },
      )
      setSlaEntries((current) => [...current, created])
      setNewValues(emptyValues)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เพิ่ม SLA ไม่สำเร็จ')
    } finally {
      setAdding(false)
    }
  }

  function startEdit(sla: ProjectSla) {
    setEditingId(sla.id)
    setEditValues({
      slaResolutionDays: sla.slaResolutionDays,
      slaResolutionHours: sla.slaResolutionHours,
      slaResponseHours: sla.slaResponseHours,
    })
  }

  async function handleSaveEdit(slaId: string) {
    setSavingEdit(true)
    setError(null)
    try {
      const updated = await apiFetch<ProjectSla>(
        `/api/customers/${customerId}/projects/${project.id}/slas/${slaId}`,
        { method: 'PATCH', body: JSON.stringify(editValues) },
      )
      setSlaEntries((current) =>
        current.map((s) => (s.id === slaId ? updated : s)),
      )
      setEditingId(null)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'แก้ไข SLA ไม่สำเร็จ')
    } finally {
      setSavingEdit(false)
    }
  }

  async function toggleActive(sla: ProjectSla) {
    setTogglingId(sla.id)
    setError(null)
    try {
      const updated = await apiFetch<ProjectSla>(
        `/api/customers/${customerId}/projects/${project.id}/slas/${sla.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ isActive: !sla.isActive }),
        },
      )
      setSlaEntries((current) =>
        current.map((s) => (s.id === sla.id ? updated : s)),
      )
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <Modal
      title={`SLA — ${formatProjectName(project)}`}
      onClose={onClose}
      size="lg"
    >
      <div className="flex flex-col gap-4">
        {slaEntries.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">
            ยังไม่มี SLA สำหรับโปรเจคนี้
          </p>
        ) : (
          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
            {slaEntries.map((sla) => (
              <div
                key={sla.id}
                className="rounded-lg border border-gray-200 p-3 dark:border-gray-600"
              >
                {editingId === sla.id ? (
                  <div className="flex flex-col gap-2">
                    <SlaFields values={editValues} onChange={setEditValues} />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(sla.id)}
                        disabled={savingEdit}
                        className="rounded-lg bg-brand-green px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-green-dark disabled:opacity-60"
                      >
                        {savingEdit ? 'กำลังบันทึก...' : 'บันทึก'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm font-medium ${
                          sla.isActive
                            ? 'text-gray-800 dark:text-gray-100'
                            : 'text-gray-400 line-through dark:text-gray-500'
                        }`}
                      >
                        {formatSla(sla)}
                      </p>
                      {!sla.isActive && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          ปิดใช้งาน
                        </span>
                      )}
                    </div>
                    <IconButton label="แก้ไข" onClick={() => startEdit(sla)}>
                      <IconPencil className="h-4 w-4" />
                    </IconButton>
                    <button
                      type="button"
                      onClick={() => toggleActive(sla)}
                      disabled={togglingId === sla.id}
                      className="shrink-0 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      {sla.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-600">
          <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            <IconPlus className="h-4 w-4" />
            เพิ่ม SLA ใหม่
          </span>
          <SlaFields values={newValues} onChange={setNewValues} />
          <p className="text-xs text-gray-400 dark:text-gray-500">
            เลือกจากตัวเลขที่แนะนำ หรือพิมพ์ตัวเลขเองก็ได้
          </p>
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding}
            className="self-end rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-dark disabled:opacity-60"
          >
            {adding ? 'กำลังเพิ่ม...' : 'เพิ่ม SLA'}
          </button>
        </div>

        {error && <p className="text-sm text-brand-red">{error}</p>}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            ปิด
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default ProjectSlaModal
