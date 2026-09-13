import type { ServiceType } from '../../lib/types'
import { typeLabels } from '../../lib/serviceJobLabels'

interface ServiceTypeSelectorProps {
  value: ServiceType
  otherText: string
  onChange: (type: ServiceType) => void
  onOtherTextChange: (text: string) => void
}

const types: ServiceType[] = ['WARRANTY', 'MA_SERVICE', 'PERCALL', 'OTHER']

// Every type except OTHER reuses the same free-text `typeOther` field OTHER
// uses for its label, just encoded as a "CM, PM"-style list instead of
// arbitrary text.
const CM_PM_OPTIONS = ['CM', 'PM'] as const

function ServiceTypeSelector({
  value,
  otherText,
  onChange,
  onOtherTextChange,
}: ServiceTypeSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {types.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40 ${
              value === type
                ? 'border-brand-green bg-brand-green text-white'
                : 'border-gray-300 text-gray-600 hover:border-brand-green hover:text-brand-green dark:border-gray-600 dark:text-gray-300'
            }`}
          >
            {typeLabels[type]}
          </button>
        ))}
      </div>

      {value === 'OTHER' && (
        <input
          value={otherText}
          onChange={(event) => onOtherTextChange(event.target.value)}
          placeholder="ระบุประเภทงาน"
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      )}

      {value !== 'OTHER' && (
        <div className="flex gap-4">
          {CM_PM_OPTIONS.map((option) => {
            const selected = otherText
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
            const checked = selected.includes(option)
            return (
              <label
                key={option}
                className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = checked
                      ? selected.filter((item) => item !== option)
                      : [...selected, option]
                    onOtherTextChange(
                      CM_PM_OPTIONS.filter((o) => next.includes(o)).join(', '),
                    )
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-brand-green focus:ring-brand-green/40 dark:border-gray-600"
                />
                {option}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ServiceTypeSelector
