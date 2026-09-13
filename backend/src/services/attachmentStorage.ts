import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads')

function extensionFor(originalFileName: string): string {
  const ext = path.extname(originalFileName)
  return ext.length <= 10 ? ext : '' // ignore absurd/garbage extensions
}

export async function saveAttachmentFile(
  originalFileName: string,
  buffer: Buffer,
): Promise<string> {
  await mkdir(UPLOADS_DIR, { recursive: true })
  const storedName = `${randomUUID()}${extensionFor(originalFileName)}`
  await writeFile(path.join(UPLOADS_DIR, storedName), buffer)
  return storedName
}

export async function readAttachmentFile(storedName: string): Promise<Buffer> {
  return readFile(path.join(UPLOADS_DIR, storedName))
}

export async function deleteAttachmentFile(storedName: string): Promise<void> {
  await rm(path.join(UPLOADS_DIR, storedName), { force: true })
}
