import { z } from 'zod'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { recordAudit } from '../services/auditLog.js'
import { isForeignKeyConstraintError } from '../services/prismaErrors.js'

const createContactSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().optional(),
})

const updateContactSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

const contactParamsSchema = z.object({
  customerId: z.string().min(1),
  contactId: z.string().min(1),
})

const customerIdParamsSchema = z.object({ customerId: z.string().min(1) })

// Contacts are managed as their own sub-resource of a customer (a separate
// modal on the frontend, not bundled into the customer create/update
// payload) — split out of customers.ts to keep that file to just customer CRUD.
const contactRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.post(
    '/customers/:customerId/contacts',
    {
      schema: { params: customerIdParamsSchema, body: createContactSchema },
    },
    async (request, reply) => {
      const { name, phone, email } = request.body

      try {
        const contact = await fastify.prisma.customerContact.create({
          data: {
            customerId: request.params.customerId,
            name,
            phone: phone || null,
            email: email || null,
          },
        })

        await recordAudit(fastify, {
          actorId: request.user.sub,
          action: 'contact.create',
          entityType: 'CustomerContact',
          entityId: contact.id,
          message: `เพิ่มผู้ติดต่อ ${contact.name}`,
        })

        return reply.code(201).send(contact)
      } catch (err) {
        if (isForeignKeyConstraintError(err)) {
          return reply.code(404).send({ error: 'Customer not found' })
        }
        throw err
      }
    },
  )

  fastify.patch(
    '/customers/:customerId/contacts/:contactId',
    { schema: { params: contactParamsSchema, body: updateContactSchema } },
    async (request, reply) => {
      const { name, phone, email, isActive } = request.body

      const existing = await fastify.prisma.customerContact.findUnique({
        where: { id: request.params.contactId },
      })
      if (!existing || existing.customerId !== request.params.customerId) {
        return reply.code(404).send({ error: 'Contact not found' })
      }

      const updated = await fastify.prisma.customerContact.update({
        where: { id: request.params.contactId },
        data: { name, phone, email, isActive },
      })

      // Same tell-apart trick as the customer toggle — the enable/disable button
      // sends only { isActive }, the edit form always sends name/phone/email together.
      if (
        isActive !== undefined &&
        name === undefined &&
        phone === undefined &&
        email === undefined
      ) {
        await recordAudit(fastify, {
          actorId: request.user.sub,
          action: 'contact.update',
          entityType: 'CustomerContact',
          entityId: updated.id,
          message: `${isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}ผู้ติดต่อ ${updated.name}`,
        })
      } else if (
        name !== undefined ||
        phone !== undefined ||
        email !== undefined
      ) {
        await recordAudit(fastify, {
          actorId: request.user.sub,
          action: 'contact.update',
          entityType: 'CustomerContact',
          entityId: updated.id,
          message: `แก้ไขข้อมูลผู้ติดต่อ ${updated.name}`,
        })
      }

      return updated
    },
  )

  fastify.delete(
    '/customers/:customerId/contacts/:contactId',
    { schema: { params: contactParamsSchema } },
    async (request, reply) => {
      const existing = await fastify.prisma.customerContact.findUnique({
        where: { id: request.params.contactId },
      })
      if (!existing || existing.customerId !== request.params.customerId) {
        return reply.code(404).send({ error: 'Contact not found' })
      }

      await fastify.prisma.customerContact.delete({
        where: { id: request.params.contactId },
      })

      await recordAudit(fastify, {
        actorId: request.user.sub,
        action: 'contact.delete',
        entityType: 'CustomerContact',
        entityId: existing.id,
        message: `ลบผู้ติดต่อ ${existing.name}`,
      })

      return reply.code(204).send()
    },
  )
}

export default contactRoutes
