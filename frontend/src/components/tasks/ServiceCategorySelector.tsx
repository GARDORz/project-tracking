import type { ServiceCategory } from '../../lib/types'
import { serviceCategoryLabels } from '../../lib/serviceJobLabels'

interface ServiceCategorySelectorProps {
  value: ServiceCategory | ''
  otherText: string
  onChange: (category: ServiceCategory) => void
  onOtherTextChange: (text: string) => void
}

const categories: ServiceCategory[] = [
  'HARDWARE',
  'SOFTWARE',
  'PROFESSIONAL_SERVICE',
  'OTHER',
]

function ServiceCategorySelector({
  value,
  otherText,
  onChange,
  onOtherTextChange,
}: ServiceCategorySelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => onChange(category)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40 ${
              value === category
                ? 'border-brand-green bg-brand-green text-white'
                : 'border-gray-300 text-gray-600 hover:border-brand-green hover:text-brand-green dark:border-gray-600 dark:text-gray-300'
            }`}
          >
            {serviceCategoryLabels[category]}
          </button>
        ))}
      </div>

      {value === 'OTHER' && (
        <input
          value={otherText}
          onChange={(event) => onOtherTextChange(event.target.value)}
          placeholder="ระบุ SERVICE TYPE"
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      )}
    </div>
  )
}

export default ServiceCategorySelector
