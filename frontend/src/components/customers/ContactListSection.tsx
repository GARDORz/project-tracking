import { useState } from 'react'
import type { CustomerContact } from '../../lib/types'
import { IconEye, IconPlus, IconTrash } from '../icons'

interface ContactListSectionProps {
  contacts: CustomerContact[]
  onAdd: () => void
  onToggleActive: (contact: CustomerContact) => void
  onEdit: (contact: CustomerContact) => void
  onDelete: (contact: CustomerContact) => void
}

const searchInputClass =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 py-1.5 text-sm'

// The "ผู้ติดต่อ" list inside CustomerFormModal (edit mode) — split out purely
// to keep that file to a manageable size; no behavior change. Search text and
// the "show inactive" toggle are local UI state, so they live here rather
// than in the parent.
function ContactListSection({
  contacts,
  onAdd,
  onToggleActive,
  onEdit,
  onDelete,
}: ContactListSectionProps) {
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const visibleContacts = contacts
    .filter((c) => showInactive || c.isActive)
    .filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          ผู้ติดต่อ{contacts.length > 0 && ` (${contacts.length})`}
        </label>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1.5 rounded-lg bg-brand-green px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-green-dark"
        >
          <IconPlus className="h-4 w-4" />
          เพิ่มผู้ติดต่อ
        </button>
      </div>

      {contacts.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">
          ยังไม่มีผู้ติดต่อ
        </p>
      ) : (
        <>
          {contacts.length > 5 && (
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหาผู้ติดต่อ"
              className={searchInputClass}
            />
          )}
          <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(event) => setShowInactive(event.target.checked)}
              className="rounded border-gray-300 text-brand-green focus:ring-brand-green dark:border-gray-600"
            />
            แสดงที่ปิดใช้งานด้วย
          </label>

          <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
            {visibleContacts.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                ไม่พบผู้ติดต่อที่ตรงกับตัวกรอง
              </p>
            )}
            {visibleContacts.map((contact) => (
              <div
                key={contact.id}
                className={`flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-600 ${
                  contact.isActive ? '' : 'opacity-60'
                }`}
              >
                <span className="truncate text-sm text-gray-800 dark:text-gray-100">
                  {contact.name}
                  {!contact.isActive && (
                    <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">
                      (ปิดใช้งาน)
                    </span>
                  )}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onToggleActive(contact)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      contact.isActive
                        ? 'bg-brand-green/10 text-brand-green dark:bg-brand-green/20 dark:text-green-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                  >
                    {contact.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(contact)}
                    aria-label="ดูรายละเอียด"
                    className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-brand-green dark:text-gray-400 dark:hover:bg-gray-700"
                  >
                    <IconEye className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(contact)}
                    aria-label="ลบผู้ติดต่อ"
                    className="rounded-lg p-1.5 text-gray-500 hover:bg-brand-red/10 hover:text-brand-red dark:text-gray-400"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default ContactListSection
