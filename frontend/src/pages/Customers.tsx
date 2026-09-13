import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { Customer } from '../lib/types'
import IconButton from '../components/IconButton'
import Pagination from '../components/Pagination'
import {
  IconEye,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
} from '../components/icons'
import CustomerFormModal from '../components/customers/CustomerFormModal'
import CustomerDeleteModal from '../components/customers/CustomerDeleteModal'
import CustomerDetailsModal from '../components/customers/CustomerDetailsModal'

const PAGE_SIZE = 20

type ActiveModal =
  | { type: 'create' }
  | { type: 'edit' | 'delete' | 'details'; customer: Customer }
  | null

function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState(1)

  async function loadCustomers() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<Customer[]>('/api/customers')
      setCustomers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
    loadCustomers()
  }, [])

  async function toggleCustomerActive(customer: Customer) {
    try {
      await apiFetch(`/api/customers/${customer.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !customer.isActive }),
      })
      loadCustomers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'อัปเดตไม่สำเร็จ')
    }
  }

  const searchQuery = searchText.trim().toLowerCase()
  const filteredCustomers = customers
    .filter(
      (customer) =>
        !searchQuery || customer.name.toLowerCase().includes(searchQuery),
    )
    // Newest-created customer first — the API itself still returns A-Z since
    // that order is shared with the customer picker in job creation / reports.
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCustomers.length / PAGE_SIZE),
  )
  // Clamp rather than trust `page` directly — searching or deleting can shrink
  // totalPages below whatever page the user was previously sitting on.
  const currentPage = Math.min(page, totalPages)
  const pagedCustomers = filteredCustomers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  function handleSearchChange(value: string) {
    setSearchText(value)
    setPage(1)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
          ลูกค้า
        </h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              value={searchText}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="ค้นหาชื่อลูกค้า"
              className="w-56 rounded-lg border border-gray-300 bg-white py-2 pr-3 pl-9 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <button
            type="button"
            onClick={() => setActiveModal({ type: 'create' })}
            className="flex items-center gap-1.5 rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-dark"
          >
            <IconPlus className="h-4 w-4" />
            เพิ่มลูกค้า
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-gray-200 bg-white text-xs text-gray-400 uppercase dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">ลำดับ</th>
              <th className="px-4 py-3 font-medium">ชื่อ</th>
              <th className="px-4 py-3 font-medium">ในเครือของ</th>
              <th className="px-4 py-3 font-medium">หมายเหตุ</th>
              <th className="px-4 py-3 font-medium">วันที่สร้าง</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
              <th className="px-4 py-3 font-medium">การจัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-gray-400 dark:text-gray-500"
                >
                  กำลังโหลด...
                </td>
              </tr>
            )}

            {!loading && error && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-brand-red"
                >
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && filteredCustomers.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-gray-400 dark:text-gray-500"
                >
                  {searchQuery ? 'ไม่พบลูกค้าที่ตรงกัน' : 'ยังไม่มีลูกค้า'}
                </td>
              </tr>
            )}

            {!loading &&
              !error &&
              pagedCustomers.map((customer, index) => (
                <tr
                  key={customer.id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${customer.isActive ? '' : 'opacity-60'}`}
                >
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {(currentPage - 1) * PAGE_SIZE + index + 1}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">
                    {customer.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {customer.parentName ?? '-'}
                  </td>
                  <td className="max-w-[240px] truncate px-4 py-3 text-gray-500 dark:text-gray-400">
                    {customer.comment ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {new Date(customer.createdAt).toLocaleDateString('th-TH', {
                      dateStyle: 'medium',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleCustomerActive(customer)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        customer.isActive
                          ? 'bg-brand-green/10 text-brand-green dark:bg-brand-green/20 dark:text-green-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {customer.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <IconButton
                        label="ดูรายละเอียด"
                        onClick={() =>
                          setActiveModal({ type: 'details', customer })
                        }
                      >
                        <IconEye className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        label="แก้ไข"
                        onClick={() =>
                          setActiveModal({ type: 'edit', customer })
                        }
                      >
                        <IconPencil className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        label="ลบ"
                        variant="danger"
                        onClick={() =>
                          setActiveModal({ type: 'delete', customer })
                        }
                      >
                        <IconTrash className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      {activeModal?.type === 'create' && (
        <CustomerFormModal
          mode="create"
          onClose={() => setActiveModal(null)}
          onSaved={loadCustomers}
        />
      )}
      {activeModal?.type === 'edit' && (
        <CustomerFormModal
          mode="edit"
          customer={activeModal.customer}
          onClose={() => setActiveModal(null)}
          onSaved={loadCustomers}
        />
      )}
      {activeModal?.type === 'delete' && (
        <CustomerDeleteModal
          customer={activeModal.customer}
          onClose={() => setActiveModal(null)}
          onDeleted={loadCustomers}
        />
      )}
      {activeModal?.type === 'details' && (
        <CustomerDetailsModal
          customerId={activeModal.customer.id}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  )
}

export default Customers
