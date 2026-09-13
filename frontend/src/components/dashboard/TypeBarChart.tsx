import type { ServiceType } from '../../lib/types'
import { typeLabels } from '../../lib/serviceJobLabels'

interface TypeBarChartProps {
  counts: Record<ServiceType, number>
}

const typeOrder: ServiceType[] = ['WARRANTY', 'MA_SERVICE', 'PERCALL', 'OTHER']

function TypeBarChart({ counts }: TypeBarChartProps) {
  const max = Math.max(...typeOrder.map((type) => counts[type]), 1)

  return (
    <div className="flex flex-col gap-3">
      {typeOrder.map((type) => {
        const value = counts[type]
        const widthPercent = (value / max) * 100
        return (
          <div key={type} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-sm text-gray-600 dark:text-gray-300">{typeLabels[type]}</span>
            <div className="h-6 flex-1 rounded-full bg-gray-100 dark:bg-gray-700">
              <div
                className="flex h-6 items-center justify-end rounded-full bg-brand-green px-2 transition-all"
                style={{ width: value > 0 ? `${Math.max(widthPercent, 8)}%` : '0%' }}
              >
                {value > 0 && (
                  <span className="text-xs font-medium text-white">{value.toLocaleString('th-TH')}</span>
                )}
              </div>
            </div>
            {value === 0 && <span className="w-6 text-xs text-gray-400 dark:text-gray-500">0</span>}
          </div>
        )
      })}
    </div>
  )
}

export default TypeBarChart
