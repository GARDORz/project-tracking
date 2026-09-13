import { z } from 'zod'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

const shareTokenParamsSchema = z.object({ shareToken: z.string().min(1) })

// Public, unauthenticated tracking endpoint reached via an unguessable shareToken —
// never expose reporter/assignee (internal staff) or the sequential jobNo-based lookup here.
const publicJobRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    '/public/service-jobs/:shareToken',
    { schema: { params: shareTokenParamsSchema } },
    async (request, reply) => {
      const job = await fastify.prisma.serviceJob.findUnique({
        where: { shareToken: request.params.shareToken },
        select: {
          jobNo: true,
          title: true,
          type: true,
          status: true,
          remark: true,
          reportedAt: true,
          customer: { select: { name: true } },
        },
      })

      if (!job) {
        return reply.code(404).send({ error: 'ไม่พบข้อมูลงานนี้' })
      }

      return job
    },
  )
}

export default publicJobRoutes
