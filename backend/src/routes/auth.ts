import { z } from 'zod'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import bcrypt from 'bcryptjs'
import { recordAudit } from '../services/auditLog.js'

const loginBodySchema = z.object({
  userID: z.string().min(1),
  password: z.string().min(1),
})

const refreshBodySchema = z.object({
  refreshToken: z.string().min(1),
})

const authRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    '/auth/login',
    {
      // Brute-force protection: cap login attempts per IP, independent of the
      // (disabled-by-default) global rate limit.
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: { body: loginBodySchema },
    },
    async (request, reply) => {
      const { userID, password } = request.body

      const user = await fastify.prisma.user.findUnique({ where: { userID } })
      if (!user) {
        // Deliberately no actorId (no real user matched) — actorLabel keeps the
        // attempted userID visible in the log without ever recording the password.
        await recordAudit(fastify, {
          actorLabel: userID,
          action: 'auth.login_failure',
          entityType: 'Auth',
          message: `ล็อกอินไม่สำเร็จ: ไม่พบผู้ใช้ ${userID}`,
        })
        return reply.code(401).send({ error: 'Invalid credentials' })
      }

      const passwordValid = await bcrypt.compare(password, user.passwordHash)
      if (!passwordValid) {
        await recordAudit(fastify, {
          actorId: user.id,
          actorLabel: user.userID,
          action: 'auth.login_failure',
          entityType: 'Auth',
          entityId: user.id,
          message: `ล็อกอินไม่สำเร็จ: รหัสผ่านไม่ถูกต้อง (${user.userID})`,
        })
        return reply.code(401).send({ error: 'Invalid credentials' })
      }

      await recordAudit(fastify, {
        actorId: user.id,
        actorLabel: user.userID,
        action: 'auth.login_success',
        entityType: 'Auth',
        entityId: user.id,
        message: `ล็อกอินสำเร็จ: ${user.userID}`,
      })

      const payload = { sub: user.id, role: user.role }
      const accessToken = await fastify.jwt.access.sign(payload)
      const refreshToken = await fastify.jwt.refresh.sign(payload)

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          userID: user.userID,
          name: user.name,
          role: user.role,
        },
      }
    },
  )

  fastify.post(
    '/auth/refresh',
    { schema: { body: refreshBodySchema } },
    async (request, reply) => {
      const { refreshToken } = request.body

      try {
        const decoded = fastify.jwt.refresh.verify<{
          sub: string
          role: 'ADMIN' | 'ENGINEERING' | 'SALES' | 'SUPER_ENGINEERING'
        }>(refreshToken)
        const accessToken = await fastify.jwt.access.sign({
          sub: decoded.sub,
          role: decoded.role,
        })
        return { accessToken }
      } catch {
        return reply
          .code(401)
          .send({ error: 'Invalid or expired refresh token' })
      }
    },
  )

  fastify.post('/auth/logout', async () => {
    // Stateless JWT: nothing to invalidate server-side, client discards its tokens.
    return { success: true }
  })

  fastify.get(
    '/auth/me',
    { preHandler: fastify.authenticate },
    async (request) => {
      return { userId: request.user.sub, role: request.user.role }
    },
  )
}

export default authRoutes
