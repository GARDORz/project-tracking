import type { PrismaClient } from '@prisma/client'

// Generates job numbers like "SR202608128": SR + 4-digit year + 2-digit month +
// a running number that keeps counting up and never resets (not even across months).
// The counter lives under one fixed key in JobSequence — the "yearMonth" column name
// is a holdover from the old per-month scheme, not a real month value.
const SEQUENCE_KEY = 'GLOBAL'
const STARTING_NUMBER = 128

export async function generateJobNo(
  prisma: PrismaClient,
  now = new Date(),
): Promise<string> {
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`

  const sequence = await prisma.jobSequence.upsert({
    where: { yearMonth: SEQUENCE_KEY },
    create: { yearMonth: SEQUENCE_KEY, lastNumber: STARTING_NUMBER },
    update: { lastNumber: { increment: 1 } },
  })

  return `SR${yearMonth}${String(sequence.lastNumber).padStart(3, '0')}`
}
