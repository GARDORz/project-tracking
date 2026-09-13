import type { ProjectEquipmentFault as Fault } from '../../lib/types'
import IconButton from '../IconButton'
import { IconAlertTriangle, IconTrash } from '../icons'

interface EquipmentFaultTableProps {
  faults: Fault[]
  totalCount: number
  loading: boolean
  loaded: boolean
  onDelete: (id: string) => void
}

// The faulty-equipment table on the project equipment page (currently
// unreachable — see frontend/src/lib/featureFlags.ts) — split out of
// ProjectEquipment.tsx purely to keep that file to a manageable size; no
// behavior change. `faults` is already search-filtered by the parent;
// `totalCount` is the unfiltered count, used to tell "nothing here yet" apart
// from "no rows match the search".
function EquipmentFaultTable({
  faults,
  totalCount,
  loading,
  loaded,
  onDelete,
}: EquipmentFaultTableProps) {
  if (loading && !loaded) {
    return (
      <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
        กำลังโหลด...
      </p>
    )
  }
  if (totalCount === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
        ยังไม่มีอุปกรณ์เสีย — กดไอคอน{' '}
        <IconAlertTriangle className="inline h-3.5 w-3.5 align-text-bottom" />{' '}
        ที่อุปกรณ์ในรายการหลัก หรือกด &quot;เพิ่มเอง&quot; เพื่อแจ้งเสีย
      </p>
    )
  }
  if (faults.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
        ไม่พบอุปกรณ์ที่ตรงกับคำค้นหา
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-gray-200 text-xs text-gray-400 uppercase dark:border-gray-700 dark:text-gray-500">
          <tr>
            <th className="px-3 py-2 font-medium">Brand</th>
            <th className="px-3 py-2 font-medium">Model</th>
            <th className="px-3 py-2 font-medium">Serial No.</th>
            <th className="px-3 py-2 font-medium">Description</th>
            <th className="px-3 py-2 font-medium">วันที่แจ้ง</th>
            <th className="px-3 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {faults.map((item) => (
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
                {item.description ?? '-'}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-gray-500 dark:text-gray-400">
                {new Date(item.reportedAt).toLocaleString('th-TH', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </td>
              <td className="px-3 py-2.5 text-right">
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

export default EquipmentFaultTable
