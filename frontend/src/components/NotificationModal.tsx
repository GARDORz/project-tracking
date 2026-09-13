import { useEffect, useState } from 'react'
import Modal from './Modal'
import { apiFetch } from '../lib/api'
import type { Notification } from '../lib/types'

interface NotificationModalProps {
  onClose: () => void
  onRead: () => void
}

type Tab = 'unread' | 'all'

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
}

function NotificationModal({ onClose, onRead }: NotificationModalProps) {
  const [tab, setTab] = useState<Tab>('unread')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const query = tab === 'all' ? '?all=1' : ''
        setNotifications(await apiFetch<Notification[]>(`/api/notifications${query}`))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tab])

  async function markRead(notification: Notification) {
    if (notification.read) return
    try {
      await apiFetch(`/api/notifications/${notification.id}`, { method: 'PATCH' })
      onRead()
      if (tab === 'unread') {
        setNotifications((prev) => prev.filter((item) => item.id !== notification.id))
      } else {
        setNotifications((prev) =>
          prev.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
        )
      }
    } catch {
      // Leave the item as-is; the user can try clicking it again.
    }
  }

  return (
    <Modal title="การแจ้งเตือน" onClose={onClose}>
      <div className="mb-3 flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
        <button
          type="button"
          onClick={() => setTab('unread')}
          className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${
            tab === 'unread'
              ? 'bg-white text-brand-green shadow-sm dark:bg-gray-800'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          ยังไม่อ่าน
        </button>
        <button
          type="button"
          onClick={() => setTab('all')}
          className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${
            tab === 'all'
              ? 'bg-white text-brand-green shadow-sm dark:bg-gray-800'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          ประวัติทั้งหมด
        </button>
      </div>

      <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
        {loading && <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">กำลังโหลด...</p>}

        {!loading && error && <p className="py-6 text-center text-sm text-brand-red">{error}</p>}

        {!loading && !error && notifications.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
            {tab === 'unread' ? 'ไม่มีการแจ้งเตือนใหม่' : 'ยังไม่มีประวัติการแจ้งเตือน'}
          </p>
        )}

        {!loading &&
          !error &&
          notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => markRead(notification)}
              className={`flex flex-col gap-0.5 rounded-lg px-3 py-2 text-left text-sm transition ${
                notification.read
                  ? 'text-gray-400 hover:bg-gray-50 dark:text-gray-500 dark:hover:bg-gray-700'
                  : 'bg-brand-green/5 text-gray-800 hover:bg-brand-green/10 dark:text-gray-100 dark:hover:bg-brand-green/20'
              }`}
            >
              <span className="flex items-start gap-2">
                {!notification.read && (
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-green" />
                )}
                <span>{notification.message}</span>
              </span>
              <span className="pl-3.5 text-xs text-gray-400 dark:text-gray-500">{formatTime(notification.createdAt)}</span>
            </button>
          ))}
      </div>
    </Modal>
  )
}

export default NotificationModal
