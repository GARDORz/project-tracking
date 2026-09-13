import { useState } from 'react'
import Modal from '../Modal'
import CustomerDetailsModal from '../customers/CustomerDetailsModal'
import type { ServiceJob } from '../../lib/types'
import {
  contactChannelLabels,
  formatDuration,
  formatServiceCategory,
  formatServiceType,
  statusColors,
  statusLabels,
} from '../../lib/serviceJobLabels'
import { formatSla } from '../../lib/slaLabel'
import { formatProjectName } from '../../lib/projectLabel'
import { IconEye } from '../icons'

interface JobDetailsModalProps {
  job: ServiceJob
  onClose: () => void
}

function Badge({
  className,
  children,
}: {
  className: string
  children: string
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="shrink-0 text-sm text-gray-400 dark:text-gray-500">
        {label}
      </span>
      <span className="text-right text-sm font-medium text-gray-800 dark:text-gray-100">
        {value || '-'}
      </span>
    </div>
  )
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 py-2">
      <span className="text-sm text-gray-400 dark:text-gray-500">{label}</span>
      <p className="text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-100">
        {value || '-'}
      </p>
    </div>
  )
}

function JobDetailsModal({ job, onClose }: JobDetailsModalProps) {
  const [showCustomerDetails, setShowCustomerDetails] = useState(false)

  return (
    <Modal title={`รายละเอียดงาน ${job.jobNo}`} onClose={onClose} size="lg">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-700/40">
          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {job.title}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                ประเภท
              </span>
              <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                {formatServiceType(job)}
              </Badge>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                สถานะ
              </span>
              <Badge className={statusColors[job.status]}>
                {statusLabels[job.status]}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2.5 dark:border-gray-600">
          <div className="min-w-0">
            <p className="text-xs text-gray-400 dark:text-gray-500">ลูกค้า</p>
            <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
              {job.customer.name}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCustomerDetails(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-green px-2.5 py-1.5 text-xs font-medium text-brand-green hover:bg-brand-green/10"
          >
            <IconEye className="h-3.5 w-3.5" />
            ดูรายละเอียดลูกค้า
          </button>
        </div>

        <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-700">
          <InfoRow label="SERVICE TYPE" value={formatServiceCategory(job)} />
          <InfoRow
            label="โปรเจค"
            value={job.project ? formatProjectName(job.project) : ''}
          />
          <InfoRow
            label="เลขที่สัญญา"
            value={job.project?.contractNumber ?? ''}
          />
          <InfoRow
            label="วันเริ่มต้นสัญญา"
            value={
              job.project?.contractStartDate
                ? new Date(job.project.contractStartDate).toLocaleDateString(
                    'th-TH',
                    {
                      dateStyle: 'medium',
                    },
                  )
                : ''
            }
          />
          <InfoRow
            label="วันที่สิ้นสุดสัญญา"
            value={
              job.project?.contractEndDate
                ? new Date(job.project.contractEndDate).toLocaleDateString(
                    'th-TH',
                    {
                      dateStyle: 'medium',
                    },
                  )
                : ''
            }
          />
          {job.sla && <InfoRow label="SLA" value={formatSla(job.sla)} />}
          <InfoRow label="ผู้แจ้ง" value={job.reporter.name} />
          <InfoRow
            label="ผู้รับผิดชอบ"
            value={
              job.assignees.length > 0
                ? job.assignees.map((a) => a.name).join(', ')
                : 'ยังไม่มอบหมาย'
            }
          />
          <InfoRow
            label="วันที่แจ้ง"
            value={new Date(job.reportedAt).toLocaleString('th-TH', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          />
          {job.contactChannel && (
            <InfoRow
              label="ติดต่อมาจาก"
              value={contactChannelLabels[job.contactChannel]}
            />
          )}
          {job.startedAt && (
            <InfoRow
              label="เริ่มทำงาน"
              value={new Date(job.startedAt).toLocaleString('th-TH', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            />
          )}
          {job.completedAt && (
            <InfoRow
              label="เสร็จงาน"
              value={new Date(job.completedAt).toLocaleString('th-TH', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            />
          )}
          {job.startedAt && (
            <InfoRow label="เวลาที่ใช้ทำงาน" value={formatDuration(job)} />
          )}
        </div>

        <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-700">
          <TextBlock label="รายละเอียด" value={job.description ?? ''} />
          <TextBlock label="หมายเหตุ" value={job.remark ?? ''} />
        </div>
      </div>

      {showCustomerDetails && (
        <CustomerDetailsModal
          customerId={job.customerId}
          onClose={() => setShowCustomerDetails(false)}
        />
      )}
    </Modal>
  )
}

export default JobDetailsModal
