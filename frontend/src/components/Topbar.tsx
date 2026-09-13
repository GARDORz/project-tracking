import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUser, performLogout } from '../lib/auth'
import { apiFetch } from '../lib/api'
import type { Notification } from '../lib/types'
import NotificationModal from './NotificationModal'
import { IconBell, IconChevronDown, IconLogOut, IconMenu } from './icons'

interface TopbarProps {
  onMenuClick: () => void
}

function Topbar({ onMenuClick }: TopbarProps) {
  const navigate = useNavigate()
  const user = getUser()
  const [menuOpen, setMenuOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    async function loadUnreadCount() {
      try {
        const data = await apiFetch<Notification[]>('/api/notifications')
        setUnreadCount(data.length)
      } catch {
        // Non-critical — leave the badge at its previous count.
      }
    }
    loadUnreadCount()
  }, [])

  async function handleLogout() {
    await performLogout()
    navigate('/login')
  }

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 md:px-6 dark:border-gray-700 dark:bg-gray-800">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="เปิดเมนู"
        className="text-gray-500 md:hidden dark:text-gray-400"
      >
        <IconMenu className="h-6 w-6" />
      </button>

      <div className="hidden md:block" />

      <div className="flex items-center gap-4">
        {/* <button
          type="button"
          aria-label="ค้นหา"
          className="text-gray-500 hover:text-brand-green"
        >
          <IconSearch className="h-5 w-5" />
        </button> */}
        <button
          type="button"
          aria-label="การแจ้งเตือน"
          onClick={() => setShowNotifications(true)}
          className="relative text-gray-500 hover:text-brand-green dark:text-gray-400"
        >
          <IconBell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-red dark:border-gray-800" />
          )}
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-green text-sm font-semibold text-white">
              {user?.name?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                {user?.name ?? 'ผู้ใช้งาน'}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{user?.role ?? ''}</p>
            </div>
            <IconChevronDown className="h-4 w-4 text-gray-400" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 z-50 mt-2 w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <IconLogOut className="h-4 w-4" />
                ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </div>

      {showNotifications && (
        <NotificationModal
          onClose={() => setShowNotifications(false)}
          onRead={() => setUnreadCount((count) => Math.max(0, count - 1))}
        />
      )}
    </header>
  )
}

export default Topbar
