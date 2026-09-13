// Public-safe projection of a User record — never include passwordHash.
export const userSummarySelect = {
  id: true,
  userID: true,
  name: true,
  role: true,
  createdAt: true,
} as const
