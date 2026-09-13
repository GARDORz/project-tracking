import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiFetch, apiFetchBlob } from '../lib/api'
import type {
  ProjectEquipment as Equipment,
  ProjectEquipmentFault as Fault,
} from '../lib/types'
import { formatProjectName } from '../lib/projectLabel'
import { SHOW_FAULTY_EQUIPMENT } from '../lib/featureFlags'
import EquipmentImportPanel from '../components/equipment/EquipmentImportPanel'
import EquipmentTable from '../components/equipment/EquipmentTable'
import EquipmentFaultTable from '../components/equipment/EquipmentFaultTable'
import {
  IconAlertTriangle,
  IconChevronDown,
  IconPlus,
  IconSearch,
} from '../components/icons'

interface EquipmentResponse {
  project: { id: string; name: string; projectYear: string | null }
  equipment: Equipment[]
  faultCount: number
}

interface ImportResult {
  imported: number
  skipped: number
  equipment: Equipment[]
}

type EquipmentView = 'active' | 'faulty'

const inputClass =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'

function matchesQuery(
  row: {
    brand: string | null
    model: string | null
    serialNo: string | null
    description: string | null
  },
  query: string,
): boolean {
  return [row.brand, row.model, row.serialNo, row.description]
    .filter(Boolean)
    .some((field) => field!.toLowerCase().includes(query))
}

