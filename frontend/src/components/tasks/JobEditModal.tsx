import { useEffect, useState, type FormEvent } from 'react'
import Modal from '../Modal'
import FormField from '../FormField'
import ServiceTypeSelector from './ServiceTypeSelector'
import ServiceCategorySelector from './ServiceCategorySelector'
import AssigneeSelector from './AssigneeSelector'
import { apiFetch } from '../../lib/api'
import type {
  ContactChannel,
  Customer,
  ServiceCategory,
  ServiceJob,
  UserSummary,
} from '../../lib/types'
import { formatSla } from '../../lib/slaLabel'
import { formatProjectName } from '../../lib/projectLabel'
import { contactChannelLabels } from '../../lib/serviceJobLabels'

interface JobEditModalProps {
  job: ServiceJob
  onClose: () => void
  onSaved: () => void
}

const fieldInputClass =
  'w-full border-0 bg-transparent p-0 text-sm text-gray-900 outline-none focus:ring-0 dark:text-gray-100'

function JobEditModal({ job, onClose, onSaved }: JobEditModalProps) {
  const [users, setUsers] = useState<UserSummary[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [projectOptions, setProjectOptions] = useState<Customer['projects']>([])

  const [projectId, setProjectId] = useState(job.projectId ?? '')
  const [slaId, setSlaId] = useState(job.slaId ?? '')
  const [title, setTitle] = useState(job.title)
  const [description, setDescription] = useState(job.description ?? '')
  const [type, setType] = useState(job.type)
  const [otherText, setOtherText] = useState(job.typeOther ?? '')
  const [serviceCategory, setServiceCategory] = useState<ServiceCategory | ''>(
    job.serviceCategory ?? '',
  )
  const [serviceCategoryOther, setServiceCategoryOther] = useState(
    job.serviceCategoryOther ?? '',
  )
  const [contactChannel, setContactChannel] = useState<ContactChannel | ''>(
    job.contactChannel ?? '',
  )
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    job.assignees.map((a) => a.id),
  )
  const [remark, setRemark] = useState(job.remark ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const selectedProject = projectOptions.find(
    (project) => project.id === projectId,
  )
  // Keep the job's current SLA selectable even if it's since been deactivated,
  // same reasoning as keeping its current (possibly deactivated) project selectable.
  const slaOptions =
    selectedProject?.slaEntries.filter(
      (sla) => sla.isActive || sla.id === job.slaId,
    ) ?? []

  function selectProject(nextProjectId: string) {
    setProjectId(nextProjectId)
    // An SLA picked for the previous project wouldn't belong to this one.
    setSlaId('')
  }

  function toggleAssignee(userId: string) {
    setAssigneeIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    )
  }

  useEffect(() => {
    async function loadOptions() {
      try {
        const [userData, customerData] = await Promise.all([
          apiFetch<UserSummary[]>('/api/users'),
          apiFetch<Customer>(`/api/customers/${job.customerId}`),
        ])
        // SALES doesn't do fieldwork, so exclude them from the assignee picker.
        setUsers(userData.filter((user) => user.role !== 'SALES'))
        // Keep the job's current project selectable even if it's since been deactivated,
        // so editing doesn't silently drop it from the dropdown.
        setProjectOptions(
          customerData.projects.filter(
            (project) => project.isActive || project.id === job.projectId,
          ),
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ')
      } finally {
        setLoadingUsers(false)
      }
    }
    loadOptions()
  }, [job.customerId, job.projectId])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!serviceCategory) {
      setError('กรุณาเลือก SERVICE TYPE')
      return
    }
    setSaving(true)
    try {
      await apiFetch(`/api/service-jobs/${job.jobNo}`, {
        method: 'PATCH',
        body: JSON.stringify({
          projectId: projectId || null,
          slaId: slaId || null,
          title,
          description,
          type,
          typeOther: otherText || null,
          serviceCategory,
          serviceCategoryOther:
            serviceCategory === 'OTHER' ? serviceCategoryOther || null : null,
          contactChannel: contactChannel || null,
          assigneeIds,
          remark,
        }),
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`แก้ไขงาน ${job.jobNo}`} onClose={onClose} size="lg">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <FormField label="โปรเจค (ไม่บังคับ)">
          <select
            value={projectId}
            onChange={(event) => selectProject(event.target.value)}
            className={fieldInputClass}
          >
            <option value="">ไม่ระบุโปรเจค</option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>
                {formatProjectName(project)}
              </option>
            ))}
          </select>
        </FormField>

        {projectId && (
          <FormField label="SLA (ไม่บังคับ)">
            <select
              value={slaId}
              onChange={(event) => setSlaId(event.target.value)}
              disabled={slaOptions.length === 0}
              className={fieldInputClass}
            >
              <option value="">
                {slaOptions.length === 0 ? 'โปรเจคนี้ไม่มี SLA' : 'ไม่ระบุ SLA'}
              </option>
              {slaOptions.map((sla) => (
                <option key={sla.id} value={sla.id}>
                  {formatSla(sla)}
                </option>
              ))}
            </select>
          </FormField>
        )}

        <FormField label="หัวข้อ">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            className={fieldInputClass}
          />
        </FormField>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            ประเภท
          </label>
          <ServiceTypeSelector
            value={type}
            otherText={otherText}
            onChange={setType}
            onOtherTextChange={setOtherText}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            SERVICE TYPE (required)
          </label>
          <ServiceCategorySelector
            value={serviceCategory}
            otherText={serviceCategoryOther}
            onChange={setServiceCategory}
            onOtherTextChange={setServiceCategoryOther}
          />
        </div>

        <FormField label="รายละเอียด">
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            className={fieldInputClass}
          />
        </FormField>

        <FormField label="ติดต่อมาจาก (ไม่บังคับ)">
          <select
            value={contactChannel}
            onChange={(event) =>
              setContactChannel(event.target.value as ContactChannel | '')
            }
            className={fieldInputClass}
          >
            <option value="">ไม่ระบุ</option>
            {(Object.keys(contactChannelLabels) as ContactChannel[]).map(
              (channel) => (
                <option key={channel} value={channel}>
                  {contactChannelLabels[channel]}
                </option>
              ),
            )}
          </select>
        </FormField>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            ผู้รับผิดชอบ (เลือกได้หลายคน)
          </label>
          <AssigneeSelector
            users={users}
            selectedIds={assigneeIds}
            onToggle={toggleAssignee}
            disabled={loadingUsers}
          />
        </div>

        <FormField label="หมายเหตุ">
          <textarea
            value={remark}
            onChange={(event) => setRemark(event.target.value)}
            rows={2}
            className={fieldInputClass}
          />
        </FormField>

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

export default JobEditModal
