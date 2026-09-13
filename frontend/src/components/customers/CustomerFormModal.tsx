import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../Modal'
import { apiFetch } from '../../lib/api'
import type { Customer, CustomerContact, Project } from '../../lib/types'
import ProjectListSection from './ProjectListSection'
import ContactListSection from './ContactListSection'
import ContactFormModal from './ContactFormModal'
import ContactDeleteModal from './ContactDeleteModal'
import ProjectFormModal from './ProjectFormModal'
import ProjectDeleteModal from './ProjectDeleteModal'
import ProjectAttachmentModal from './ProjectAttachmentModal'
import ProjectSlaModal from './ProjectSlaModal'
import ProjectDuplicateModal from './ProjectDuplicateModal'

interface CustomerFormModalProps {
  mode: 'create' | 'edit'
  customer?: Customer
  onClose: () => void
  onSaved: () => void
}

type ActiveContactModal =
  | { type: 'create' }
  | { type: 'edit' | 'delete'; contact: CustomerContact }
  | null

type ActiveProjectModal =
  | { type: 'create' }
  | {
      type: 'edit' | 'delete' | 'attachments' | 'sla' | 'duplicate'
      project: Project
    }
  | null

const inputClass =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'

function CustomerFormModal({
  mode,
  customer,
  onClose,
  onSaved,
}: CustomerFormModalProps) {
  const navigate = useNavigate()
  const [name, setName] = useState(customer?.name ?? '')
  // New customers default their "ในเครือของ" to the company itself; the user can
  // still clear or change it before saving.
  const [parentName, setParentName] = useState(
    customer?.parentName ??
      (mode === 'create' ? 'SYSCOMP CORPORATION CO.,LTD.' : ''),
  )
  const [comment, setComment] = useState(customer?.comment ?? '')
  const [contacts, setContacts] = useState<CustomerContact[]>(
    customer?.contacts ?? [],
  )
  const [activeContactModal, setActiveContactModal] =
    useState<ActiveContactModal>(null)
  const [projects, setProjects] = useState<Project[]>(customer?.projects ?? [])
  const [activeProjectModal, setActiveProjectModal] =
    useState<ActiveProjectModal>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function reloadContacts() {
    if (!customer) return
    try {
      const fresh = await apiFetch<Customer>(`/api/customers/${customer.id}`)
      setContacts(fresh.contacts)
      setProjects(fresh.projects)
    } catch {
      // Non-critical — the list just won't refresh until the modal is reopened.
    }
  }

  async function toggleContactActive(contact: CustomerContact) {
    if (!customer) return
    try {
      const updated = await apiFetch<CustomerContact>(
        `/api/customers/${customer.id}/contacts/${contact.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ isActive: !contact.isActive }),
        },
      )
      setContacts((current) =>
        current.map((c) => (c.id === updated.id ? updated : c)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'อัปเดตไม่สำเร็จ')
    }
  }

  async function toggleProjectActive(project: Project) {
    if (!customer) return
    try {
      const updated = await apiFetch<Project>(
        `/api/customers/${customer.id}/projects/${project.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ isActive: !project.isActive }),
        },
      )
      // Merge rather than replace, so a partial response can't drop the
      // attachments / slaEntries arrays the render dereferences.
      setProjects((current) =>
        current.map((p) => (p.id === project.id ? { ...p, ...updated } : p)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'อัปเดตไม่สำเร็จ')
    }
  }

  function openProjectEquipment(project: Project) {
    onClose()
    navigate(`/projects/${project.id}/equipment`)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const body = {
        name,
        parentName: parentName || null,
        comment: comment || null,
      }
      if (mode === 'create') {
        await apiFetch('/api/customers', {
          method: 'POST',
          body: JSON.stringify(body),
        })
      } else if (customer) {
        await apiFetch(`/api/customers/${customer.id}`, {
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
        mode === 'create' ? 'เพิ่มลูกค้า' : `แก้ไขลูกค้า ${customer?.name}`
      }
      onClose={onClose}
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
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
            ในเครือของ
          </label>
          <input
            value={parentName}
            onChange={(event) => setParentName(event.target.value)}
            placeholder="พิมพ์ชื่อบริษัทแม่ (เว้นว่างไว้ถ้าเป็นลูกค้าอิสระ)"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            หมายเหตุ
          </label>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            className={inputClass}
          />
        </div>

        {mode === 'edit' && customer && (
          <ProjectListSection
            projects={projects}
            onAdd={() => setActiveProjectModal({ type: 'create' })}
            onToggleActive={toggleProjectActive}
            onOpenAttachments={(project) =>
              setActiveProjectModal({ type: 'attachments', project })
            }
            onOpenSla={(project) =>
              setActiveProjectModal({ type: 'sla', project })
            }
            onOpenEquipment={openProjectEquipment}
            onOpenDuplicate={(project) =>
              setActiveProjectModal({ type: 'duplicate', project })
            }
            onEdit={(project) =>
              setActiveProjectModal({ type: 'edit', project })
            }
            onDelete={(project) =>
              setActiveProjectModal({ type: 'delete', project })
            }
          />
        )}

        {mode === 'edit' && customer && (
          <ContactListSection
            contacts={contacts}
            onAdd={() => setActiveContactModal({ type: 'create' })}
            onToggleActive={toggleContactActive}
            onEdit={(contact) =>
              setActiveContactModal({ type: 'edit', contact })
            }
            onDelete={(contact) =>
              setActiveContactModal({ type: 'delete', contact })
            }
          />
        )}

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

      {customer && activeContactModal?.type === 'create' && (
        <ContactFormModal
          customerId={customer.id}
          onClose={() => setActiveContactModal(null)}
          onSaved={reloadContacts}
        />
      )}
      {customer && activeContactModal?.type === 'edit' && (
        <ContactFormModal
          customerId={customer.id}
          contact={activeContactModal.contact}
          onClose={() => setActiveContactModal(null)}
          onSaved={reloadContacts}
        />
      )}
      {customer && activeContactModal?.type === 'delete' && (
        <ContactDeleteModal
          customerId={customer.id}
          contact={activeContactModal.contact}
          onClose={() => setActiveContactModal(null)}
          onDeleted={reloadContacts}
        />
      )}

      {customer && activeProjectModal?.type === 'create' && (
        <ProjectFormModal
          customerId={customer.id}
          onClose={() => setActiveProjectModal(null)}
          onSaved={reloadContacts}
        />
      )}
      {customer && activeProjectModal?.type === 'edit' && (
        <ProjectFormModal
          customerId={customer.id}
          project={activeProjectModal.project}
          onClose={() => setActiveProjectModal(null)}
          onSaved={reloadContacts}
        />
      )}
      {customer && activeProjectModal?.type === 'delete' && (
        <ProjectDeleteModal
          customerId={customer.id}
          project={activeProjectModal.project}
          onClose={() => setActiveProjectModal(null)}
          onDeleted={reloadContacts}
        />
      )}
      {activeProjectModal?.type === 'attachments' && (
        <ProjectAttachmentModal
          project={activeProjectModal.project}
          onClose={() => setActiveProjectModal(null)}
          onSaved={reloadContacts}
        />
      )}
      {customer && activeProjectModal?.type === 'sla' && (
        <ProjectSlaModal
          customerId={customer.id}
          project={activeProjectModal.project}
          onClose={() => setActiveProjectModal(null)}
          onSaved={reloadContacts}
        />
      )}
      {customer && activeProjectModal?.type === 'duplicate' && (
        <ProjectDuplicateModal
          customerId={customer.id}
          project={activeProjectModal.project}
          onClose={() => setActiveProjectModal(null)}
          onDuplicated={reloadContacts}
        />
      )}
    </Modal>
  )
}

export default CustomerFormModal
