import 'dotenv/config'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildApp } from '../src/app.js'

// One-off script (not part of the running server) that boots the app just far
// enough to read the OpenAPI document `@fastify/swagger` derives from the Zod
// schemas on every route, then writes it to <repo root>/openapi.json.
// Requires a live DB connection because `prismaPlugin` calls `$connect()` at
// `app.ready()` time — see backend/src/plugins/prisma.ts.
async function main() {
  const app = buildApp()
  await app.ready()

  const spec = app.swagger()

  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const outPath = path.resolve(__dirname, '../../openapi.json')
  await writeFile(outPath, JSON.stringify(spec, null, 2) + '\n', 'utf-8')

  console.log(`Wrote OpenAPI spec to ${outPath}`)

  await app.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
