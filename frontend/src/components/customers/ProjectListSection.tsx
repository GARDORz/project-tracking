import { useState } from 'react'
import type { Project } from '../../lib/types'
import { formatProjectName } from '../../lib/projectLabel'
import {
  IconBox,
  IconClock,
  IconCopy,
  IconEye,
  IconPaperclip,
  IconPlus,
  IconTrash,
} from '../icons'

interface ProjectListSectionProps {
  projects: Project[]
  onAdd: () => void
  onToggleActive: (project: Project) => void
  onOpenAttachments: (project: Project) => void
  onOpenSla: (project: Project) => void
  onOpenEquipment: (project: Project) => void
  onOpenDuplicate: (project: Project) => void
  onEdit: (project: Project) => void
  onDelete: (project: Project) => void
}

const searchInputClass =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 py-1.5 text-sm'

// The "โปรเจค" list inside CustomerFormModal (edit mode) — split out purely to
// keep that file to a manageable size; no behavior change. Search text and the
// "show inactive" toggle are local UI state, so they live here rather than in
// the parent.
function ProjectListSection({
  projects,
  onAdd,
  onToggleActive,
  onOpenAttachments,
  onOpenSla,
  onOpenEquipment,
  onOpenDuplicate,
  onEdit,
  onDelete,
}: ProjectListSectionProps) {
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const visibleProjects = projects
    .filter((p) => showInactive || p.isActive)
    .filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          โปรเจค{projects.length > 0 && ` (${projects.length})`}
        </label>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1.5 rounded-lg bg-brand-green px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-green-dark"
        >
          <IconPlus className="h-4 w-4" />
          เพิ่มโปรเจค
        </button>
      </div>

      {projects.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">
          ยังไม่มีโปรเจค
        </p>
      ) : (
        <>
          {projects.length > 5 && (
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหาโปรเจค"
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
            {visibleProjects.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                ไม่พบโปรเจคที่ตรงกับตัวกรอง
              </p>
            )}
            {visibleProjects.map((project) => (
              <div
                key={project.id}
                className={`flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-600 ${
                  project.isActive ? '' : 'opacity-60'
                }`}
              >
                <span className="truncate text-sm text-gray-800 dark:text-gray-100">
                  {formatProjectName(project)}
                  {!project.isActive && (
                    <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">
                      (ปิดใช้งาน)
                    </span>
                  )}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onToggleActive(project)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      project.isActive
                        ? 'bg-brand-green/10 text-brand-green dark:bg-brand-green/20 dark:text-green-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                  >
                    {project.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenAttachments(project)}
                    aria-label="ไฟล์แนบโปรเจค"
                    className={`rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      project.attachments.length > 0
                        ? 'text-brand-green'
                        : 'text-gray-500 hover:text-brand-green dark:text-gray-400'
                    }`}
                  >
                    <IconPaperclip className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenSla(project)}
                    aria-label="SLA ของโปรเจค"
                    className={`rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      project.slaEntries.length > 0
                        ? 'text-brand-green'
                        : 'text-gray-500 hover:text-brand-green dark:text-gray-400'
                    }`}
                  >
                    <IconClock className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenEquipment(project)}
                    aria-label="อุปกรณ์ของโปรเจค"
                    className={`relative rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      project._count.equipment > 0
                        ? 'text-brand-green'
                        : 'text-gray-500 hover:text-brand-green dark:text-gray-400'
                    }`}
                  >
                    <IconBox className="h-4 w-4" />
                    {project._count.equipment > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 rounded-full bg-brand-green px-1 text-[10px] leading-tight font-medium text-white">
                        {project._count.equipment}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenDuplicate(project)}
                    aria-label="คัดลอกโปรเจค (ปีใหม่)"
                    className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-brand-green dark:text-gray-400 dark:hover:bg-gray-700"
                  >
                    <IconCopy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(project)}
                    aria-label="แก้ไขโปรเจค"
                    className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-brand-green dark:text-gray-400 dark:hover:bg-gray-700"
                  >
                    <IconEye className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(project)}
                    aria-label="ลบโปรเจค"
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

export default ProjectListSection
