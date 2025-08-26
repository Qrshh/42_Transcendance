import { App, inject } from 'vue'
import { io, Socket } from 'socket.io-client'

const SOCKET_KEY = Symbol('socket')

export default {
  install(app: App, { url }: { url: string }) {
    const socket = io(url, {
      transports: ['websocket'],
      withCredentials: true,
    })

    socket.on('connect', () => {
      const me = localStorage.getItem('username') || ''
      if (me) socket.emit('identify', me)
    })

    // 🔐 logout forcé (ex: reset DB)
    socket.on('forceLogout', ({ reason }) => {
      try { localStorage.clear(); sessionStorage.clear() } catch {}
      window.location.replace('/login')
    })

    app.provide(SOCKET_KEY, socket)
  }
}

export function useSocket(): Socket {
  const s = inject<Socket>(SOCKET_KEY as any)
  if (!s) throw new Error('Socket non fourni (plugin manquant)')
  return s
}
