import { z } from 'zod'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import bcrypt from 'bcryptjs'
import { userSummarySelect } from '../services/userSelect.js'
import { recordAudit } from '../services/auditLog.js'
import {
  isForeignKeyConstraintError,
  isUniqueConstraintError,
} from '../services/prismaErrors.js'

type Role = 'ADMIN' | 'ENGINEERING' | 'SALES' | 'SUPER_ENGINEERING'
const roleSchema = z.enum([
  'ADMIN',
  'ENGINEERING',
  'SALES',
  'SUPER_ENGINEERING',
])

const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร'),
})

const createUserSchema = z.object({
  userID: z.string().min(1),
  name: z.string().min(1),
  password: z.string().min(1),
  role: roleSchema,
})

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: roleSchema.optional(),
  password: z.string().min(1).optional(),
})

const userIdParamsSchema = z.object({ id: z.string().min(1) })

const userRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  // Any authenticated user can list users (e.g. to pick an assignee for a job).
  // Creating/editing/deleting user accounts stays ADMIN-only, enforced per-route below.
  fastify.get('/users', async () => {
    return fastify.prisma.user.findMany({
      select: userSummarySelect,
      orderBy: { name: 'asc' },
    })
  })

  // Self-service password change — any authenticated user changing their OWN
  // password, gated by knowing the current one (not an admin reset).
  fastify.patch(
    '/users/me/password',
    { schema: { body: changeOwnPasswordSchema } },
    async (request, reply) => {
      const { currentPassword, newPassword } = request.body

      const user = await fastify.prisma.user.findUnique({
        where: { id: request.user.sub },
      })
      if (!user) {
        return reply.code(404).send({ error: 'User not found' })
      }

      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        user.passwordHash,
      )
      if (!isCurrentPasswordValid) {
        return reply.code(401).send({ error: 'รหัสผ่านเดิมไม่ถูกต้อง' })
      }

      const passwordHash = await bcrypt.hash(newPassword, 10)
      await fastify.prisma.user.update({
        where: { id: request.user.sub },
        data: { passwordHash },
      })

      return { success: true }
    },
  )

  fastify.post(
    '/users',
    { preHandler: fastify.requireAdmin, schema: { body: createUserSchema } },
    async (request, reply) => {
      const { userID, name, password, role } = request.body

      const passwordHash = await bcrypt.hash(password, 10)
      try {
        const user = await fastify.prisma.user.create({
          data: { userID, name, passwordHash, role },
          select: userSummarySelect,
        })
        await recordAudit(fastify, {
          actorId: request.user.sub,
          action: 'user.create',
          entityType: 'User',
          entityId: user.id,
          message: `เพิ่มผู้ใช้งาน ${user.userID} (${user.name}, บทบาท ${user.role})`,
        })
        return reply.code(201).send(user)
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          return reply.code(409).send({ error: 'userID นี้ถูกใช้แล้ว' })
        }
        throw err
      }
    },
  )

  fastify.patch(
    '/users/:id',
    {
      preHandler: fastify.requireAdmin,
      schema: { params: userIdParamsSchema, body: updateUserSchema },
    },
    async (request, reply) => {
      const { name, role, password } = request.body
      const data: { name?: string; role?: Role; passwordHash?: string } = {
        name,
        role,
      }
      if (password) {
        data.passwordHash = await bcrypt.hash(password, 10)
      }

      try {
        const existing = await fastify.prisma.user.findUnique({
          where: { id: request.params.id },
          select: { userID: true, name: true, role: true },
        })

        const updated = await fastify.prisma.user.update({
          where: { id: request.params.id },
          data,
          select: userSummarySelect,
        })

        if (existing && role !== undefined && role !== existing.role) {
          await recordAudit(fastify, {
            actorId: request.user.sub,
            action: 'user.role_change',
            entityType: 'User',
            entityId: updated.id,
            message: `เปลี่ยนบทบาทผู้ใช้งาน ${updated.userID} จาก ${existing.role} เป็น ${role}`,
          })
        }

        // Name change and password reset are logged as one combined "update"
        // entry, separate from the role-change entry above — a single save in
        // UserFormModal can trigger both at once (e.g. rename + reset password).
        const nameChanged =
          existing && name !== undefined && name !== existing.name
        const passwordReset = Boolean(password)
        if (nameChanged || passwordReset) {
          const parts = [
            nameChanged && `เปลี่ยนชื่อเป็น ${name}`,
            passwordReset && 'รีเซ็ตรหัสผ่าน',
          ].filter(Boolean)
          await recordAudit(fastify, {
            actorId: request.user.sub,
            action: 'user.update',
            entityType: 'User',
            entityId: updated.id,
            message: `แก้ไขผู้ใช้งาน ${updated.userID} (${parts.join(', ')})`,
          })
        }

        return updated
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          return reply.code(409).send({ error: 'userID นี้ถูกใช้แล้ว' })
        }
        return reply.code(404).send({ error: 'User not found' })
      }
    },
  )

  fastify.delete(
    '/users/:id',
    {
      preHandler: fastify.requireAdmin,
      schema: { params: userIdParamsSchema },
    },
    async (request, reply) => {
      if (request.params.id === request.user.sub) {
        return reply.code(400).send({ error: 'ไม่สามารถลบบัญชีตัวเองได้' })
      }

      try {
        const deleted = await fastify.prisma.user.delete({
          where: { id: request.params.id },
        })
        await recordAudit(fastify, {
          actorId: request.user.sub,
          action: 'user.delete',
          entityType: 'User',
          entityId: deleted.id,
          message: `ลบผู้ใช้งาน ${deleted.userID} (${deleted.name})`,
        })
        return reply.code(204).send()
      } catch (err) {
        if (isForeignKeyConstraintError(err)) {
          return reply.code(409).send({
            error: 'ไม่สามารถลบผู้ใช้นี้ได้ เนื่องจากมีงานที่เกี่ยวข้องอยู่',
          })
        }
        return reply.code(404).send({ error: 'User not found' })
      }
    },
  )
}

export default userRoutes
