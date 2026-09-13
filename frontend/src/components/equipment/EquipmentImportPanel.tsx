import { IconDownload, IconUpload } from '../icons'

interface EquipmentImportPanelProps {
  pendingFile: File | null
  importing: boolean
  importNote: string | null
  onFileSelected: (file: File | null) => void
  onImport: () => void
  onTemplate: () => void
}

// The "นำเข้าจาก Excel" card on the project equipment page — split out of
// ProjectEquipment.tsx purely to keep that file to a manageable size; no
// behavior change.
function EquipmentImportPanel({
  pendingFile,
  importing,
  importNote,
  onFileSelected,
  onImport,
  onTemplate,
}: EquipmentImportPanelProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
        นำเข้าจาก Excel
      </h2>
      <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">
        ไฟล์ .xlsx มีหัวคอลัมน์ Brand / Model / Serial No. / Description
        (สลับลำดับ/พิมพ์เล็กใหญ่ได้) — การนำเข้าจะแทนที่รายการเดิมทั้งหมด
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-600 hover:border-brand-green dark:border-gray-600 dark:text-gray-300">
          <IconUpload className="h-4 w-4" />
          {pendingFile ? pendingFile.name : 'เลือกไฟล์ .xlsx'}
          <input
            type="file"
            accept=".xlsx"
            onChange={(event) => {
              onFileSelected(event.target.files?.[0] ?? null)
              event.target.value = ''
            }}
            className="hidden"
          />
        </label>
        <button
          type="button"
          onClick={onImport}
          disabled={!pendingFile || importing}
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-dark disabled:opacity-60"
        >
          {importing ? 'กำลังนำเข้า...' : 'อัปโหลด'}
        </button>
        <button
          type="button"
          onClick={onTemplate}
          className="flex items-center gap-1.5 rounded-lg border border-brand-green px-4 py-2 text-sm font-medium text-brand-green hover:bg-brand-green/10"
        >
          <IconDownload className="h-4 w-4" />
          ดาวน์โหลดเทมเพลต
        </button>
      </div>
      {importNote && (
        <p className="mt-3 text-sm text-brand-green">{importNote}</p>
      )}
    </div>
  )
}

export default EquipmentImportPanel
