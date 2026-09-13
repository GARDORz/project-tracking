import { z } from 'zod'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

const listQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  actorId: z.string().optional(),
})

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

const auditLogRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  // ADMIN-only — this is a security/accountability trail, not a general feature page.
  fastify.get(
    '/audit-log',
    {
      preHandler: fastify.requireAdmin,
      schema: { querystring: listQuerySchema },
    },
    async (request) => {
      const { from, to, actorId } = request.query
      const page = Math.max(1, Number(request.query.page) || 1)
      const limit = Math.min(
        MAX_LIMIT,
        Math.max(1, Number(request.query.limit) || DEFAULT_LIMIT),
      )

      // `from`/`to` come from <input type="datetime-local"> values (e.g.
      // "2026-09-04T13:00") — `new Date()` parses that as local time directly,
      // same convention the date-only filters elsewhere in the app already use.
      const createdAt: { gte?: Date; lte?: Date } = {}
      if (from) createdAt.gte = new Date(from)
      if (to) createdAt.lte = new Date(to)

      const where = {
        ...(Object.keys(createdAt).length > 0 && { createdAt }),
        ...(actorId && { actorId }),
      }

      const [entries, total] = await Promise.all([
        fastify.prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { actor: { select: { userID: true, name: true } } },
        }),
        fastify.prisma.auditLog.count({ where }),
      ])

      return { entries, total, page, limit }
    },
  )
}

export default auditLogRoutes
