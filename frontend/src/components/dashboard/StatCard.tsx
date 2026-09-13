import type { ComponentType, SVGProps } from 'react'

interface StatCardProps {
  label: string
  value: number
  icon: ComponentType<SVGProps<SVGSVGElement>>
  accentClass: string
  onClick: () => void
}

function StatCard({ label, value, icon: Icon, accentClass, onClick }: StatCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accentClass}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-semibold text-gray-800 dark:text-gray-100">{value.toLocaleString('th-TH')}</p>
      </div>
    </button>
  )
}

export default StatCard
