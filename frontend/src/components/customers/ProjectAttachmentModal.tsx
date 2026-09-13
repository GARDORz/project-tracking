import { useState } from 'react'
import Modal from '../Modal'
import IconButton from '../IconButton'
import { apiFetch, apiFetchBlob } from '../../lib/api'
import type { Attachment, Project } from '../../lib/types'
import { formatProjectName } from '../../lib/projectLabel'
import {
  IconChevronDown,
  IconDownload,
  IconFileText,
  IconTrash,
  IconUpload,
  IconX,
} from '../icons'

interface ProjectAttachmentModalProps {
  project: Project
  onClose: () => void
  onSaved: () => void
}

const ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx'
const MAX_SIZE_BYTES = 100 * 1024 * 1024

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImage(mimeType: string) {
  return mimeType.startsWith('image/')
}

function ProjectAttachmentModal({
  project,
  onClose,
  onSaved,
}: ProjectAttachmentModalProps) {
  const [attachments, setAttachments] = useState<Attachment[]>(
    project.attachments,
  )
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggleSelect(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function togglePreview(attachment: Attachment) {
    if (expandedId === attachment.id) {
      setExpandedId(null)
      setPreviewUrl(null)
      return
    }
    setExpandedId(attachment.id)
    setPreviewUrl(null)
    if (!isImage(attachment.mimeType)) return
    setLoadingPreview(true)
    try {
      const blob = await apiFetchBlob(
        `/api/projects/${project.id}/attachments/download?ids=${attachment.id}`,
      )
      setPreviewUrl(URL.createObjectURL(blob))
    } catch {
      // Preview is optional — the row still shows the file name/size regardless.
    } finally {
      setLoadingPreview(false)
    }
  }

  function handleSelectFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    setError(null)
    const oversized = files.find((file) => file.size > MAX_SIZE_BYTES)
    if (oversized) {
      setError(`ไฟล์มีขนาดใหญ่เกินไป (จำกัด 100MB): ${oversized.name}`)
      return
    }
    setPendingFiles((current) => [...current, ...files])
  }

  function removePendingFile(index: number) {
    setPendingFiles((current) => current.filter((_, i) => i !== index))
  }

  async function handleUpload() {
    if (pendingFiles.length === 0) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      for (const file of pendingFiles) formData.append('file', file)
      const uploaded = await apiFetch<Attachment[]>(
        `/api/projects/${project.id}/attachments`,
        {
          method: 'POST',
          body: formData,
        },
      )
      setAttachments((current) => [...current, ...uploaded])
      setPendingFiles([])
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ')
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload() {
    setDownloading(true)
    setError(null)
    try {
      const idsQuery =
        selectedIds.size > 0 ? `?ids=${[...selectedIds].join(',')}` : ''
      const blob = await apiFetchBlob(
        `/api/projects/${project.id}/attachments/download${idsQuery}`,
      )
      const targetCount =
        selectedIds.size > 0 ? selectedIds.size : attachments.length
      const singleTarget =
        targetCount === 1
          ? (attachments.find((a) => selectedIds.has(a.id)) ?? attachments[0])
          : null
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = singleTarget
        ? singleTarget.fileName
        : `${project.name}-attachments.zip`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ดาวน์โหลดไม่สำเร็จ')
    } finally {
      setDownloading(false)
    }
  }

  async function handleDeleteAttachment(attachment: Attachment) {
    setDeletingId(attachment.id)
    setError(null)
    try {
      await apiFetch(
        `/api/projects/${project.id}/attachments/${attachment.id}`,
        {
          method: 'DELETE',
        },
      )
      setAttachments((current) => current.filter((a) => a.id !== attachment.id))
      setSelectedIds((current) => {
        const next = new Set(current)
        next.delete(attachment.id)
        return next
      })
      if (expandedId === attachment.id) {
        setExpandedId(null)
        setPreviewUrl(null)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ลบไม่สำเร็จ')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Modal
      title={`ไฟล์แนบ — ${formatProjectName(project)}`}
      onClose={onClose}
      size="lg"
    >
      <div className="flex flex-col gap-4">
        {attachments.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
            ยังไม่มีไฟล์แนบสำหรับโปรเจคนี้
          </p>
        ) : (
          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
            {attachments.map((attachment) => {
              const expanded = expandedId === attachment.id
              return (
                <div
                  key={attachment.id}
                  className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-center gap-2 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(attachment.id)}
                      onChange={() => toggleSelect(attachment.id)}
                      className="rounded border-gray-300 text-brand-green focus:ring-brand-green dark:border-gray-600"
                    />
                    <button
                      type="button"
                      onClick={() => togglePreview(attachment)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <IconFileText className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="truncate text-sm text-gray-800 dark:text-gray-100">
                        {attachment.fileName}
                      </span>
                    </button>
                    <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                      {formatSize(attachment.size)}
                    </span>
                    <IconButton
                      label={expanded ? 'ซ่อนตัวอย่าง' : 'ดูตัวอย่าง'}
                      onClick={() => togglePreview(attachment)}
                    >
                      <IconChevronDown
                        className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                      />
                    </IconButton>
                    <IconButton
                      label="ลบไฟล์"
                      variant="danger"
                      onClick={() => handleDeleteAttachment(attachment)}
                    >
                      <IconTrash
                        className={`h-4 w-4 ${deletingId === attachment.id ? 'opacity-40' : ''}`}
                      />
                    </IconButton>
                  </div>
                  {expanded && (
                    <div className="border-t border-gray-100 px-3 py-3 dark:border-gray-700">
                      {!isImage(attachment.mimeType) ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                            <IconFileText className="h-7 w-7" />
                          </div>
                        </div>
                      ) : loadingPreview ? (
                        <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">
                          กำลังโหลดตัวอย่าง...
                        </p>
                      ) : previewUrl ? (
                        <img
                          src={previewUrl}
                          alt={attachment.fileName}
                          className="mx-auto max-h-64 rounded-lg object-contain"
                        />
                      ) : (
                        <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">
                          ไม่สามารถโหลดตัวอย่างได้
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 p-6 text-center hover:border-brand-green dark:border-gray-600">
            <IconUpload className="h-6 w-6 text-gray-400 dark:text-gray-500" />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              เลือกไฟล์เพื่ออัปโหลด (เลือกได้หลายไฟล์)
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              รูปภาพ, PDF, Word (สูงสุด 100MB ต่อไฟล์)
            </span>
            <input
              type="file"
              multiple
              accept={ACCEPT}
              onChange={handleSelectFiles}
              className="hidden"
            />
          </label>

          {pendingFiles.length > 0 && (
            <ul className="flex flex-col gap-1">
              {pendingFiles.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-1.5 text-sm dark:bg-gray-700/40"
                >
                  <span className="truncate text-gray-700 dark:text-gray-200">
                    {file.name}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {formatSize(file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePendingFile(index)}
                      aria-label="เอาไฟล์นี้ออก"
                      className="text-gray-400 hover:text-brand-red"
                    >
                      <IconX className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="text-sm text-brand-red">{error}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            ปิด
          </button>
          {attachments.length > 0 && (
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 rounded-lg border border-brand-green px-4 py-2 text-sm font-medium text-brand-green hover:bg-brand-green/10 disabled:opacity-60"
            >
              <IconDownload className="h-4 w-4" />
              {downloading
                ? 'กำลังดาวน์โหลด...'
                : selectedIds.size > 0
                  ? `ดาวน์โหลด (${selectedIds.size})`
                  : 'ดาวน์โหลดทั้งหมด'}
            </button>
          )}
          {pendingFiles.length > 0 && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-dark disabled:opacity-60"
            >
              {uploading
                ? 'กำลังอัปโหลด...'
                : `อัปโหลด (${pendingFiles.length})`}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default ProjectAttachmentModal
