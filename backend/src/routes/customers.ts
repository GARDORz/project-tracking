import { z } from 'zod'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { recordAudit } from '../services/auditLog.js'
import { isForeignKeyConstraintError } from '../services/prismaErrors.js'
import { projectInclude } from './projects.js'

const createCustomerSchema = z.object({
  name: z.string().min(1),
  parentName: z.string().optional(),
  comment: z.string().optional(),
})

const updateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  parentName: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

const customerIdParamsSchema = z.object({ id: z.string().min(1) })

const customerIncludes = {
  contacts: { orderBy: { createdAt: 'asc' as const } },
  projects: {
    orderBy: { createdAt: 'asc' as const },
    include: projectInclude,
  },
}

// Customer CRUD only — contacts, projects, project SLAs, and project
// equipment/attachments are all sub-resources split into their own route
// files (contacts.ts, projects.ts, projectSlas.ts, projectAttachments.ts,
// projectEquipment.ts) to keep this one to a manageable size.
const customerRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/customers', async () => {
    return fastify.prisma.customer.findMany({
      orderBy: { name: 'asc' },
      include: customerIncludes,
    })
  })

  fastify.get(
    '/customers/:id',
    { schema: { params: customerIdParamsSchema } },
    async (request, reply) => {
      const customer = await fastify.prisma.customer.findUnique({
        where: { id: request.params.id },
        include: customerIncludes,
      })
      if (!customer) {
        return reply.code(404).send({ error: 'Customer not found' })
      }
      return customer
    },
  )

  fastify.post(
    '/customers',
    { schema: { body: createCustomerSchema } },
    async (request, reply) => {
      const { name, parentName, comment } = request.body

      const customer = await fastify.prisma.customer.create({
        // "ในเครือของ" defaults to the company itself when the new-customer form
        // leaves it blank.
        data: {
          name,
          parentName: parentName?.trim() || 'SYSCOMP CORPORATION CO.,LTD.',
          comment,
        },
        include: customerIncludes,
      })

      await recordAudit(fastify, {
        actorId: request.user.sub,
        action: 'customer.create',
        entityType: 'Customer',
        entityId: customer.id,
        message: `เพิ่มลูกค้า ${customer.name}`,
      })

      return reply.code(201).send(customer)
    },
  )

  fastify.patch(
    '/customers/:id',
    {
      schema: { params: customerIdParamsSchema, body: updateCustomerSchema },
    },
    async (request, reply) => {
      const { name, parentName, comment, isActive } = request.body

      try {
        const updated = await fastify.prisma.customer.update({
          where: { id: request.params.id },
          data: { name, parentName, comment, isActive },
          include: customerIncludes,
        })

        // The เปิดใช้งาน/ปิดใช้งาน toggle sends only { isActive } — everything
        // else (the edit form) always sends name/parentName/comment together —
        // so this alone tells the two calls apart without extra params.
        if (
          isActive !== undefined &&
          name === undefined &&
          parentName === undefined &&
          comment === undefined
        ) {
          await recordAudit(fastify, {
            actorId: request.user.sub,
            action: 'customer.update',
            entityType: 'Customer',
            entityId: updated.id,
            message: `${isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}ลูกค้า ${updated.name}`,
          })
        } else if (
          name !== undefined ||
          parentName !== undefined ||
          comment !== undefined
        ) {
          await recordAudit(fastify, {
            actorId: request.user.sub,
            action: 'customer.update',
            entityType: 'Customer',
            entityId: updated.id,
            message: `แก้ไขข้อมูลลูกค้า ${updated.name}`,
          })
        }

        return updated
      } catch {
        return reply.code(404).send({ error: 'Customer not found' })
      }
    },
  )

  fastify.delete(
    '/customers/:id',
    { schema: { params: customerIdParamsSchema } },
    async (request, reply) => {
      try {
        const deleted = await fastify.prisma.customer.delete({
          where: { id: request.params.id },
        })
        await recordAudit(fastify, {
          actorId: request.user.sub,
          action: 'customer.delete',
          entityType: 'Customer',
          entityId: deleted.id,
          message: `ลบลูกค้า ${deleted.name}`,
        })
        return reply.code(204).send()
      } catch (err) {
        if (isForeignKeyConstraintError(err)) {
          return reply.code(409).send({
            error: 'ไม่สามารถลบลูกค้านี้ได้ เนื่องจากมีงานที่เกี่ยวข้องอยู่',
          })
        }
        return reply.code(404).send({ error: 'Customer not found' })
      }
    },
  )
}

export default customerRoutes
