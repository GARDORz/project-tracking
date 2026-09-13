import type { ProjectEquipment as Equipment } from '../../lib/types'
import { SHOW_FAULTY_EQUIPMENT } from '../../lib/featureFlags'
import IconButton from '../IconButton'
import {
  IconAlertTriangle,
  IconCheck,
  IconPencil,
  IconTrash,
  IconX,
} from '../icons'

const inputClass =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'

interface EquipmentTableProps {
  equipment: Equipment[]
  totalCount: number
  editingId: string | null
  editingText: string
  savingEdit: boolean
  markedIds: Set<string>
  onEditingTextChange: (value: string) => void
  onStartEdit: (item: Equipment) => void
  onCancelEdit: () => void
  onSaveEdit: (item: Equipment) => void
  onMarkFaulty: (item: Equipment) => void
  onDelete: (id: string) => void
}

// The active-equipment table on the project equipment page — split out of
// ProjectEquipment.tsx purely to keep that file to a manageable size; no
// behavior change. `equipment` is already search-filtered by the parent;
// `totalCount` is the unfiltered count, used to tell "nothing here yet" apart
// from "no rows match the search".
function EquipmentTable({
  equipment,
  totalCount,
  editingId,
  editingText,
  savingEdit,
  markedIds,
  onEditingTextChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onMarkFaulty,
  onDelete,
}: EquipmentTableProps) {
  if (totalCount === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
        ยังไม่มีอุปกรณ์ในโปรเจคนี้
      </p>
    )
  }
  if (equipment.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
        ไม่พบอุปกรณ์ที่ตรงกับคำค้นหา
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-gray-200 text-xs text-gray-400 uppercase dark:border-gray-700 dark:text-gray-500">
          <tr>
            <th className="px-3 py-2 font-medium">Brand</th>
            <th className="px-3 py-2 font-medium">Model</th>
            <th className="px-3 py-2 font-medium">Serial No.</th>
            <th className="px-3 py-2 font-medium">Description</th>
            <th className="px-3 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {equipment.map((item) => (
            <tr key={item.id}>
              <td className="px-3 py-2.5 text-gray-800 dark:text-gray-100">
                {item.brand ?? '-'}
              </td>
              <td className="px-3 py-2.5 text-gray-700 dark:text-gray-200">
                {item.model ?? '-'}
              </td>
              <td className="px-3 py-2.5 text-gray-700 dark:text-gray-200">
                {item.serialNo ?? '-'}
              </td>
              <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">
                {editingId === item.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={editingText}
                      disabled={savingEdit}
                      onChange={(event) =>
                        onEditingTextChange(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          onSaveEdit(item)
                        } else if (event.key === 'Escape') {
                          onCancelEdit()
                        }
                      }}
                      className={inputClass + ' w-full py-1 text-xs'}
                    />
                    <IconButton label="บันทึก" onClick={() => onSaveEdit(item)}>
                      <IconCheck className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="ยกเลิก" onClick={onCancelEdit}>
                      <IconX className="h-4 w-4" />
                    </IconButton>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onStartEdit(item)}
                    title="แก้ไข Description"
                    className="group flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <span className="flex-1">{item.description ?? '-'}</span>
                    <IconPencil className="h-3.5 w-3.5 shrink-0 text-gray-300 opacity-0 transition group-hover:opacity-100 dark:text-gray-500" />
                  </button>
                )}
              </td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                {SHOW_FAULTY_EQUIPMENT &&
                  (markedIds.has(item.id) ? (
                    <span className="mr-1 inline-flex items-center gap-1 text-xs text-brand-red">
                      <IconCheck className="h-3.5 w-3.5" />
                      แจ้งเสียแล้ว
                    </span>
                  ) : (
                    <IconButton
                      label="ทำเครื่องหมายว่าเสีย"
                      variant="danger"
                      onClick={() => onMarkFaulty(item)}
                    >
                      <IconAlertTriangle className="h-4 w-4" />
                    </IconButton>
                  ))}
                <IconButton
                  label="ลบ"
                  variant="danger"
                  onClick={() => onDelete(item.id)}
                >
                  <IconTrash className="h-4 w-4" />
                </IconButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default EquipmentTable
