import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { generateJobNo } from '../services/jobNo.js'
import { userSummarySelect } from '../services/userSelect.js'
import { recordAudit } from '../services/auditLog.js'
import { deleteAttachmentFile } from '../services/attachmentStorage.js'

const serviceTypeSchema = z.enum(['WARRANTY', 'MA_SERVICE', 'PERCALL', 'OTHER'])
const serviceStatusSchema = z.enum([
  'NEW',
  'IN_PROGRESS',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
])
const contactChannelSchema = z.enum(['PHONE', 'EMAIL', 'LINE'])
const serviceCategorySchema = z.enum([
  'HARDWARE',
  'SOFTWARE',
  'PROFESSIONAL_SERVICE',
  'OTHER',
])

const createServiceJobSchema = z.object({
  customerId: z.string().min(1),
  projectId: z.string().nullable().optional(),
  slaId: z.string().nullable().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  type: serviceTypeSchema,
  typeOther: z.string().optional(),
  contactChannel: contactChannelSchema.nullable().optional(),
  serviceCategory: serviceCategorySchema.nullable().optional(),
  serviceCategoryOther: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
  remark: z.string().optional(),
})

const updateServiceJobSchema = z.object({
  projectId: z.string().nullable().optional(),
  slaId: z.string().nullable().optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  type: serviceTypeSchema.optional(),
  typeOther: z.string().nullable().optional(),
  contactChannel: contactChannelSchema.nullable().optional(),
  serviceCategory: serviceCategorySchema.nullable().optional(),
  serviceCategoryOther: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
  remark: z.string().optional(),
  status: serviceStatusSchema.optional(),
})

const jobNoParamsSchema = z.object({ jobNo: z.string().min(1) })

const jobIncludes = {
  customer: true,
  project: {
    select: {
      id: true,
      name: true,
      projectYear: true,
      contractNumber: true,
      contractStartDate: true,
      contractEndDate: true,
    },
  },
  // Which of the project's SLA entries this job was measured against, if any.
  sla: {
    select: {
      id: true,
      slaResolutionDays: true,
      slaResolutionHours: true,
      slaResponseHours: true,
    },
  },
  reporter: { select: userSummarySelect },
  assignees: { select: { user: { select: userSummarySelect } } },
  // storedName is an internal disk filename — never exposed to the client.
  attachments: {
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      size: true,
      uploadedAt: true,
    },
    orderBy: { uploadedAt: 'asc' as const },
  },
} as const

// The API shape keeps `assignees` as a flat list of users (dropping the join-row
// wrapper) so the frontend doesn't need to know about the ServiceJobAssignee table.
// `elapsedSeconds` is computed at read time: banked `workedSeconds` plus whatever has
// elapsed in the current IN_PROGRESS segment, if the job is in progress right now.
function serializeJob<
  T extends {
    assignees: { user: unknown }[]
    status: string
    workedSeconds: number
    currentSegmentStartedAt: Date | null
  },
>(job: T) {
  const elapsedSeconds =
    job.workedSeconds +
    (job.status === 'IN_PROGRESS' && job.currentSegmentStartedAt
      ? Math.floor((Date.now() - job.currentSegmentStartedAt.getTime()) / 1000)
      : 0)
  return { ...job, assignees: job.assignees.map((a) => a.user), elapsedSeconds }
}

