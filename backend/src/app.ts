import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import swagger from '@fastify/swagger'
import {
  validatorCompiler,
  serializerCompiler,
  jsonSchemaTransform,
  hasZodFastifySchemaValidationErrors,
} from 'fastify-type-provider-zod'
import prismaPlugin from './plugins/prisma.js'
import jwtPlugin from './plugins/jwt.js'
import healthRoutes from './routes/health.js'
import authRoutes from './routes/auth.js'
import customerRoutes from './routes/customers.js'
import contactRoutes from './routes/contacts.js'
import projectRoutes from './routes/projects.js'
import projectSlaRoutes from './routes/projectSlas.js'
import serviceJobRoutes from './routes/serviceJobs.js'
import jobAttachmentRoutes from './routes/jobAttachments.js'
import userRoutes from './routes/users.js'
import notificationRoutes from './routes/notifications.js'
import publicJobRoutes from './routes/publicJobs.js'
import reportRoutes from './routes/reports.js'
import overviewRoutes from './routes/overview.js'
import auditLogRoutes from './routes/auditLog.js'
import projectAttachmentRoutes from './routes/projectAttachments.js'
import projectEquipmentRoutes from './routes/projectEquipment.js'
import projectEquipmentFaultRoutes from './routes/projectEquipmentFaults.js'
import equipmentRoutes from './routes/equipment.js'

export function buildApp() {
  // Behind nginx (which sets X-Forwarded-For/X-Real-IP via $proxy_add_x_forwarded_for —
  // an APPEND, not a replace), Fastify must be told to trust that header, but NOT
  // unconditionally: `trustProxy: true` walks the *entire* X-Forwarded-For chain and
  // trusts the left-most entry, which is whatever a client puts there themselves — a
  // bot could spoof a fresh fake IP on every request and dodge the login rate limit
  // below entirely. Trusting only private/internal addresses ('loopback,uniquelocal')
  // means Fastify stops at nginx's own honestly-appended entry (a private Docker
  // network address is never "trusted" further, since the real client beyond it has
  // a public IP) and ignores anything a client tried to inject ahead of that.
  const app = Fastify({ logger: true, trustProxy: 'loopback,uniquelocal' })

  // Every route's body/params/querystring schema below is a Zod schema (see
  // fastify-type-provider-zod) — these two compilers are what actually make
  // Fastify validate/serialize against Zod instead of raw JSON Schema/AJV.
  // Routes that declare no schema at all (e.g. multipart uploads, binary
  // downloads) are entirely unaffected — Fastify only invokes a compiler when
  // the route being handled actually has a schema for that part.
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // Generates the OpenAPI document from those same Zod schemas — exposed via
  // `app.swagger()`, which scripts/generate-openapi.ts writes to
  // <repo root>/openapi.json for the frontend's `npm run api-types:generate`
  // to turn into TypeScript types (frontend/src/lib/api-types.generated.ts).
  app.register(swagger, {
    openapi: {
      info: { title: 'Project Tracking API', version: '1.0.0' },
    },
    transform: jsonSchemaTransform,
  })

  // Every route's request-validation failure (bad body/params/querystring)
  // comes through here as a Zod error — reshaped into the same flat
  // `{ error: string }` the frontend's apiFetch() already expects from every
  // hand-written validation check elsewhere in the API.
  app.setErrorHandler((error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      const message = error.validation
        .map((issue) => {
          const path = issue.instancePath.replace(/^\//, '').replace(/\//g, '.')
          return path ? `${path}: ${issue.message}` : issue.message
        })
        .join(', ')
      return reply.code(400).send({ error: message })
    }
    return reply.send(error)
  })

  // Only the known frontend origin(s) may call this API — set via env for each environment.
  const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  app.register(cors, { origin: allowedOrigins })

  app.register(helmet, {
    // This API is deliberately called cross-origin by the frontend (separate dev
    // server/domain), so downloads (attachments, Excel export) must not be blocked
    // by the default same-origin resource policy.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })

  // Global default is a high ceiling; the login route sets its own tighter limit below.
  app.register(rateLimit, { global: false })

  app.register(multipart, {
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  })
  app.register(prismaPlugin)
  app.register(jwtPlugin)
  app.register(healthRoutes, { prefix: '/api' })
  app.register(authRoutes, { prefix: '/api' })
  app.register(customerRoutes, { prefix: '/api' })
  app.register(contactRoutes, { prefix: '/api' })
  app.register(projectRoutes, { prefix: '/api' })
  app.register(projectSlaRoutes, { prefix: '/api' })
  app.register(serviceJobRoutes, { prefix: '/api' })
  app.register(jobAttachmentRoutes, { prefix: '/api' })
  app.register(userRoutes, { prefix: '/api' })
  app.register(notificationRoutes, { prefix: '/api' })
  app.register(publicJobRoutes, { prefix: '/api' })
  app.register(reportRoutes, { prefix: '/api' })
  app.register(overviewRoutes, { prefix: '/api' })
  app.register(auditLogRoutes, { prefix: '/api' })
  app.register(projectAttachmentRoutes, { prefix: '/api' })
  app.register(projectEquipmentRoutes, { prefix: '/api' })
  app.register(projectEquipmentFaultRoutes, { prefix: '/api' })
  app.register(equipmentRoutes, { prefix: '/api' })

  return app
}
