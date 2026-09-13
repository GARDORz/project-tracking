import { z } from 'zod'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { recordAudit } from '../services/auditLog.js'
import {
  describeEquipment,
  requireProject,
  projectNameById,
  equipmentBodySchema,
  projectIdParamsSchema,
  equipmentParamsSchema,
} from './projectEquipment.js'

const FAULT_SELECT = {
  id: true,
  brand: true,
  model: true,
  serialNo: true,
  description: true,
  reportedAt: true,
} as const

const faultParamsSchema = z.object({
  projectId: z.string().min(1),
  faultId: z.string().min(1),
})

// Split out of projectEquipment.ts — this is the (currently UI-hidden, see
// frontend/src/lib/featureFlags.ts) faulty-equipment log for a project.
// Registered under the same '/api' prefix as projectEquipment.ts.
const projectEquipmentFaultRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  // Faulty-equipment log for this project (a separate view toggled on the
  // equipment page).
  fastify.get(
    '/projects/:projectId/equipment/faults',
    { schema: { params: projectIdParamsSchema } },
    async (request, reply) => {
      const project = await requireProject(
        fastify,
        request.params.projectId,
        reply,
      )
      if (!project) return

      const faults = await fastify.prisma.projectEquipmentFault.findMany({
        where: { projectId: project.id },
        select: FAULT_SELECT,
        orderBy: { reportedAt: 'desc' },
      })
      return { project, faults }
    },
  )

  // Add a fault-log entry by hand (for items not in the equipment list, or a
  // one-off). Same shape as the manual equipment add.
  fastify.post(
    '/projects/:projectId/equipment/faults',
    { schema: { params: projectIdParamsSchema, body: equipmentBodySchema } },
    async (request, reply) => {
      const project = await requireProject(
        fastify,
        request.params.projectId,
        reply,
      )
      if (!project) return

      const { brand, model, serialNo, description } = request.body
      if (!brand && !model && !serialNo && !description) {
        return reply
          .code(400)
          .send({ error: 'กรุณากรอกข้อมูลอย่างน้อยหนึ่งช่อง' })
      }

      const created = await fastify.prisma.projectEquipmentFault.create({
        data: {
          projectId: project.id,
          brand: brand?.trim() || null,
          model: model?.trim() || null,
          serialNo: serialNo?.trim() || null,
          description: description?.trim() || null,
        },
        select: FAULT_SELECT,
      })

      await recordAudit(fastify, {
        actorId: request.user.sub,
        action: 'equipment.fault_create',
        entityType: 'Project',
        entityId: project.id,
        message: `เพิ่มอุปกรณ์เสียด้วยตนเองในโปรเจค ${project.name}: ${describeEquipment(created)}`,
      })

      return reply.code(201).send(created)
    },
  )

  // Flag one existing equipment item as faulty — copies its four fields into the
  // fault log (not a foreign key, so it survives an equipment re-import).
  fastify.post(
    '/projects/:projectId/equipment/:equipmentId/fault',
    { schema: { params: equipmentParamsSchema } },
    async (request, reply) => {
      const item = await fastify.prisma.projectEquipment.findUnique({
        where: { id: request.params.equipmentId },
      })
      if (!item || item.projectId !== request.params.projectId) {
        return reply.code(404).send({ error: 'ไม่พบอุปกรณ์' })
      }
      const created = await fastify.prisma.projectEquipmentFault.create({
        data: {
          projectId: item.projectId,
          brand: item.brand,
          model: item.model,
          serialNo: item.serialNo,
          description: item.description,
        },
        select: FAULT_SELECT,
      })

      await recordAudit(fastify, {
        actorId: request.user.sub,
        action: 'equipment.fault_flag',
        entityType: 'Project',
        entityId: item.projectId,
        message: `ทำเครื่องหมายอุปกรณ์เสียในโปรเจค ${await projectNameById(fastify, item.projectId)}: ${describeEquipment(created)}`,
      })

      return reply.code(201).send(created)
    },
  )

  fastify.delete(
    '/projects/:projectId/equipment/faults/:faultId',
    { schema: { params: faultParamsSchema } },
    async (request, reply) => {
      const existing = await fastify.prisma.projectEquipmentFault.findUnique({
        where: { id: request.params.faultId },
      })
      if (!existing || existing.projectId !== request.params.projectId) {
        return reply.code(404).send({ error: 'ไม่พบรายการ' })
      }
      await fastify.prisma.projectEquipmentFault.delete({
        where: { id: existing.id },
      })

      await recordAudit(fastify, {
        actorId: request.user.sub,
        action: 'equipment.fault_delete',
        entityType: 'Project',
        entityId: existing.projectId,
        message: `ลบรายการอุปกรณ์เสียในโปรเจค ${await projectNameById(fastify, existing.projectId)}: ${describeEquipment(existing)}`,
      })

      return reply.code(204).send()
    },
  )

  fastify.delete(
    '/projects/:projectId/equipment/faults',
    { schema: { params: projectIdParamsSchema } },
    async (request, reply) => {
      const project = await requireProject(
        fastify,
        request.params.projectId,
        reply,
      )
      if (!project) return
      const { count } = await fastify.prisma.projectEquipmentFault.deleteMany({
        where: { projectId: project.id },
      })

      if (count > 0) {
        await recordAudit(fastify, {
          actorId: request.user.sub,
          action: 'equipment.fault_delete_all',
          entityType: 'Project',
          entityId: project.id,
          message: `ลบรายการอุปกรณ์เสียทั้งหมดในโปรเจค ${project.name} จำนวน ${count} รายการ`,
        })
      }

      return reply.code(204).send()
    },
  )
}

export default projectEquipmentFaultRoutes
