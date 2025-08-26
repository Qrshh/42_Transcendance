const API_BASE = 'http://localhost:3000'

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    credentials: 'include',
  })
  const txt = await r.text()
  let data: any = null
  try { data = txt ? JSON.parse(txt) : null } catch { data = txt }
  if (!r.ok) throw Object(data || { error: r.statusText, status: r.status })
  return data as T
}

export function useApi() {
  return {
    API_BASE,
    get: <T>(path: string) => jsonFetch<T>(`${API_BASE}${path}`),
    post: <T>(path: string, body: any) =>
      jsonFetch<T>(`${API_BASE}${path}`, { method: 'POST', body: JSON.stringify(body) }),
  }
}
