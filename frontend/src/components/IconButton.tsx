import type { ReactNode } from 'react'

interface IconButtonProps {
  label: string
  onClick: () => void
  children: ReactNode
  variant?: 'default' | 'danger'
}

function IconButton({ label, onClick, children, variant = 'default' }: IconButtonProps) {
  return (
    <div className="group relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`rounded-lg p-1.5 transition ${
          variant === 'danger'
            ? 'text-gray-500 hover:bg-brand-red/10 hover:text-brand-red dark:text-gray-400'
            : 'text-gray-500 hover:bg-gray-100 hover:text-brand-green dark:text-gray-400 dark:hover:bg-gray-700'
        }`}
      >
        {children}
      </button>
      <span className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 rounded-md bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white opacity-0 transition group-hover:opacity-100 dark:bg-gray-700">
        {label}
      </span>
    </div>
  )
}

export default IconButton
