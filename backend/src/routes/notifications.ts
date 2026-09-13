import { z } from 'zod'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

const listQuerySchema = z.object({ all: z.string().optional() })
const notificationIdParamsSchema = z.object({ id: z.string().min(1) })

const notificationRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get(
    '/notifications',
    { schema: { querystring: listQuerySchema } },
    async (request) => {
      return fastify.prisma.notification.findMany({
        where: {
          userId: request.user.sub,
          ...(request.query.all === '1' ? {} : { read: false }),
        },
        orderBy: { createdAt: 'desc' },
      })
    },
  )

  fastify.patch(
    '/notifications/:id',
    { schema: { params: notificationIdParamsSchema } },
    async (request, reply) => {
      const notification = await fastify.prisma.notification.findUnique({
        where: { id: request.params.id },
      })
      if (!notification || notification.userId !== request.user.sub) {
        return reply.code(404).send({ error: 'Notification not found' })
      }

      return fastify.prisma.notification.update({
        where: { id: request.params.id },
        data: { read: true },
      })
    },
  )
}

export default notificationRoutes
