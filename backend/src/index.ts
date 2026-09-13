import 'dotenv/config'
import { buildApp } from './app.js'
import { scheduleContractReminders } from './services/scheduler.js'

const app = buildApp()
const port = Number(process.env.PORT ?? 3001)

app
  .listen({ port, host: '0.0.0.0' })
  .then(() => {
    scheduleContractReminders(app)
  })
  .catch((err) => {
    app.log.error(err)
    process.exit(1)
  })
