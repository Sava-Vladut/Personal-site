// Thin client over the FastAPI auth backend (server/app.py). Accounts now live
// in a server-side SQLite DB instead of an in-browser sql.js blob, so they're
// shared across every browser and device. The session is an httpOnly cookie the
// server sets on login/register — credentials:'include' makes the browser send
// it back on every call. Same-origin via the Vite/nginx /api proxy.

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    let detail = `Request failed (${response.status}).`
    try {
      const data = await response.json()
      if (data?.detail) detail = data.detail
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new Error(detail)
  }

  if (response.status === 204) return null
  return response.json()
}

// ── session ────────────────────────────────────────────────────────────
export const register = (username, password) =>
  request('/auth/register', { method: 'POST', body: { username, password } })

export const login = (username, password) =>
  request('/auth/login', { method: 'POST', body: { username, password } })

export const logout = () => request('/auth/logout', { method: 'POST' })

// Resolve the current session cookie to an account, or null if not signed in.
export async function fetchSession() {
  try {
    return await request('/auth/me')
  } catch {
    return null
  }
}

// ── admin registry ───────────────────────────────────────────────────────
export const listUsers = () => request('/users')

export const createUser = ({ username, password, isAdmin = false }) =>
  request('/users', { method: 'POST', body: { username, password, isAdmin } })

export const deleteUser = (id) => request(`/users/${id}`, { method: 'DELETE' })

export const setUserAdmin = (id, isAdmin) =>
  request(`/users/${id}/admin`, { method: 'PATCH', body: { isAdmin } })

export const resetPassword = (id, password) =>
  request(`/users/${id}/password`, { method: 'POST', body: { password } })
