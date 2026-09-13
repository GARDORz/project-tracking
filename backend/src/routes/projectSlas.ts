import { z } from 'zod'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { recordAudit } from '../services/auditLog.js'

const createSlaSchema = z.object({
  slaResolutionDays: z.number().optional(),
  slaResolutionHours: z.number().optional(),
  slaResponseHours: z.number().optional(),
})

const updateSlaSchema = z.object({
  slaResolutionDays: z.number().optional(),
  slaResolutionHours: z.number().optional(),
  slaResponseHours: z.number().optional(),
  isActive: z.boolean().optional(),
})

const projectParamsSchema = z.object({
  customerId: z.string().min(1),
  projectId: z.string().min(1),
})

const slaParamsSchema = z.object({
  customerId: z.string().min(1),
  projectId: z.string().min(1),
  slaId: z.string().min(1),
})

// SLA fields are plain non-negative integers — no upper cap (unlike
// contractNotifyMonths), just floored at 0 and rounded to a whole number.
function nonNegativeInt(value: number | undefined): number | undefined {
  if (value === undefined) return undefined
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.round(value))
}

// SLA entries are a sub-resource of a project (in turn a sub-resource of a
// customer) — a project can define several (e.g. one for standard jobs, one
// for urgent ones); a job picks one at creation. Split out of customers.ts.
const projectSlaRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.post(
    '/customers/:customerId/projects/:projectId/slas',
    { schema: { params: projectParamsSchema, body: createSlaSchema } },
    async (request, reply) => {
      const project = await fastify.prisma.project.findUnique({
        where: { id: request.params.projectId },
        include: { customer: { select: { name: true } } },
      })
      if (!project || project.customerId !== request.params.customerId) {
        return reply.code(404).send({ error: 'Project not found' })
      }

      const { slaResolutionDays, slaResolutionHours, slaResponseHours } =
        request.body

      const sla = await fastify.prisma.projectSla.create({
        data: {
          projectId: project.id,
          slaResolutionDays: nonNegativeInt(slaResolutionDays) ?? 0,
          slaResolutionHours: nonNegativeInt(slaResolutionHours) ?? 0,
          slaResponseHours: nonNegativeInt(slaResponseHours) ?? 0,
        },
      })

      await recordAudit(fastify, {
        actorId: request.user.sub,
        action: 'sla.create',
        entityType: 'ProjectSla',
        entityId: sla.id,
        message: `เพิ่ม SLA ให้โปรเจค ${project.name} ของลูกค้า ${project.customer.name}`,
      })

      return reply.code(201).send(sla)
    },
  )

  fastify.patch(
    '/customers/:customerId/projects/:projectId/slas/:slaId',
    { schema: { params: slaParamsSchema, body: updateSlaSchema } },
    async (request, reply) => {
      const existing = await fastify.prisma.projectSla.findUnique({
        where: { id: request.params.slaId },
        include: {
          project: { include: { customer: { select: { name: true } } } },
        },
      })
      if (
        !existing ||
        existing.projectId !== request.params.projectId ||
        existing.project.customerId !== request.params.customerId
      ) {
        return reply.code(404).send({ error: 'SLA not found' })
      }

      const {
        slaResolutionDays,
        slaResolutionHours,
        slaResponseHours,
        isActive,
      } = request.body

      const updated = await fastify.prisma.projectSla.update({
        where: { id: request.params.slaId },
        data: {
          slaResolutionDays: nonNegativeInt(slaResolutionDays),
          slaResolutionHours: nonNegativeInt(slaResolutionHours),
          slaResponseHours: nonNegativeInt(slaResponseHours),
          isActive,
        },
      })

      // Toggle-only calls send just { isActive }; the edit form always sends the
      // three numbers together — same tell-apart trick used for other toggles.
      if (
        isActive !== undefined &&
        slaResolutionDays === undefined &&
        slaResolutionHours === undefined &&
        slaResponseHours === undefined
      ) {
        await recordAudit(fastify, {
          actorId: request.user.sub,
          action: 'sla.update',
          entityType: 'ProjectSla',
          entityId: updated.id,
          message: `${isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'} SLA ของโปรเจค ${existing.project.name} ของลูกค้า ${existing.project.customer.name}`,
        })
      } else {
        await recordAudit(fastify, {
          actorId: request.user.sub,
          action: 'sla.update',
          entityType: 'ProjectSla',
          entityId: updated.id,
          message: `แก้ไข SLA ของโปรเจค ${existing.project.name} ของลูกค้า ${existing.project.customer.name}`,
        })
      }

      return updated
    },
  )
}

export default projectSlaRoutes