// Computes the time-tracking field updates for a status change. Only called when
// `status` actually differs from the job's current status.
export function computeTimeTracking(
  previousStatus: string,
  nextStatus: string,
  existing: {
    startedAt: Date | null
    workedSeconds: number
    currentSegmentStartedAt: Date | null
  },
) {
  const now = new Date()
  let workedSeconds = existing.workedSeconds
  if (previousStatus === 'IN_PROGRESS' && existing.currentSegmentStartedAt) {
    workedSeconds += Math.floor(
      (now.getTime() - existing.currentSegmentStartedAt.getTime()) / 1000,
    )
  }

  if (nextStatus === 'IN_PROGRESS') {
    // Resuming (or starting for the first time) opens a new segment; leaving
    // COMPLETED this way means the job isn't finished anymore. `startedAt` is only
    // ever set once — the very first time the job enters IN_PROGRESS.
    return {
      startedAt: existing.startedAt ?? now,
      workedSeconds,
      currentSegmentStartedAt: now,
      completedAt: null,
    }
  }

  return {
    workedSeconds,
    currentSegmentStartedAt: null,
    completedAt: nextStatus === 'COMPLETED' ? now : null,
  }
}

export function canManageJob(
  role: 'ADMIN' | 'ENGINEERING' | 'SALES' | 'SUPER_ENGINEERING',
  userId: string,
  job: { reporterId: string; assignees: { userId: string }[] },
) {
  // SALES is view/download/share-only — never allowed to manage a job, even if
  // somehow listed as its reporter or an assignee.
  if (role === 'SALES') return false

  // SUPER_ENGINEERING can manage any job, same as ADMIN — it just can't delete
  // one (that check lives separately on the DELETE route, still ADMIN-only).
  return (
    role === 'ADMIN' ||
    role === 'SUPER_ENGINEERING' ||
    job.reporterId === userId ||
    job.assignees.some((a) => a.userId === userId)
  )
}

// Guards against picking a project that belongs to a different customer than the job.
async function assertProjectBelongsToCustomer(
  fastify: FastifyInstance,
  projectId: string,
  customerId: string,
) {
  const project = await fastify.prisma.project.findUnique({
    where: { id: projectId },
  })
  return project != null && project.customerId === customerId
}

// Guards against picking an SLA entry that belongs to a different project than the job.
async function assertSlaBelongsToProject(
  fastify: FastifyInstance,
  slaId: string,
  projectId: string,
) {
  const sla = await fastify.prisma.projectSla.findUnique({
    where: { id: slaId },
  })
  return sla != null && sla.projectId === projectId
}

// Notifies each of `assigneeIds` that `actorId` handed them a job — skips the actor
// themselves when they're in the list (assigning to yourself needs no notification).
async function notifyAssignment(
  fastify: FastifyInstance,
  actorId: string,
  assigneeIds: string[],
  jobNo: string,
  title: string,
) {
  const recipients = assigneeIds.filter((id) => id !== actorId)
  if (recipients.length === 0) return

  const actor = await fastify.prisma.user.findUnique({
    where: { id: actorId },
    select: { name: true },
  })

  await fastify.prisma.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      jobNo,
      message: `${actor?.name ?? 'ไม่ทราบชื่อ'} มอบหมายงาน ${jobNo}: ${title} ให้คุณ`,
    })),
  })
}

const serviceJobRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/service-jobs', async () => {
    const jobs = await fastify.prisma.serviceJob.findMany({
      orderBy: { reportedAt: 'desc' },
      include: jobIncludes,
    })
    return jobs.map(serializeJob)
  })

  fastify.get(
    '/service-jobs/:jobNo',
    { schema: { params: jobNoParamsSchema } },
    async (request, reply) => {
      const job = await fastify.prisma.serviceJob.findUnique({
        where: { jobNo: request.params.jobNo },
        include: jobIncludes,
      })
      if (!job) {
        return reply.code(404).send({ error: 'Service job not found' })
      }
      return serializeJob(job)
    },
  )

  fastify.post(
    '/service-jobs',
    { schema: { body: createServiceJobSchema } },
    async (request, reply) => {
      if (request.user.role === 'SALES') {
        return reply
          .code(403)
          .send({ error: 'บัญชีฝ่ายขายไม่สามารถสร้างงานได้' })
      }

      const {
        customerId,
        projectId,
        slaId,
        title,
        description,
        type,
        typeOther,
        contactChannel,
        serviceCategory,
        serviceCategoryOther,
        assigneeIds,
        remark,
      } = request.body

      if (
        projectId &&
        !(await assertProjectBelongsToCustomer(fastify, projectId, customerId))
      ) {
        return reply
          .code(400)
          .send({ error: 'โปรเจคที่เลือกไม่ได้อยู่ในลูกค้ารายนี้' })
      }

      if (
        slaId &&
        (!projectId ||
          !(await assertSlaBelongsToProject(fastify, slaId, projectId)))
      ) {
        return reply
          .code(400)
          .send({ error: 'SLA ที่เลือกไม่ได้อยู่ในโปรเจคนี้' })
      }

      const jobNo = await generateJobNo(fastify.prisma)
      // Default to the reporter themselves when no assignee is chosen.
      const finalAssigneeIds =
        assigneeIds && assigneeIds.length > 0 ? assigneeIds : [request.user.sub]
      const job = await fastify.prisma.serviceJob.create({
        data: {
          jobNo,
          reporterId: request.user.sub,
          customerId,
          projectId: projectId || undefined,
          slaId: slaId || undefined,
          title,
          description,
          type,
          // Every type reuses this field: OTHER for its free-text label,
          // every other type for its CM/PM checkboxes.
          typeOther,
          contactChannel: contactChannel || undefined,
          serviceCategory: serviceCategory || undefined,
          serviceCategoryOther: serviceCategoryOther || undefined,
          remark,
          assignees: {
            createMany: {
              data: finalAssigneeIds.map((userId) => ({ userId })),
            },
          },
        },
        include: jobIncludes,
      })

      await notifyAssignment(
        fastify,
        request.user.sub,
        finalAssigneeIds,
        jobNo,
        title,
      )

      await recordAudit(fastify, {
        actorId: request.user.sub,
        action: 'job.create',
        entityType: 'ServiceJob',
        entityId: jobNo,
        message: `สร้างใบงาน ${jobNo} (หัวข้อ: ${title})`,
      })

      return reply.code(201).send(serializeJob(job))
    },
  )

  fastify.patch(
    '/service-jobs/:jobNo',
    { schema: { params: jobNoParamsSchema, body: updateServiceJobSchema } },
    async (request, reply) => {
      const existing = await fastify.prisma.serviceJob.findUnique({
        where: { jobNo: request.params.jobNo },
        include: { assignees: { select: { userId: true } } },
      })
      if (!existing) {
        return reply.code(404).send({ error: 'Service job not found' })
      }

      if (!canManageJob(request.user.role, request.user.sub, existing)) {
        return reply.code(403).send({
          error:
            'คุณไม่มีสิทธิ์แก้ไขงานนี้ (ต้องเป็นผู้แจ้ง ผู้รับผิดชอบ หรือแอดมิน)',
        })
      }

      const {
        projectId,
        slaId,
        title,
        description,
        type,
        typeOther,
        contactChannel,
        serviceCategory,
        serviceCategoryOther,
        assigneeIds,
        remark,
        status,
      } = request.body

      if (
        projectId &&
        !(await assertProjectBelongsToCustomer(
          fastify,
          projectId,
          existing.customerId,
        ))
      ) {
        return reply
          .code(400)
          .send({ error: 'โปรเจคที่เลือกไม่ได้อยู่ในลูกค้ารายนี้' })
      }

      // The project this job will belong to after this update — needed to
      // validate slaId against the right project, whether or not projectId
      // itself is part of this particular PATCH.
      const nextProjectId =
        projectId === undefined ? existing.projectId : projectId || null

      if (
        slaId &&
        (!nextProjectId ||
          !(await assertSlaBelongsToProject(fastify, slaId, nextProjectId)))
      ) {
        return reply
          .code(400)
          .send({ error: 'SLA ที่เลือกไม่ได้อยู่ในโปรเจคนี้' })
      }

      // If the project is changing and slaId wasn't explicitly resent, drop the
      // old SLA selection rather than silently leave it pointing at a different project.
      const slaUpdate =
        slaId !== undefined
          ? { slaId: slaId || null }
          : projectId !== undefined && projectId !== existing.projectId
            ? { slaId: null }
            : {}

      // Only recompute time-tracking fields when status is actually changing —
      // JobEditModal's calls (which never touch status) must leave the clock alone.
      const timeTracking =
        status !== undefined && status !== existing.status
          ? computeTimeTracking(existing.status, status, existing)
          : {}

      let updated
      try {
        updated = await fastify.prisma.serviceJob.update({
          where: { jobNo: request.params.jobNo },
          data: {
            projectId: projectId === undefined ? undefined : projectId || null,
            title,
            description,
            type,
            // Every type reuses this field: OTHER for its free-text label,
            // every other type for its CM/PM checkboxes.
            typeOther,
            contactChannel:
              contactChannel === undefined ? undefined : contactChannel || null,
            serviceCategory:
              serviceCategory === undefined
                ? undefined
                : serviceCategory || null,
            serviceCategoryOther:
              serviceCategoryOther === undefined
                ? undefined
                : serviceCategoryOther || null,
            remark,
            status,
            ...slaUpdate,
            ...timeTracking,
            ...(assigneeIds && {
              assignees: {
                deleteMany: {},
                createMany: { data: assigneeIds.map((userId) => ({ userId })) },
              },
            }),
          },
          include: jobIncludes,
        })
      } catch {
        return reply.code(404).send({ error: 'Service job not found' })
      }

      if (assigneeIds) {
        const existingIds = new Set(existing.assignees.map((a) => a.userId))
        const newlyAdded = assigneeIds.filter((id) => !existingIds.has(id))
        await notifyAssignment(
          fastify,
          request.user.sub,
          newlyAdded,
          request.params.jobNo,
          updated.title,
        )
      }

      // JobStatusModal sends only { status }; JobEditModal sends everything
      // else but never status — the two calls never overlap in practice.
      if (status !== undefined) {
        await recordAudit(fastify, {
          actorId: request.user.sub,
          action: 'job.status_change',
          entityType: 'ServiceJob',
          entityId: updated.jobNo,
          message: `เปลี่ยนสถานะใบงาน ${updated.jobNo} เป็น ${status}`,
        })
      } else if (
        title !== undefined ||
        description !== undefined ||
        type !== undefined ||
        assigneeIds !== undefined ||
        remark !== undefined ||
        projectId !== undefined
      ) {
        await recordAudit(fastify, {
          actorId: request.user.sub,
          action: 'job.update',
          entityType: 'ServiceJob',
          entityId: updated.jobNo,
          message: `แก้ไขข้อมูลใบงาน ${updated.jobNo}`,
        })
      }

      return serializeJob(updated)
    },
  )

  // Deleting a job is ADMIN-only, even for the reporter/assignee.
  fastify.delete(
    '/service-jobs/:jobNo',
    { preHandler: fastify.requireAdmin, schema: { params: jobNoParamsSchema } },
    async (request, reply) => {
      let deleted
      try {
        deleted = await fastify.prisma.serviceJob.delete({
          where: { jobNo: request.params.jobNo },
          include: { attachments: true },
        })
      } catch {
        return reply.code(404).send({ error: 'Service job not found' })
      }

      await Promise.all(
        deleted.attachments.map((a) => deleteAttachmentFile(a.storedName)),
      )

      await recordAudit(fastify, {
        actorId: request.user.sub,
        action: 'job.delete',
        entityType: 'ServiceJob',
        entityId: deleted.jobNo,
        message: `ลบใบงาน ${deleted.jobNo} (หัวข้อ: ${deleted.title})`,
      })

      return reply.code(204).send()
    },
  )

  // ServiceJob's file-attachment sub-resource (upload/download/delete) lives in
  // jobAttachments.ts, registered separately in app.ts under the same prefix.
}

export default serviceJobRoutes
