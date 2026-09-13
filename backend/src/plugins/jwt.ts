import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import jwt from '@fastify/jwt'
import type { FastifyJwtNamespace } from '@fastify/jwt'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>
    requireAdmin: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface FastifyRequest extends FastifyJwtNamespace<{
    namespace: 'access'
  }> {}
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string
      role: 'ADMIN' | 'ENGINEERING' | 'SALES' | 'SUPER_ENGINEERING'
    }
    namespaces: 'access' | 'refresh'
  }
}

export default fp(async (fastify: FastifyInstance) => {
  fastify.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'change-me',
    namespace: 'access',
    sign: { expiresIn: '15m' },
  })

  fastify.register(jwt, {
    secret: process.env.JWT_REFRESH_SECRET ?? 'change-me-too',
    namespace: 'refresh',
    sign: { expiresIn: '7d' },
  })

  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.accessJwtVerify()
      } catch {
        reply.code(401).send({ error: 'Unauthorized' })
      }
    },
  )

  fastify.decorate(
    'requireAdmin',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (request.user.role !== 'ADMIN') {
        reply.code(403).send({ error: 'Forbidden' })
      }
    },
  )
})
