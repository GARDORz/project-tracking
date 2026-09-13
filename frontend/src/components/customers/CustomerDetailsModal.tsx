import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../Modal'
import { apiFetch } from '../../lib/api'
import type { Customer, Project } from '../../lib/types'
import { formatSla } from '../../lib/slaLabel'
import { formatProjectName } from '../../lib/projectLabel'
import {
  IconBox,
  IconBuilding,
  IconChevronDown,
  IconMail,
  IconPaperclip,
  IconPhone,
} from '../icons'
import ProjectAttachmentModal from './ProjectAttachmentModal'

interface CustomerDetailsModalProps {
  customerId: string
  onClose: () => void
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="shrink-0 text-sm text-gray-400 dark:text-gray-500">
        {label}
      </span>
      <span className="text-right text-sm font-medium text-gray-800 dark:text-gray-100">
        {value || '-'}
      </span>
    </div>
  )
}

function CustomerDetailsModal({
  customerId,
  onClose,
}: CustomerDetailsModalProps) {
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedContactId, setExpandedContactId] = useState<string | null>(
    null,
  )
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(
    null,
  )
  const [projectSearch, setProjectSearch] = useState('')
  const [contactSearch, setContactSearch] = useState('')
  const [viewingAttachmentsProject, setViewingAttachmentsProject] =
    useState<Project | null>(null)

  async function loadCustomer() {
    try {
      setCustomer(await apiFetch<Customer>(`/api/customers/${customerId}`))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
    loadCustomer()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when customerId itself changes
  }, [customerId])

  const activeContacts = customer?.contacts.filter((c) => c.isActive) ?? []
  const activeProjects = customer?.projects.filter((p) => p.isActive) ?? []
  const visibleContacts = activeContacts.filter((c) =>
    c.name.toLowerCase().includes(contactSearch.trim().toLowerCase()),
  )
  const visibleProjects = activeProjects.filter((p) =>
    p.name.toLowerCase().includes(projectSearch.trim().toLowerCase()),
  )

  return (
    <Modal title="รายละเอียดลูกค้า" onClose={onClose}>
      {loading && (
        <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
          กำลังโหลด...
        </p>
      )}
      {!loading && error && (
        <p className="py-6 text-center text-sm text-brand-red">{error}</p>
      )}

      {!loading && !error && customer && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-700/40">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-green/10 text-brand-green dark:bg-brand-green/20">
              <IconBuilding className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">
                {customer.name}
              </p>
            </div>
          </div>

          <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-700">
            <InfoRow label="ในเครือของ" value={customer.parentName ?? ''} />
            <InfoRow label="หมายเหตุ" value={customer.comment ?? ''} />
            <InfoRow
              label="วันที่สร้าง"
              value={new Date(customer.createdAt).toLocaleDateString('th-TH', {
                dateStyle: 'medium',
              })}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              โปรเจค{activeProjects.length > 0 && ` (${activeProjects.length})`}
            </span>
            {activeProjects.length === 0 ? (
              <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-400 dark:bg-gray-700/40 dark:text-gray-500">
                ยังไม่มีโปรเจค
              </p>
            ) : (
              <>
                {activeProjects.length > 5 && (
                  <input
                    value={projectSearch}
                    onChange={(event) => setProjectSearch(event.target.value)}
                    placeholder="ค้นหาโปรเจค"
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  />
                )}
                <div className="flex max-h-96 flex-col gap-1 overflow-y-auto pr-1">
                  {visibleProjects.length === 0 && (
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      ไม่พบโปรเจคที่ตรงกับคำค้นหา
                    </p>
                  )}
                  {visibleProjects.map((project) => {
                    const expanded = expandedProjectId === project.id
                    return (
                      <div
                        key={project.id}
                        className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedProjectId(expanded ? null : project.id)
                          }
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <span className="flex-1 truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                            {formatProjectName(project)}
                          </span>
                          <IconChevronDown
                            className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                        {expanded && (
                          <div className="flex flex-col gap-1.5 border-t border-gray-100 bg-gray-50 px-3 py-2.5 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-700/40 dark:text-gray-400">
                            <p>เลขที่สัญญา: {project.contractNumber || '-'}</p>
                            <p>
                              วันเริ่มต้นสัญญา:{' '}
                              {project.contractStartDate
                                ? new Date(
                                    project.contractStartDate,
                                  ).toLocaleDateString('th-TH', {
                                    dateStyle: 'medium',
                                  })
                                : '-'}
                            </p>
                            <p>
                              วันที่สิ้นสุดสัญญา:{' '}
                              {project.contractEndDate
                                ? new Date(
                                    project.contractEndDate,
                                  ).toLocaleDateString('th-TH', {
                                    dateStyle: 'medium',
                                  })
                                : '-'}
                            </p>
                            {project.contractEndDate && (
                              <p>
                                แจ้งเตือนล่วงหน้า:{' '}
                                {project.contractNotifyMonths} เดือนก่อนหมดสัญญา
                              </p>
                            )}
                            {(() => {
                              const activeSlas = project.slaEntries.filter(
                                (sla) => sla.isActive,
                              )
                              return activeSlas.length > 0 ? (
                                <div>
                                  <p>SLA:</p>
                                  <ul className="list-disc pl-4">
                                    {activeSlas.map((sla) => (
                                      <li key={sla.id}>{formatSla(sla)}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : (
                                <p>SLA: -</p>
                              )
                            })()}
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setViewingAttachmentsProject(project)
                                }
                                className="flex items-center gap-1.5 rounded-lg border border-brand-green px-2.5 py-1.5 text-xs font-medium text-brand-green hover:bg-brand-green/10"
                              >
                                <IconPaperclip className="h-3.5 w-3.5" />
                                ไฟล์แนบ
                                {project.attachments.length > 0
                                  ? ` (${project.attachments.length})`
                                  : ''}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onClose()
                                  navigate(`/projects/${project.id}/equipment`)
                                }}
                                className="flex items-center gap-1.5 rounded-lg border border-brand-green px-2.5 py-1.5 text-xs font-medium text-brand-green hover:bg-brand-green/10"
                              >
                                <IconBox className="h-3.5 w-3.5" />
                                อุปกรณ์
                                {project._count.equipment > 0
                                  ? ` (${project._count.equipment})`
                                  : ''}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              ผู้ติดต่อ
              {activeContacts.length > 0 && ` (${activeContacts.length})`}
            </span>
            {activeContacts.length === 0 ? (
              <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-400 dark:bg-gray-700/40 dark:text-gray-500">
                ยังไม่มีผู้ติดต่อ
              </p>
            ) : (
              <>
                {activeContacts.length > 5 && (
                  <input
                    value={contactSearch}
                    onChange={(event) => setContactSearch(event.target.value)}
                    placeholder="ค้นหาผู้ติดต่อ"
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  />
                )}
                <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
                  {visibleContacts.length === 0 && (
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      ไม่พบผู้ติดต่อที่ตรงกับคำค้นหา
                    </p>
                  )}
                  {visibleContacts.map((contact) => {
                    const expanded = expandedContactId === contact.id
                    return (
                      <div
                        key={contact.id}
                        className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedContactId(expanded ? null : contact.id)
                          }
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="flex-1 truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                            {contact.name}
                          </span>
                          <IconChevronDown
                            className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                        {expanded && (
                          <div className="flex flex-col gap-1.5 border-t border-gray-100 bg-gray-50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-700/40">
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                              <IconPhone className="h-4 w-4 shrink-0 text-gray-400" />
                              {contact.phone || '-'}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                              <IconMail className="h-4 w-4 shrink-0 text-gray-400" />
                              {contact.email || '-'}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {viewingAttachmentsProject && (
        <ProjectAttachmentModal
          project={viewingAttachmentsProject}
          onClose={() => setViewingAttachmentsProject(null)}
          onSaved={loadCustomer}
        />
      )}
    </Modal>
  )
}

export default CustomerDetailsModal
