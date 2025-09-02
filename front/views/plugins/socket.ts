import { App, inject } from 'vue'
import { io, Socket } from 'socket.io-client'

const SOCKET_KEY = Symbol('socket')

// Détection automatique de l'URL du serveur WebSocket
function getSocketUrl(): string {
  const currentHost = window.location.hostname
  
  if (currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
    return `http://${currentHost}:3000`
  }
  
  return 'http://localhost:3000'
}

export default {
  install(app: App, options?: { url?: string }) {
    // Utilise l'URL fournie ou détecte automatiquement
    const socketUrl = options?.url || getSocketUrl()
    
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