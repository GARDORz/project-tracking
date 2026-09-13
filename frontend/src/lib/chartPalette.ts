import type { ServiceStatus } from './types'

// Validated 8-hue categorical sequence (fixed order, never cycled or reordered —
// this exact sequence clears CVD/contrast checks for adjacent segments, see
// dataviz skill's reference palette). Brand red/green were tried for the status
// donut first but failed the colorblind-separation check (red vs green ΔE 4.1,
// well under the 6.0 floor) — this sequence replaces them.
const categorical = {
  blue: '#2a78d6',
  orange: '#eb6834',
  aqua: '#1baf7a',
  yellow: '#eda100',
  magenta: '#e87ba4',
} as const

// Fixed slot per status (never reassigned based on data) — validated adjacent
// in this exact order: blue -> orange -> aqua -> yellow -> magenta -> (wraps to blue).
export const statusChartColors: Record<ServiceStatus, string> = {
  NEW: categorical.blue,
  IN_PROGRESS: categorical.orange,
  ON_HOLD: categorical.aqua,
  COMPLETED: categorical.yellow,
  CANCELLED: categorical.magenta,
}
