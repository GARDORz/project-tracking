import type { ComponentType, SVGProps } from 'react'
import type { Role } from '../lib/types'
import {
  IconHome,
  IconFolder,
  IconCheckSquare,
  IconUsers,
  IconBarChart,
  IconSettings,
  IconClock,
  IconBox,
} from './icons'

interface MenuItem {
  label: string
  path: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  // Hidden from the sidebar entirely for anyone whose role isn't listed here —
  // unlike "ทีม" (visible to everyone, management-only actions hidden inside the
  // page), these whole pages have no use case for a role that's left out.
  // Omitted entirely means visible to every role.
  visibleRoles?: Role[]
}

interface MenuGroup {
  label: string
  items: MenuItem[]
}

export const menuGroups: MenuGroup[] = [
  {
    label: 'เมนู',
    items: [
      { label: 'หน้าหลัก', path: '/', icon: IconHome },
      { label: 'งาน', path: '/tasks', icon: IconCheckSquare },
      { label: 'ทีม', path: '/team', icon: IconUsers },
      { label: 'ลูกค้า', path: '/customers', icon: IconFolder },
      { label: 'อุปกรณ์', path: '/equipment', icon: IconBox },
    ],
  },
  {
    label: 'รายงาน',
    items: [
      { label: 'รายงาน', path: '/reports', icon: IconBarChart },
      {
        label: 'ภาพรวม',
        path: '/overview',
        icon: IconUsers,
        visibleRoles: ['ADMIN', 'SUPER_ENGINEERING'],
      },
    ],
  },
  {
    label: 'เครื่องมือ',
    items: [
      { label: 'ตั้งค่า', path: '/settings', icon: IconSettings },
      {
        label: 'ประวัติการตรวจสอบ',
        path: '/audit-log',
        icon: IconClock,
        visibleRoles: ['ADMIN'],
      },
      // { label: 'ข้อเสนอแนะ', path: '/feedback', icon: IconMessageCircle },
      // { label: 'ช่วยเหลือ', path: '/help', icon: IconHelpCircle },
    ],
  },
]
