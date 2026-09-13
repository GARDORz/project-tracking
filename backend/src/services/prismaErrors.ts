import { Prisma } from '@prisma/client'

// P2003 = foreign key constraint failed — used across the customer/project/
// contact/user routes to turn "there's a related row blocking this" into a
// clean 404/409 instead of a raw 500.
export function isForeignKeyConstraintError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003'
  )
}

// P2002 = unique constraint failed — e.g. a userID that's already taken.
export function isUniqueConstraintError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  )
}
