import { z } from 'zod'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { recordAudit } from '../services/auditLog.js'
import { deleteAttachmentFile } from '../services/attachmentStorage.js'
import { isForeignKeyConstraintError } from '../services/prismaErrors.js'

const createProjectSchema = z.object({
  name: z.string().min(1),
  projectYear: z.string().nullable().optional(),
  contractNumber: z.string().optional(),
  contractStartDate: z.string().optional(),
  contractEndDate: z.string().optional(),
  contractNotifyMonths: z.number().optional(),
})

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  projectYear: z.string().nullable().optional(),
  contractNumber: z.string().nullable().optional(),
  contractStartDate: z.string().nullable().optional(),
  contractEndDate: z.string().nullable().optional(),
  contractNotifyMonths: z.number().optional(),
})

const duplicateProjectSchema = z.object({
  projectYear: z.string().nullable().optional(),
})

const customerIdParamsSchema = z.object({ customerId: z.string().min(1) })
const projectParamsSchema = z.object({
  customerId: z.string().min(1),
  projectId: z.string().min(1),
})

// Any endpoint that returns a Project must include these relations — the
// frontend dereferences project.attachments / project.slaEntries unguarded.
// Exported for customers.ts, which nests this into its own customerIncludes.
export const projectInclude = {
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
  slaEntries: { orderBy: { createdAt: 'asc' as const } },
  _count: { select: { equipment: true } },
}

// Notify-before-expiry window is capped 1-12 months; falls back to 1 when unset
// (e.g. the project form was left on its default) or given an out-of-range value.
function clampNotifyMonths(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) return 1
  return Math.min(12, Math.max(1, Math.round(value)))
}

