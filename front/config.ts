// Configuration dynamique de l'API basée sur l'hostname du navigateur,
// avec override possible via VITE_API_BASE / VITE_SOCKET_URL
const rawEnvBase = ((import.meta as any).env?.VITE_API_BASE as string | undefined)?.trim()
const envSocket = ((import.meta as any).env?.VITE_SOCKET_URL as string | undefined)?.trim()
const backPort = (import.meta as any).env?.VITE_BACK_PORT || '3000'
const DEFAULT_PROXY_PATH = '/api'

function computeDynamicBase(): string {
  const host = window?.location?.hostname || 'localhost'
  const scheme = window?.location?.protocol === 'https:' ? 'https' : 'http'
  return `${scheme}://${host}:${backPort}`
}

function joinBaseAndPath(base: string, path: string): string {
  const cleanBase = base.replace(/\/+$/, '')
  const cleanPath = `/${path.replace(/^\/+/, '')}`
  return `${cleanBase}${cleanPath === '/' ? '' : cleanPath}`
}

function resolveApiBase(): string {
  const fallbackBase = window?.location?.origin || computeDynamicBase()
  const envBase = rawEnvBase

  if (!envBase || envBase === 'auto' || /\bbackend\b/i.test(envBase)) return computeDynamicBase()
  if (envBase === 'same-origin') return fallbackBase
  if (envBase === 'proxy') return joinBaseAndPath(fallbackBase, DEFAULT_PROXY_PATH)
  if (envBase.startsWith('proxy:')) {
    const customPath = envBase.slice('proxy:'.length).trim() || DEFAULT_PROXY_PATH
    return joinBaseAndPath(fallbackBase, customPath)
  }
  if (envBase.startsWith('/')) return joinBaseAndPath(fallbackBase, envBase)
  return envBase
}

function resolveSocketBase(apiBase: string): string {
  const fallbackBase = window?.location?.origin || computeDynamicBase()
  const target = envSocket || apiBase

  if (!target) return fallbackBase

  if (/^wss?:\/\//i.test(target)) return target
  if (/^https?:\/\//i.test(target)) {
    const secure = target.toLowerCase().startsWith('https://')
    return target.replace(/^https?/i, secure ? 'wss' : 'ws')
  }

  if (target.startsWith('/')) return fallbackBase.replace(/^http/i, fallbackBase.startsWith('https') ? 'wss' : 'ws')

  const derived = target.startsWith('ws') ? target : target.replace(/^http/i, target.startsWith('https') ? 'wss' : 'ws')
  return derived
}

function stripPath(url: string): string {
  try {
    const parsed = new URL(url, window?.location?.origin || undefined)
    parsed.pathname = ''
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return url
  }
}

const API_BASE = resolveApiBase()
const socketBase = envSocket ? resolveSocketBase(envSocket) : resolveSocketBase(stripPath(API_BASE))

export { API_BASE }
export const SOCKET_URL: string = socketBase

// Debug utile en dev
// eslint-disable-next-line no-console
console.log('API_BASE détectée:', API_BASE)
