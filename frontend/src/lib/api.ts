import { clearAuth, getAccessToken, getRefreshToken, saveAccessToken } from './auth'

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!response.ok) return null

    const data: { accessToken: string } = await response.json()
    saveAccessToken(data.accessToken)
    return data.accessToken
  } catch {
    return null
  }
}

function doFetch(path: string, options: RequestInit, accessToken: string | null) {
  const hasBody = Boolean(options.body)
  // FormData sets its own multipart boundary — never override its Content-Type.
  const isFormData = options.body instanceof FormData

  return fetch(path, {
    ...options,
    headers: {
      // Fastify's JSON body parser rejects an empty body when Content-Type is
      // application/json (e.g. DELETE requests with no body) — only set it when there's a body.
      ...(hasBody && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  })
}

async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
  let response = await doFetch(path, options, getAccessToken())

  if (response.status === 401) {
    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null
    })
    const newAccessToken = await refreshPromise

    if (!newAccessToken) {
      clearAuth()
      window.location.href = '/login'
      throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่')
    }

    response = await doFetch(path, options, newAccessToken)
  }

  return response
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetchWithAuth(path, options)

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error ?? `คำขอล้มเหลว (${response.status})`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export async function apiFetchBlob(path: string, options: RequestInit = {}): Promise<Blob> {
  const response = await fetchWithAuth(path, options)

  if (!response.ok) {
    throw new Error(`คำขอล้มเหลว (${response.status})`)
  }

  return response.blob()
}
