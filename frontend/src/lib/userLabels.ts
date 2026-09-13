import type { Role } from './types'

export const roleLabels: Record<Role, string> = {
  ADMIN: 'ผู้ดูแลระบบ',
  ENGINEERING: 'ช่าง/วิศวกร',
  SALES: 'ฝ่ายขาย',
  SUPER_ENGINEERING: 'หัวหน้าวิศวกร',
}

export const roleColors: Record<Role, string> = {
  ADMIN:
    'bg-brand-green/10 text-brand-green dark:bg-brand-green/20 dark:text-green-400',
  ENGINEERING:
    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  SALES: 'bg-brand-orange/10 text-brand-orange dark:bg-brand-orange/20',
  SUPER_ENGINEERING:
    'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
}
