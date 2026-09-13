import { useState } from 'react'
import type { ServiceStatus } from '../../lib/types'
import { statusLabels } from '../../lib/serviceJobLabels'
import { statusChartColors } from '../../lib/chartPalette'

interface StatusDonutChartProps {
  counts: Record<ServiceStatus, number>
}

const statusOrder: ServiceStatus[] = ['NEW', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED']

const CX = 90
const CY = 90
const OUTER_R = 80
const INNER_R = 52
const GAP_DEG = 1.5

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) }
}

function describeDonutSlice(startAngle: number, endAngle: number) {
  const startOuter = polarToCartesian(CX, CY, OUTER_R, endAngle)
  const endOuter = polarToCartesian(CX, CY, OUTER_R, startAngle)
  const startInner = polarToCartesian(CX, CY, INNER_R, endAngle)
  const endInner = polarToCartesian(CX, CY, INNER_R, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${OUTER_R} ${OUTER_R} 0 ${largeArcFlag} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A ${INNER_R} ${INNER_R} 0 ${largeArcFlag} 1 ${startInner.x} ${startInner.y}`,
    'Z',
  ].join(' ')
}

function StatusDonutChart({ counts }: StatusDonutChartProps) {
  const [hovered, setHovered] = useState<ServiceStatus | null>(null)

  const total = statusOrder.reduce((sum, status) => sum + counts[status], 0)

  const { slices } = statusOrder
    .filter((status) => counts[status] > 0)
    .reduce<{ cursor: number; slices: { status: ServiceStatus; startAngle: number; endAngle: number }[] }>(
      (acc, status) => {
        const sweep = (counts[status] / total) * 360
        const pad = sweep > GAP_DEG * 2 ? GAP_DEG / 2 : 0
        return {
          cursor: acc.cursor + sweep,
          slices: [
            ...acc.slices,
            { status, startAngle: acc.cursor + pad, endAngle: acc.cursor + sweep - pad },
          ],
        }
      },
      { cursor: 0, slices: [] },
    )

  const centerStatus = hovered
  const centerLabel = centerStatus ? statusLabels[centerStatus] : 'ทั้งหมด'
  const centerValue = centerStatus ? counts[centerStatus] : total

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-8">
      <div className="relative h-[180px] w-[180px] shrink-0">
        {total === 0 ? (
          <div className="flex h-full w-full items-center justify-center rounded-full border-2 border-dashed border-gray-200 text-sm text-gray-400 dark:border-gray-700">
            ไม่มีข้อมูล
          </div>
        ) : (
          <svg viewBox="0 0 180 180" className="h-full w-full">
            {slices.map(({ status, startAngle, endAngle }) => (
              <path
                key={status}
                d={describeDonutSlice(startAngle, endAngle)}
                fill={statusChartColors[status]}
                opacity={hovered && hovered !== status ? 0.35 : 1}
                onMouseEnter={() => setHovered(status)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(status)}
                onBlur={() => setHovered(null)}
                tabIndex={0}
                className="cursor-pointer transition-opacity outline-none"
              >
                <title>
                  {statusLabels[status]}: {counts[status].toLocaleString('th-TH')} (
                  {Math.round((counts[status] / total) * 100)}%)
                </title>
              </path>
            ))}
          </svg>
        )}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
            {centerValue.toLocaleString('th-TH')}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{centerLabel}</span>
        </div>
      </div>

      <ul className="flex flex-1 flex-col gap-2">
        {statusOrder.map((status) => (
          <li
            key={status}
            onMouseEnter={() => setHovered(status)}
            onMouseLeave={() => setHovered(null)}
            className="flex items-center justify-between gap-3 rounded-lg px-2 py-1 text-sm transition hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: statusChartColors[status] }}
              />
              {statusLabels[status]}
            </span>
            <span className="font-medium text-gray-800 dark:text-gray-100">{counts[status].toLocaleString('th-TH')}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default StatusDonutChart
