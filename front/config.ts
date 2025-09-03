// Configuration dynamique de l'API basée sur l'hostname du navigateur,
// avec override possible via VITE_API_BASE (mettre "auto" pour forcer le mode dynamique)
const envBase = (import.meta as any).env?.VITE_API_BASE as string | undefined
const backPort = (import.meta as any).env?.VITE_BACK_PORT || '3000'

function computeDynamicBase(): string {
  const host = window?.location?.hostname || 'localhost'
  const scheme = window?.location?.protocol === 'https:' ? 'https' : 'http'
  return `${scheme}://${host}:${backPort}`
}

const useSameOrigin = envBase === 'same-origin' || envBase === 'proxy'
const shouldAuto = !envBase || envBase === 'auto' || /\bbackend\b/i.test(String(envBase))
export const API_BASE: string = useSameOrigin
  ? (window?.location?.origin || computeDynamicBase())
  : (shouldAuto ? computeDynamicBase() : envBase!)
export const SOCKET_URL: string = (window?.location?.origin || API_BASE)
  .replace(/^http/i, (window?.location?.protocol === 'https:' || API_BASE.startsWith('https')) ? 'wss' : 'ws')

// Debug utile en dev
// eslint-disable-next-line no-console
console.log('API_BASE détectée:', API_BASE)
