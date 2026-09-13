import { NavLink } from 'react-router-dom'
import { menuGroups } from './menuConfig'
import { IconX } from './icons'
import { getUser } from '../lib/auth'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

function Sidebar({ open, onClose }: SidebarProps) {
  const role = getUser()?.role

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 transform flex-col bg-white p-5 transition-transform md:static md:z-auto md:translate-x-0 md:border-r md:border-gray-200 dark:bg-gray-800 dark:md:border-gray-700 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="/logo_1.png"
              alt="Syscomp"
              className="h-9 w-9 object-contain"
            />
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              <h3>SYSCOMP CORPORATION CO.,LTD.</h3>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดเมนู"
            className="text-gray-500 md:hidden dark:text-gray-400"
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto">
          {menuGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-2 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
                {group.label}
              </p>
              <div className="flex flex-col gap-1">
                {group.items
                  .filter(
                    (item) =>
                      !item.visibleRoles ||
                      (role && item.visibleRoles.includes(role)),
                  )
                  .map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/'}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                          isActive
                            ? 'bg-brand-green text-white'
                            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`
                      }
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {item.label}
                    </NavLink>
                  ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}

export default Sidebar