// Projects are a sub-resource of a customer (a separate modal on the frontend,
// same as contacts) — split out of customers.ts to keep that file to just
// customer CRUD. SLA entries are a further sub-resource of a project, split
// out again into projectSlas.ts.
const projectRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.post(
    '/customers/:customerId/projects',
    {
      schema: { params: customerIdParamsSchema, body: createProjectSchema },
    },
    async (request, reply) => {
      const {
        name,
        projectYear,
        contractNumber,
        contractStartDate,
        contractEndDate,
        contractNotifyMonths,
      } = request.body

      try {
        const project = await fastify.prisma.project.create({
          data: {
            customerId: request.params.customerId,
            name,
            projectYear: projectYear?.trim() || null,
            contractNumber,
            contractStartDate: contractStartDate
              ? new Date(contractStartDate)
              : undefined,
            contractEndDate: contractEndDate
              ? new Date(contractEndDate)
              : undefined,
            contractNotifyMonths: clampNotifyMonths(contractNotifyMonths),
          },
          include: { customer: { select: { name: true } } },
        })

        await recordAudit(fastify, {
          actorId: request.user.sub,
          action: 'project.create',
          entityType: 'Project',
          entityId: project.id,
          message: `เพิ่มโปรเจค ${project.name} ให้ลูกค้า ${project.customer.name}`,
        })

        if (contractNumber || contractStartDate || contractEndDate) {
          await recordAudit(fastify, {
            actorId: request.user.sub,
            action: 'project.contract_update',
            entityType: 'Project',
            entityId: project.id,
            message: `ตั้งค่าสัญญาให้โปรเจค ${project.name} ของลูกค้า ${project.customer.name}`,
          })
        }

        return reply.code(201).send(project)
      } catch (err) {
        if (isForeignKeyConstraintError(err)) {
          return reply.code(404).send({ error: 'Customer not found' })
        }
        throw err
      }
    },
  )

  fastify.patch(
    '/customers/:customerId/projects/:projectId',
    { schema: { params: projectParamsSchema, body: updateProjectSchema } },
    async (request, reply) => {
      const {
        name,
        isActive,
        projectYear,
        contractNumber,
        contractStartDate,
        contractEndDate,
        contractNotifyMonths,
      } = request.body

      const existing = await fastify.prisma.project.findUnique({
        where: { id: request.params.projectId },
        include: { customer: { select: { name: true } } },
      })
      if (!existing || existing.customerId !== request.params.customerId) {
        return reply.code(404).send({ error: 'Project not found' })
      }

      const nextContractStartDate =
        contractStartDate === undefined
          ? undefined
          : contractStartDate
            ? new Date(contractStartDate)
            : null
      const nextContractEndDate =
        contractEndDate === undefined
          ? undefined
          : contractEndDate
            ? new Date(contractEndDate)
            : null

      // Only counts as a contract change when the submitted value both is present
      // and actually differs from what's stored — an unrelated PATCH (e.g. just
      // toggling isActive) leaves these fields undefined and must not log anything.
      const contractChanged =
        (contractNumber !== undefined &&
          contractNumber !== existing.contractNumber) ||
        (nextContractStartDate !== undefined &&
          nextContractStartDate?.getTime() !==
            existing.contractStartDate?.getTime()) ||
        (nextContractEndDate !== undefined &&
          nextContractEndDate?.getTime() !==
            existing.contractEndDate?.getTime())

      const updated = await fastify.prisma.project.update({
        where: { id: request.params.projectId },
        data: {
          name,
          isActive,
          projectYear:
            projectYear === undefined ? undefined : projectYear?.trim() || null,
          contractNumber,
          contractStartDate: nextContractStartDate,
          contractEndDate: nextContractEndDate,
          contractNotifyMonths:
            contractNotifyMonths === undefined
              ? undefined
              : clampNotifyMonths(contractNotifyMonths),
        },
        include: projectInclude,
      })

      // Same tell-apart trick as the customer/contact toggles — the enable/disable
      // button sends only { isActive }, the edit form always sends name together.
      if (isActive !== undefined && name === undefined) {
        await recordAudit(fastify, {
          actorId: request.user.sub,
          action: 'project.update',
          entityType: 'Project',
          entityId: updated.id,
          message: `${isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}โปรเจค ${updated.name} ของลูกค้า ${existing.customer.name}`,
        })
      } else if (name !== undefined) {
        await recordAudit(fastify, {
          actorId: request.user.sub,
          action: 'project.update',
          entityType: 'Project',
          entityId: updated.id,
          message: `แก้ไขข้อมูลโปรเจค ${updated.name} ของลูกค้า ${existing.customer.name}`,
        })
      }

      if (contractChanged) {
        await recordAudit(fastify, {
          actorId: request.user.sub,
          action: 'project.contract_update',
          entityType: 'Project',
          entityId: updated.id,
          message: `แก้ไขข้อมูลสัญญาของโปรเจค ${updated.name} ของลูกค้า ${existing.customer.name}`,
        })
      }

      return updated
    },
  )

  // Clone a project for a new contract year — copies the project's own fields
  // (name, contract number/dates/notify window), its SLA entries, and its
  // equipment list. Deliberately leaves out attachments (period-specific
  // documents) and service jobs (historical tickets tied to the old project).
  // The new project always starts active, regardless of the source's state.
  fastify.post(
    '/customers/:customerId/projects/:projectId/duplicate',
    { schema: { params: projectParamsSchema, body: duplicateProjectSchema } },
    async (request, reply) => {
      const source = await fastify.prisma.project.findUnique({
        where: { id: request.params.projectId },
        include: {
          customer: { select: { name: true } },
          slaEntries: true,
          equipment: true,
        },
      })
      if (!source || source.customerId !== request.params.customerId) {
        return reply.code(404).send({ error: 'Project not found' })
      }

      const projectYear = request.body.projectYear?.trim() || null

      const created = await fastify.prisma.project.create({
        data: {
          customerId: source.customerId,
          name: source.name,
          projectYear,
          contractNumber: source.contractNumber,
          contractStartDate: source.contractStartDate,
          contractEndDate: source.contractEndDate,
          contractNotifyMonths: source.contractNotifyMonths,
          isActive: true,
          slaEntries: {
            create: source.slaEntries.map((sla) => ({
              slaResolutionDays: sla.slaResolutionDays,
              slaResolutionHours: sla.slaResolutionHours,
              slaResponseHours: sla.slaResponseHours,
              isActive: sla.isActive,
            })),
          },
          equipment: {
            create: source.equipment.map((item) => ({
              brand: item.brand,
              model: item.model,
              serialNo: item.serialNo,
              description: item.description,
            })),
          },
        },
        include: projectInclude,
      })

      await recordAudit(fastify, {
        actorId: request.user.sub,
        action: 'project.duplicate',
        entityType: 'Project',
        entityId: created.id,
        message: `คัดลอกโปรเจค ${source.name} ของลูกค้า ${source.customer.name} เป็นโปรเจคใหม่${projectYear ? ` (ปี ${projectYear})` : ''}`,
      })

      return reply.code(201).send(created)
    },
  )

  fastify.delete(
    '/customers/:customerId/projects/:projectId',
    { schema: { params: projectParamsSchema } },
    async (request, reply) => {
      const existing = await fastify.prisma.project.findUnique({
        where: { id: request.params.projectId },
        include: {
          customer: { select: { name: true } },
          attachments: { select: { storedName: true } },
        },
      })
      if (!existing || existing.customerId !== request.params.customerId) {
        return reply.code(404).send({ error: 'Project not found' })
      }

      try {
        await fastify.prisma.project.delete({
          where: { id: request.params.projectId },
        })
        await Promise.all(
          existing.attachments.map((a) => deleteAttachmentFile(a.storedName)),
        )
        await recordAudit(fastify, {
          actorId: request.user.sub,
          action: 'project.delete',
          entityType: 'Project',
          entityId: existing.id,
          message: `ลบโปรเจค ${existing.name} ของลูกค้า ${existing.customer.name}`,
        })
        return reply.code(204).send()
      } catch (err) {
        if (isForeignKeyConstraintError(err)) {
          return reply.code(409).send({
            error:
              'ไม่สามารถลบโปรเจคนี้ได้ เนื่องจากมีงานที่เกี่ยวข้องอยู่ ลองปิดใช้งานแทน',
          })
        }
        throw err
      }
    },
  )
}

export default projectRoutes
