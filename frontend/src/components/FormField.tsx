import type { ReactNode } from 'react'

interface FormFieldProps {
  label: string
  children: ReactNode
}

function FormField({ label, children }: FormFieldProps) {
  return (
    <div className="relative rounded-lg border border-gray-300 px-3 pt-3.5 pb-2 focus-within:border-brand-green focus-within:ring-2 focus-within:ring-brand-green/30 dark:border-gray-600">
      <label className="absolute -top-2.5 left-2 bg-white px-1 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
        {label}
      </label>
      {children}
    </div>
  )
}

export default FormField
