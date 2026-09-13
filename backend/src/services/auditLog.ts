import type { FastifyInstance } from 'fastify'

interface RecordAuditInput {
  actorId?: string | null
  actorLabel?: string | null
  action: string
  entityType?: string
  entityId?: string
  message: string
}

// Writes one audit-log row. Deliberately swallows its own errors (logged via
// fastify's logger, never thrown) — an audit-log write failing must never take
// down the actual mutation it's describing.
export async function recordAudit(
  fastify: FastifyInstance,
  input: RecordAuditInput,
): Promise<void> {
  try {
    await fastify.prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorLabel: input.actorLabel ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        message: input.message,
      },
    })
  } catch (err) {
    fastify.log.error(err, 'Failed to write audit log entry')
  }
}
