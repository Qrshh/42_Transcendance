import { reactive, ref, onMounted, onUnmounted } from 'vue'
import { useSocket } from '../views/plugins/socket'
import { useApi } from './useApi'

type Msg = { sender: string; receiver: string; content: string; timestamp?: string }

export function useChat(me: string) {
  const socket = useSocket()
  const { get, post } = useApi()
  const byPeer = reactive<Record<string, Msg[]>>({})
  const sending = ref(false)
  const lastError = ref<string | null>(null)

  const ensure = (peer: string) => (byPeer[peer] ||= [])

  async function loadHistory(peer: string) {
    const rows = await get<Msg[]>(`/chat/message/${encodeURIComponent(me)}/${encodeURIComponent(peer)}`)
    byPeer[peer] = rows
  }

  async function send(peer: string, content: string) {
    lastError.value = null
    sending.value = true
    try {
      // HTTP pour persistance (ton backend le fait déjà)
      await post('/chat/message', { sender: me, receiver: peer, content })
      // socket pour temps réel
      socket.emit('sendMessage', { sender: me, receiver: peer, content })
      ensure(peer).push({ sender: me, receiver: peer, content, timestamp: new Date().toISOString() })
    } catch (e: any) {
      lastError.value = e?.error || e?.message || 'Erreur envoi'
    } finally {
      sending.value = false
    }
  }

  function onSocketMessage(msg: Msg) {
    const peer = msg.sender === me ? msg.receiver : msg.sender
    ensure(peer).push(msg)
  }

  onMounted(() => {
    socket.on('newMessage', onSocketMessage)
  })
  onUnmounted(() => {
    socket.off('newMessage', onSocketMessage)
  })

  return { byPeer, loadHistory, send, sending, lastError }
}
