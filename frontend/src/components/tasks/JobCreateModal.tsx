import { useEffect, useState, type FormEvent } from 'react'
import Modal from '../Modal'
import FormField from '../FormField'
import ServiceTypeSelector from './ServiceTypeSelector'
import ServiceCategorySelector from './ServiceCategorySelector'
import AssigneeSelector from './AssigneeSelector'
import { apiFetch } from '../../lib/api'
import { getUser } from '../../lib/auth'
import type {
  ContactChannel,
  Customer,
  ServiceCategory,
  ServiceType,
  UserSummary,
} from '../../lib/types'
import { formatSla } from '../../lib/slaLabel'
import { formatProjectName } from '../../lib/projectLabel'
import { contactChannelLabels } from '../../lib/serviceJobLabels'

interface JobCreateModalProps {
  onClose: () => void
  onSaved: () => void
}

const fieldInputClass =
  'w-full border-0 bg-transparent p-0 text-sm text-gray-900 outline-none focus:ring-0 dark:text-gray-100'

function JobCreateModal({ onClose, onSaved }: JobCreateModalProps) {
  const reporter = getUser()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [users, setUsers] = useState<UserSummary[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)

  const [customerId, setCustomerId] = useState('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [showCustomerOptions, setShowCustomerOptions] = useState(false)
  const [projectId, setProjectId] = useState('')
  const [slaId, setSlaId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<ServiceType>('WARRANTY')
  const [otherText, setOtherText] = useState('')
  const [serviceCategory, setServiceCategory] = useState<ServiceCategory | ''>(
    '',
  )
  const [serviceCategoryOther, setServiceCategoryOther] = useState('')
  const [contactChannel, setContactChannel] = useState<ContactChannel | ''>('')
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    reporter ? [reporter.id] : [],
  )
  const [remark, setRemark] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const customerOptions = customers.filter((customer) =>
    customer.name.toLowerCase().includes(customerQuery.trim().toLowerCase()),
  )

  function selectCustomer(customer: Customer) {
    setCustomerId(customer.id)
    setCustomerQuery(customer.name)
    setShowCustomerOptions(false)
    // A project picked for the previous customer wouldn't belong to this one.
    setProjectId('')
    setSlaId('')
  }

  function selectProject(nextProjectId: string) {
    setProjectId(nextProjectId)
    // An SLA picked for the previous project wouldn't belong to this one.
    setSlaId('')
  }

  const selectedCustomer = customers.find(
    (customer) => customer.id === customerId,
  )
  const projectOptions =
    selectedCustomer?.projects.filter((project) => project.isActive) ?? []
  const selectedProject = projectOptions.find(
    (project) => project.id === projectId,
  )
  const slaOptions =
    selectedProject?.slaEntries.filter((sla) => sla.isActive) ?? []

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
        const [customerData, userData] = await Promise.all([
          apiFetch<Customer[]>('/api/customers'),
          apiFetch<UserSummary[]>('/api/users'),
        ])
        // Hidden customers stay manageable on the Customers page but shouldn't be
        // selectable for new jobs.
        setCustomers(customerData.filter((customer) => customer.isActive))
        // SALES doesn't do fieldwork, so exclude them from the assignee picker.
        setUsers(userData.filter((user) => user.role !== 'SALES'))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ')
      } finally {
        setLoadingOptions(false)
      }
    }
    loadOptions()
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!customerId) {
      setError('กรุณาเลือกลูกค้าจากรายการ')
      return
    }
    if (!serviceCategory) {
      setError('กรุณาเลือก SERVICE TYPE')
      return
    }
    setSaving(true)
    try {
      await apiFetch('/api/service-jobs', {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          projectId: projectId || undefined,
          slaId: slaId || undefined,
          title,
          description: description || undefined,
          type,
          typeOther: otherText || undefined,
          serviceCategory,
          serviceCategoryOther:
            serviceCategory === 'OTHER'
              ? serviceCategoryOther || undefined
              : undefined,
          contactChannel: contactChannel || undefined,
          assigneeIds,
          remark: remark || undefined,
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
    <Modal title="เพิ่มงานใหม่" onClose={onClose} size="lg">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <FormField label="ผู้แจ้ง">
          <p className="text-sm text-gray-700 dark:text-gray-200">
            {reporter?.name ?? '-'}
          </p>
        </FormField>

        <FormField label="ลูกค้า (required)">
          <div className="relative">
            <input
              value={customerQuery}
              onChange={(event) => {
                setCustomerQuery(event.target.value)
                setCustomerId('')
                setProjectId('')
                setSlaId('')
                setShowCustomerOptions(true)
              }}
              onFocus={() => setShowCustomerOptions(true)}
              onBlur={() =>
                setTimeout(() => setShowCustomerOptions(false), 150)
              }
              placeholder={
                loadingOptions
                  ? 'กำลังโหลด...'
                  : 'พิมพ์เพื่อค้นหา หรือคลิกเพื่อดูรายการลูกค้า'
              }
              disabled={loadingOptions}
              className={fieldInputClass + ' w-full'}
            />
            {showCustomerOptions && !loadingOptions && (
              <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
                {customerOptions.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">
                    ไม่พบลูกค้าที่ตรงกัน
                  </li>
                ) : (
                  customerOptions.map((customer) => (
                    <li key={customer.id}>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectCustomer(customer)}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-700"
                      >
                        {customer.name}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </FormField>

        <FormField label="โปรเจค (ไม่บังคับ)">
          <select
            value={projectId}
            onChange={(event) => selectProject(event.target.value)}
            disabled={!customerId}
            className={fieldInputClass}
          >
            <option value="">
              {customerId ? 'ไม่ระบุโปรเจค' : 'เลือกลูกค้าก่อน'}
            </option>
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

        <FormField label="หัวข้อ (required)">
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
            disabled={loadingOptions}
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
            disabled={saving || loadingOptions}
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-dark disabled:opacity-60"
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default JobCreateModal