function ProjectEquipment() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  const [data, setData] = useState<EquipmentResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [view, setView] = useState<EquipmentView>('active')
  const [faults, setFaults] = useState<Fault[]>([])
  const [faultsLoaded, setFaultsLoaded] = useState(false)
  const [loadingFaults, setLoadingFaults] = useState(false)
  // Equipment ids flagged as faulty during this visit — just for row feedback.
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set())

  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importNote, setImportNote] = useState<string | null>(null)

  const [manual, setManual] = useState({
    brand: '',
    model: '',
    serialNo: '',
    description: '',
  })
  const [adding, setAdding] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [search, setSearch] = useState('')

  // Inline editing of a single equipment row's Description cell.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  async function load() {
    try {
      setData(
        await apiFetch<EquipmentResponse>(
          `/api/projects/${projectId}/equipment`,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when the project changes
  }, [projectId])

  async function loadFaults() {
    setLoadingFaults(true)
    try {
      const res = await apiFetch<{ faults: Fault[] }>(
        `/api/projects/${projectId}/equipment/faults`,
      )
      setFaults(res.faults)
      setFaultsLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดอุปกรณ์เสียไม่สำเร็จ')
    } finally {
      setLoadingFaults(false)
    }
  }

  function switchView(next: EquipmentView) {
    setView(next)
    setSearch('')
    setShowManual(false)
    setManual({ brand: '', model: '', serialNo: '', description: '' })
    if (next === 'faulty' && !faultsLoaded) {
      loadFaults()
    }
  }

  function handleFileSelected(file: File | null) {
    setPendingFile(file)
    setImportNote(null)
  }

  async function handleImport() {
    if (!pendingFile || !data) return
    if (
      data.equipment.length > 0 &&
      !window.confirm(
        `การอัปโหลดจะลบอุปกรณ์เดิมทั้งหมด ${data.equipment.length} รายการ แล้วแทนที่ด้วยไฟล์ใหม่ ยืนยันหรือไม่?`,
      )
    ) {
      return
    }
    setImporting(true)
    setError(null)
    setImportNote(null)
    try {
      const formData = new FormData()
      formData.append('file', pendingFile)
      const result = await apiFetch<ImportResult>(
        `/api/projects/${projectId}/equipment/import`,
        { method: 'POST', body: formData },
      )
      setData((current) =>
        current ? { ...current, equipment: result.equipment } : current,
      )
      setMarkedIds(new Set())
      setPendingFile(null)
      setImportNote(
        `นำเข้า ${result.imported} รายการ${result.skipped > 0 ? ` (ข้าม ${result.skipped} แถวว่าง)` : ''}`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'นำเข้าไม่สำเร็จ')
    } finally {
      setImporting(false)
    }
  }

  async function handleTemplate() {
    try {
      const blob = await apiFetchBlob(
        `/api/projects/${projectId}/equipment/template`,
      )
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'equipment-template.xlsx'
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ดาวน์โหลดเทมเพลตไม่สำเร็จ')
    }
  }

  async function handleAddManual(event: FormEvent) {
    event.preventDefault()
    setAdding(true)
    setError(null)
    try {
      const created = await apiFetch<Equipment>(
        `/api/projects/${projectId}/equipment`,
        { method: 'POST', body: JSON.stringify(manual) },
      )
      setData((current) =>
        current
          ? { ...current, equipment: [...current.equipment, created] }
          : current,
      )
      setManual({ brand: '', model: '', serialNo: '', description: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เพิ่มไม่สำเร็จ')
    } finally {
      setAdding(false)
    }
  }

  async function handleAddFaultManual(event: FormEvent) {
    event.preventDefault()
    setAdding(true)
    setError(null)
    try {
      const created = await apiFetch<Fault>(
        `/api/projects/${projectId}/equipment/faults`,
        { method: 'POST', body: JSON.stringify(manual) },
      )
      setFaults((current) => [created, ...current])
      setData((current) =>
        current ? { ...current, faultCount: current.faultCount + 1 } : current,
      )
      setManual({ brand: '', model: '', serialNo: '', description: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เพิ่มไม่สำเร็จ')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string) {
    setError(null)
    try {
      await apiFetch(`/api/projects/${projectId}/equipment/${id}`, {
        method: 'DELETE',
      })
      setData((current) =>
        current
          ? {
              ...current,
              equipment: current.equipment.filter((e) => e.id !== id),
            }
          : current,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ลบไม่สำเร็จ')
    }
  }

  function startEditDescription(item: Equipment) {
    setEditingId(item.id)
    setEditingText(item.description ?? '')
  }

  function cancelEditDescription() {
    setEditingId(null)
    setEditingText('')
  }

  async function saveEditDescription(item: Equipment) {
    const next = editingText.trim()
    if (next === (item.description ?? '')) {
      cancelEditDescription()
      return
    }
    setSavingEdit(true)
    setError(null)
    try {
      const updated = await apiFetch<Equipment>(
        `/api/projects/${projectId}/equipment/${item.id}`,
        { method: 'PATCH', body: JSON.stringify({ description: next }) },
      )
      setData((current) =>
        current
          ? {
              ...current,
              equipment: current.equipment.map((e) =>
                e.id === updated.id ? updated : e,
              ),
            }
          : current,
      )
      cancelEditDescription()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDeleteAll() {
    if (!data || data.equipment.length === 0) return
    if (
      !window.confirm(
        `ลบอุปกรณ์ทั้งหมด ${data.equipment.length} รายการของโปรเจคนี้?`,
      )
    ) {
      return
    }
    setError(null)
    try {
      await apiFetch(`/api/projects/${projectId}/equipment`, {
        method: 'DELETE',
      })
      setData((current) => (current ? { ...current, equipment: [] } : current))
      setMarkedIds(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ลบไม่สำเร็จ')
    }
  }

  async function handleMarkFaulty(item: Equipment) {
    setError(null)
    try {
      const created = await apiFetch<Fault>(
        `/api/projects/${projectId}/equipment/${item.id}/fault`,
        { method: 'POST' },
      )
      setFaults((current) => [created, ...current])
      setData((current) =>
        current ? { ...current, faultCount: current.faultCount + 1 } : current,
      )
      setMarkedIds((current) => new Set(current).add(item.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ทำเครื่องหมายไม่สำเร็จ')
    }
  }

  async function handleDeleteFault(id: string) {
    setError(null)
    try {
      await apiFetch(`/api/projects/${projectId}/equipment/faults/${id}`, {
        method: 'DELETE',
      })
      setFaults((current) => current.filter((f) => f.id !== id))
      setData((current) =>
        current
          ? { ...current, faultCount: Math.max(0, current.faultCount - 1) }
          : current,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ลบไม่สำเร็จ')
    }
  }

  async function handleDeleteAllFaults() {
    if (faults.length === 0) return
    if (
      !window.confirm(
        `ลบรายการอุปกรณ์เสียทั้งหมด ${faults.length} รายการของโปรเจคนี้?`,
      )
    ) {
      return
    }
    setError(null)
    try {
      await apiFetch(`/api/projects/${projectId}/equipment/faults`, {
        method: 'DELETE',
      })
      setFaults([])
      setData((current) => (current ? { ...current, faultCount: 0 } : current))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ลบไม่สำเร็จ')
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-400">กำลังโหลด...</p>
  }
  if (error && !data) {
    return <p className="text-sm text-brand-red">{error}</p>
  }
  if (!data) return null

  const equipment = data.equipment
  const query = search.trim().toLowerCase()
  const filteredEquipment = query
    ? equipment.filter((item) => matchesQuery(item, query))
    : equipment
  const filteredFaults = query
    ? faults.filter((item) => matchesQuery(item, query))
    : faults

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-1 flex items-center gap-1 text-sm text-gray-500 hover:text-brand-green dark:text-gray-400"
          >
            <IconChevronDown className="h-4 w-4 rotate-90" />
            ย้อนกลับ
          </button>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            อุปกรณ์ — {formatProjectName(data.project)}
          </h1>
        </div>
      </div>

      {error && <p className="text-sm text-brand-red">{error}</p>}

      {view === 'active' && (
        <EquipmentImportPanel
          pendingFile={pendingFile}
          importing={importing}
          importNote={importNote}
          onFileSelected={handleFileSelected}
          onImport={handleImport}
          onTemplate={handleTemplate}
        />
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        {SHOW_FAULTY_EQUIPMENT && (
          <div className="mb-3 inline-flex rounded-lg border border-gray-200 p-0.5 text-xs font-medium dark:border-gray-700">
            <button
              type="button"
              onClick={() => switchView('active')}
              className={`rounded-md px-3 py-1.5 ${
                view === 'active'
                  ? 'bg-brand-green text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              รายการอุปกรณ์ ({equipment.length})
            </button>
            <button
              type="button"
              onClick={() => switchView('faulty')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${
                view === 'faulty'
                  ? 'bg-brand-red text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              <IconAlertTriangle className="h-3.5 w-3.5" />
              อุปกรณ์เสีย ({data.faultCount})
            </button>
          </div>
        )}

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {view === 'active' ? 'รายการอุปกรณ์' : 'อุปกรณ์เสีย'}
            {view === 'active' && equipment.length > 0 && (
              <>
                {query
                  ? ` (${filteredEquipment.length}/${equipment.length})`
                  : ` (${equipment.length})`}
              </>
            )}
            {view === 'faulty' && faults.length > 0 && (
              <>
                {query
                  ? ` (${filteredFaults.length}/${faults.length})`
                  : ` (${faults.length})`}
              </>
            )}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {(view === 'active' ? equipment.length > 0 : faults.length > 0) && (
              <div className="relative">
                <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ค้นหา brand / model / serial / รายละเอียด"
                  className={inputClass + ' w-64 py-1.5 pl-8 text-xs'}
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowManual((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <IconPlus className="h-3.5 w-3.5" />
              เพิ่มเอง
            </button>
            {view === 'active' && equipment.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteAll}
                className="rounded-lg border border-brand-red/50 px-3 py-1.5 text-xs font-medium text-brand-red hover:bg-brand-red/10"
              >
                ลบทั้งหมด
              </button>
            )}
            {view === 'faulty' && faults.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteAllFaults}
                className="rounded-lg border border-brand-red/50 px-3 py-1.5 text-xs font-medium text-brand-red hover:bg-brand-red/10"
              >
                ลบทั้งหมด
              </button>
            )}
          </div>
        </div>

        {showManual && (
          <form
            onSubmit={
              view === 'active' ? handleAddManual : handleAddFaultManual
            }
            className="mb-4 flex flex-wrap items-end gap-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-700/40"
          >
            {(['brand', 'model', 'serialNo', 'description'] as const).map(
              (field) => (
                <div key={field} className="flex flex-1 flex-col gap-1">
                  <label className="text-xs text-gray-500 dark:text-gray-400">
                    {field === 'serialNo' ? 'Serial No.' : field}
                  </label>
                  <input
                    value={manual[field]}
                    onChange={(event) =>
                      setManual((m) => ({ ...m, [field]: event.target.value }))
                    }
                    className={inputClass}
                  />
                </div>
              ),
            )}
            <button
              type="submit"
              disabled={adding}
              className="rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-dark disabled:opacity-60"
            >
              {adding ? '...' : 'เพิ่ม'}
            </button>
          </form>
        )}

        {view === 'active' && (
          <EquipmentTable
            equipment={filteredEquipment}
            totalCount={equipment.length}
            editingId={editingId}
            editingText={editingText}
            savingEdit={savingEdit}
            markedIds={markedIds}
            onEditingTextChange={setEditingText}
            onStartEdit={startEditDescription}
            onCancelEdit={cancelEditDescription}
            onSaveEdit={saveEditDescription}
            onMarkFaulty={handleMarkFaulty}
            onDelete={handleDelete}
          />
        )}

        {view === 'faulty' && (
          <EquipmentFaultTable
            faults={filteredFaults}
            totalCount={faults.length}
            loading={loadingFaults}
            loaded={faultsLoaded}
            onDelete={handleDeleteFault}
          />
        )}
      </div>
    </div>
  )
}

export default ProjectEquipment
