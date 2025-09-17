import { App, inject } from 'vue'
import { io, Socket } from 'socket.io-client'

const SOCKET_KEY = Symbol('socket')

// Détection automatique de l'URL du serveur WebSocket
function getSocketUrl(): string {
  const { protocol, hostname, port } = window.location
  const secure = protocol === 'https:'
  const socketScheme = secure ? 'wss' : 'ws'
  const socketPort = port ? `:${port}` : secure ? '' : ':3000'
  return `${socketScheme}://${hostname}${socketPort}`
}

function normaliseSocketUrl(url?: string): string {
  if (!url) return getSocketUrl()
  if (/^wss?:\/\//i.test(url)) return url
  if (/^https?:\/\//i.test(url)) {
    const secure = url.toLowerCase().startsWith('https://')
    return url.replace(/^https?/i, secure ? 'wss' : 'ws')
  }
  if (url.startsWith('/')) {
    const base = window.location.origin.replace(/^http/i, window.location.protocol === 'https:' ? 'wss' : 'ws')
    return `${base.replace(/\/$/, '')}${url}`
  }
  return url
}

export default {
  install(app: App, options?: { url?: string }) {
    // Utilise l'URL fournie ou détecte automatiquement
    const socketUrl = normaliseSocketUrl(options?.url)
    
    const socket = io(socketUrl, {
      transports: ['websocket'],
      withCredentials: true,
    })

    socket.on('connect', () => {
      const me = localStorage.getItem('username') || ''
      if (me) socket.emit('identify', me)
    })

    // logout forcé (ex: reset DB)
    socket.on('forceLogout', ({ reason }) => {
      try { localStorage.clear(); sessionStorage.clear() } catch {}
      window.location.replace('/login')
    })

    // Log pour debug
    console.log(`WebSocket connecté sur: ${socketUrl}`)

    app.provide(SOCKET_KEY, socket)
  }
}

export function useSocket(): Socket {
  const s = inject<Socket>(SOCKET_KEY as any)
  if (!s) throw new Error('Socket non fourni (plugin manquant)')
  return s
}
