interface AuthUser {
  id: string
  userID: string
  name: string
  role: 'ADMIN' | 'ENGINEERING' | 'SALES' | 'SUPER_ENGINEERING'
}

interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

const ACCESS_TOKEN_KEY = 'accessToken'
const REFRESH_TOKEN_KEY = 'refreshToken'
const USER_KEY = 'user'

export function saveAuth(data: LoginResponse) {
  localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken)
  localStorage.setItem(USER_KEY, JSON.stringify(data.user))
}

export function clearAuth() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function saveAccessToken(accessToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  return raw ? (JSON.parse(raw) as AuthUser) : null
}

export function isAuthenticated() {
  return Boolean(getAccessToken())
}

export async function performLogout() {
  const accessToken = getAccessToken()
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
    })
  } catch {
    // Stateless logout: ignore network errors, clear locally regardless.
  }
  clearAuth()
}
