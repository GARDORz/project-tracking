import type { FastifyInstance } from 'fastify'
import { checkContractExpiries } from './contractReminders.js'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

function msUntilNextMidnight(): number {
  const now = new Date()
  const next = new Date(now)
  next.setHours(24, 0, 0, 0) // rolls forward to midnight of the next day
  return next.getTime() - now.getTime()
}

// No cron dependency needed for a single daily job — just wait until the next
// midnight, run once, then repeat every 24h from there.
export function scheduleContractReminders(app: FastifyInstance): void {
  async function run() {
    try {
      await checkContractExpiries(app.prisma)
    } catch (err) {
      app.log.error(err, 'contract expiry check failed')
    }
  }

  setTimeout(() => {
    run()
    setInterval(run, ONE_DAY_MS)
  }, msUntilNextMidnight())
}
