<template>
  <div class="chat-container">
    <!-- En-tête du chat amélioré -->
    <div class="chat-header">
      <div class="user-info">
        <div class="user-avatar" :style="{ background: getUserColor(props.receiver) }">
          {{ getDefaultAvatar(props.receiver) }}
        </div>
        <div class="user-details">
          <h3 class="user-name">{{ props.receiver }}</h3>
          <div class="user-status" :class="{ online: isUserOnline, offline: !isUserOnline }">
            <div class="status-dot"></div>
            <span class="status-text">{{ isUserOnline ? 'En ligne' : 'Hors ligne' }}</span>
          </div>
        </div>
      </div>
      
      <div class="chat-actions">
        <button 
          @click="challengeUser" 
          class="action-btn challenge-btn"
          :disabled="!isUserOnline"
          title="Défier en partie"
        >
          <span class="action-icon">🎯</span>
          <span class="action-text">Défier</span>
        </button>
        
        <button 
          @click="viewProfile" 
          class="action-btn profile-btn"
          title="Voir le profil"
        >
          <span class="action-icon">👤</span>
        </button>
      </div>
    </div>

    <!-- Zone des messages avec scroll fixe -->
    <div class="chat-messages" ref="messagesContainer">
      <div
        v-for="(msg, index) in messages"
        :key="`${msg.timestamp}-${index}`"
        :class="msg.sender === sender ? 'message-right' : 'message-left'"
        class="message-wrapper"
      >
        <div :class="msg.sender === sender ? 'message-bubble sent' : 'message-bubble received'">
          <div class="message-header">
            <span class="message-sender">{{ msg.sender === sender ? 'Vous' : msg.sender }}</span>
            <span class="message-time">
              {{ formatTime(msg.timestamp) }}
            </span>
          </div>
          <div class="message-content">{{ msg.content }}</div>
          
          <!-- Indicateur de lecture pour les messages envoyés -->
          <div v-if="msg.sender === sender" class="message-status">
            <span class="read-indicator" :class="{ read: msg.read }">
              {{ msg.read ? '✓✓' : '✓' }}
            </span>
          </div>
        </div>
      </div>
      
      <!-- Indicateur de frappe amélioré -->
      <Transition name="typing">
        <div v-if="isTyping" class="typing-indicator">
          <div class="typing-avatar" :style="{ background: getUserColor(typingUser) }">
            {{ getDefaultAvatar(typingUser) }}
          </div>
          <div class="typing-content">
            <div class="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span class="typing-text">{{ typingUser }} est en train d'écrire...</span>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Zone d'input fixe en bas avec emojis -->
    <div class="chat-input-container">
      <!-- Barre d'emojis (optionnelle) -->
      <div v-if="showEmojiPicker" class="emoji-picker">
        <div class="emoji-grid">
          <button 
            v-for="emoji in popularEmojis" 
            :key="emoji"
            @click="addEmoji(emoji)"
            class="emoji-btn"
          >
            {{ emoji }}
          </button>
        </div>
      </div>
      
      <div class="input-wrapper">
        <button 
          @click="toggleEmojiPicker" 
          class="emoji-toggle"
          title="Emojis"
        >
          😊
        </button>
        
        <input
          v-model="message"
          @input="handleTyping"
          @keyup.enter="sendMessage"
          @keydown.escape="showEmojiPicker = false"
          type="text"
          placeholder="Tapez votre message..."
          class="message-input"
          maxlength="500"
        />
        
        <div class="input-actions">
          <span class="char-counter" :class="{ warning: message.length > 400 }">
            {{ message.length }}/500
          </span>
          
          <button
            @click="sendMessage"
            class="send-button"
            :disabled="!message.trim()"
          >
            <Transition name="send" mode="out-in">
              <span v-if="!isSending" key="send" class="send-icon">➤</span>
              <span v-else key="sending" class="sending-spinner">⏳</span>
            </Transition>
          </button>
        </div>
      </div>
    </div>

    <!-- Toast de notifications -->
    <Transition name="toast">
      <div v-if="showToast" class="toast-notification" :class="toastType">
        <span class="toast-icon">{{ getToastIcon(toastType) }}</span>
        <span class="toast-message">{{ toastMessage }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, nextTick, computed } from 'vue'
import axios from 'axios'
import type { Socket } from 'socket.io-client'

const props = defineProps<{ 
  receiver: string
  socket?: Socket
  isOnline?: boolean
}>()

const emit = defineEmits<{
  challengeUser: [username: string]
  viewProfile: [username: string]
}>()

const sender = localStorage.getItem('username') || ''

// État du chat
const message = ref('')
const messages = ref<any[]>([])
const isTyping = ref(false)
const typingUser = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const isSending = ref(false)

// État de l'interface
const showEmojiPicker = ref(false)
const showToast = ref(false)
const toastMessage = ref('')
const toastType = ref<'success' | 'error' | 'info'>('info')

// Emojis populaires
const popularEmojis = ['😊', '😂', '❤️', '👍', '👎', '😢', '😮', '😡', '🎉', '🔥', '💯', '👏', '🙏', '💪', '🎯', '⚡']

let typingTimeout: number | null = null
let socket: Socket

// Computed
const isUserOnline = computed(() => props.isOnline ?? false)

// Méthodes utilitaires
const getUserColor = (username: string) => {
  const colors = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
  ]
  return colors[username.charCodeAt(0) % colors.length]
}

const getDefaultAvatar = (username: string) => {
  const avatars = ['🎮', '🚀', '⭐', '🎯', '🏆', '💎', '🔥', '⚡', '🌟', '🎨']
  return avatars[username.charCodeAt(0) % avatars.length]
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  // Si c'est aujourd'hui, afficher seulement l'heure
  if (diff < 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }
  
  // Si c'est cette semaine, afficher le jour et l'heure
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString('fr-FR', { 
      weekday: 'short',
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }
  
  // Sinon, afficher la date complète
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getToastIcon = (type: string) => {
  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️'
  }
  return icons[type as keyof typeof icons] || 'ℹ️'
}

// Actions
const challengeUser = () => {
  if (!isUserOnline.value) {
    showToastMessage('L\'utilisateur doit être en ligne pour être défié', 'error')
    return
  }
  
  emit('challengeUser', props.receiver)
  showToastMessage(`Défi envoyé à ${props.receiver}!`, 'success')
}

const viewProfile = () => {
  emit('viewProfile', props.receiver)
}

const toggleEmojiPicker = () => {
  showEmojiPicker.value = !showEmojiPicker.value
}

const addEmoji = (emoji: string) => {
  message.value += emoji
  showEmojiPicker.value = false
  
  // Focus sur l'input après avoir ajouté l'emoji
  nextTick(() => {
    const input = document.querySelector('.message-input') as HTMLInputElement
    if (input) {
      input.focus()
    }
  })
}

const showToastMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
  toastMessage.value = msg
  toastType.value = type
  showToast.value = true
  
  setTimeout(() => {
    showToast.value = false
  }, 3000)
}

// Socket et messages
const useSocket = () => {
  if (props.socket) {
    console.log('✅ Utilisation de la socket du parent')
    return props.socket
  } else {
    console.log('⚠️ Création d\'une nouvelle socket (fallback)')
    const { io } = require('socket.io-client')
    return io('http://localhost:3000')
  }
}

const setupSocketListeners = () => {
  socket.emit('identify', sender)
  
  socket.on('newMessage', (msg) => {
    console.log('📨 Nouveau message reçu:', msg)
    if ((msg.sender === props.receiver && msg.receiver === sender) ||
        (msg.sender === sender && msg.receiver === props.receiver)) {
      
      const exists = messages.value.some(existingMsg => 
        existingMsg.content === msg.content && 
        existingMsg.sender === msg.sender && 
        Math.abs(new Date(existingMsg.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 2000
      )
      
      if (!exists) {
        messages.value.push({
          ...msg,
          read: msg.sender === sender // Marquer comme lu si c'est nous qui envoyons
        })
        scrollToBottom()
      }
    }
  })
  
  socket.on('messageSent', (msg) => {
    console.log('✅ Message envoyé confirmé:', msg)
    isSending.value = false
    scrollToBottom()
  })
  
  socket.on('messageError', (error) => {
    console.error('❌ Erreur message:', error)
    isSending.value = false
    showToastMessage(error.error || 'Erreur lors de l\'envoi du message', 'error')
  })
  
  socket.on('userTyping', ({ sender: typingSender }) => {
    console.log('⌨️ Utilisateur tape:', typingSender)
    if (typingSender === props.receiver) {
      isTyping.value = true
      typingUser.value = typingSender
      scrollToBottom()
    }
  })
  
  socket.on('userStoppedTyping', ({ sender: typingSender }) => {
    console.log('⏹️ Utilisateur arrête de taper:', typingSender)
    if (typingSender === props.receiver) {
      isTyping.value = false
      typingUser.value = ''
    }
  })

  // Événements de défi
  socket.on('gameChallengeReceived', ({ from }) => {
    if (from === props.receiver) {
      showToastMessage(`${from} vous défie en partie!`, 'info')
    }
  })
}

const fetchMessages = async () => {
  try {
    console.log(`📋 Chargement messages ${sender} <-> ${props.receiver}`)
    const res = await axios.get(`http://localhost:3000/chat/message/${sender}/${props.receiver}`)
    messages.value = res.data.map((msg: any) => ({
      ...msg,
      read: msg.sender === sender || msg.read || false
    }))
    console.log(`✅ ${res.data.length} messages chargés`)
    await nextTick()
    scrollToBottom()
  } catch (err) {
    console.error('❌ Erreur lors du chargement des messages:', err)
    showToastMessage('Erreur lors du chargement des messages', 'error')
  }
}

const sendMessage = async () => {
  if (!message.value.trim() || !socket || isSending.value) return

  isSending.value = true
  const msgContent = message.value.trim()
  
  const msgData = {
    sender,
    receiver: props.receiver,
    content: msgContent,
  }
  
  console.log('📤 Envoi message:', msgData)
  
  // Ajouter le message localement avec un indicateur d'envoi
  messages.value.push({
    ...msgData,
    timestamp: new Date().toISOString(),
    read: false,
    sending: true
  })
  
  socket.emit('sendMessage', msgData)
  
  message.value = ''
  showEmojiPicker.value = false
  
  await nextTick()
  scrollToBottom()

  // Timeout de sécurité
  setTimeout(() => {
    if (isSending.value) {
      isSending.value = false
      showToastMessage('Timeout lors de l\'envoi du message', 'error')
    }
  }, 5000)
}

const handleTyping = () => {
  if (!socket) return
  
  socket.emit('typing', { sender, receiver: props.receiver })
  
  if (typingTimeout) {
    clearTimeout(typingTimeout)
  }
  
  typingTimeout = setTimeout(() => {
    socket!.emit('stopTyping', { sender, receiver: props.receiver })
  }, 2000)
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTo({
        top: messagesContainer.value.scrollHeight,
        behavior: 'smooth'
      })
    }
  })
}

// Gestion du clic en dehors pour fermer les menus
const handleClickOutside = (event: MouseEvent) => {
  if (showEmojiPicker.value) {
    const emojiPicker = document.querySelector('.emoji-picker')
    const emojiToggle = document.querySelector('.emoji-toggle')
    
    if (emojiPicker && emojiToggle && 
        !emojiPicker.contains(event.target as Node) && 
        !emojiToggle.contains(event.target as Node)) {
      showEmojiPicker.value = false
    }
  }
}

onMounted(() => {
  socket = useSocket()
  setupSocketListeners()
  fetchMessages()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  
  if (!props.socket && socket) {
    console.log('🔌 Déconnexion socket ChatBox')
    socket.disconnect()
  }
  
  if (typingTimeout) {
    clearTimeout(typingTimeout)
  }
})

watch(() => props.receiver, () => {
  console.log(`🔄 Changement destinataire: ${props.receiver}`)
  fetchMessages()
  isTyping.value = false
  typingUser.value = ''
  showEmojiPicker.value = false
  message.value = ''
})
</script>

<style scoped>
.chat-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 15px;
}

/* En-tête du chat */
.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 15px 15px 0 0;
  flex-shrink: 0;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.user-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: white;
  margin: 0;
}

.user-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  transition: background 0.3s ease;
}

.user-status.online .status-dot {
  background: #10b981;
  animation: pulse 2s infinite;
}

.status-text {
  color: rgba(255, 255, 255, 0.7);
}

.chat-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 0.5rem;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  transition: all 0.3s ease;
  min-width: 2.5rem;
  height: 2.5rem;
  justify-content: center;
}

.action-btn:hover:not(:disabled) {
  background: rgba(100, 181, 246, 0.3);
  border-color: #64b5f6;
  transform: translateY(-1px);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.challenge-btn {
  background: linear-gradient(135deg, #ff6b6b, #ee5a24);
  border-color: #ff6b6b;
}

.challenge-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #ff5252, #d63031);
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);
}

.action-text {
  font-weight: 500;
}

.action-icon {
  font-size: 1rem;
}

/* Zone des messages */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.02);
  scroll-behavior: smooth;
  min-height: 0;
}

.message-wrapper {
  margin-bottom: 1rem;
  animation: messageAppear 0.3s ease;
}

@keyframes messageAppear {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-right {
  text-align: right;
}

.message-left {
  text-align: left;
}

.message-bubble {
  display: inline-block;
  max-width: 80%;
  padding: 0.75rem 1rem;
  border-radius: 18px;
  word-wrap: break-word;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  position: relative;
  backdrop-filter: blur(10px);
}

.message-bubble.sent {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-bottom-right-radius: 6px;
}

.message-bubble.received {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom-left-radius: 6px;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  gap: 1rem;
}

.message-sender {
  font-size: 0.75rem;
  font-weight: 600;
  opacity: 0.8;
  color: currentColor;
}

.message-time {
  font-size: 0.7rem;
  opacity: 0.6;
  color: currentColor;
  white-space: nowrap;
}

.message-content {
  line-height: 1.4;
  word-break: break-word;
  font-size: 0.95rem;
}

.message-status {
  text-align: right;
  margin-top: 0.25rem;
}

.read-indicator {
  font-size: 0.7rem;
  opacity: 0.6;
  color: rgba(255, 255, 255, 0.8);
  transition: color 0.3s ease;
}

.read-indicator.read {
  color: #10b981;
  opacity: 1;
}

/* Indicateur de frappe */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 18px;
  margin-top: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  max-width: 60%;
}

.typing-avatar {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  color: white;
  flex-shrink: 0;
}

.typing-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.typing-dots {
  display: flex;
  gap: 0.25rem;
}

.typing-dots span {
  width: 6px;
  height: 6px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  animation: typingDots 1.5s infinite;
}

.typing-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

.typing-text {
  color: rgba(255, 255, 255, 0.7);
  font-style: italic;
  font-size: 0.8rem;
}

@keyframes typingDots {
  0%, 60%, 100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  30% {
    opacity: 1;
    transform: scale(1);
  }
}

/* Zone d'input */
.chat-input-container {
  flex-shrink: 0;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
}

.emoji-picker {
  position: absolute;
  bottom: 100%;
  left: 1rem;
  right: 1rem;
  background: linear-gradient(135deg, #2a2a3e, #1e1e2e);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.3);
  z-index: 100;
  backdrop-filter: blur(10px);
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 0.5rem;
  max-height: 200px;
  overflow-y: auto;
}

.emoji-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 0.5rem;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.2s ease;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.emoji-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}

.input-wrapper {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
}

.emoji-toggle {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.emoji-toggle:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.05);
}

.message-input {
  flex: 1;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: white;
  font-size: 0.95rem;
  resize: none;
  transition: all 0.3s ease;
  min-height: 2.5rem;
  max-height: 6rem;
}

.message-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.message-input:focus {
  outline: none;
  border-color: #64b5f6;
  box-shadow: 0 0 0 3px rgba(100, 181, 246, 0.2);
  background: rgba(255, 255, 255, 0.15);
}

.input-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.char-counter {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.5);
  transition: color 0.3s ease;
}

.char-counter.warning {
  color: #f59e0b;
}

.send-button {
  background: linear-gradient(135deg, #64b5f6, #42a5f5);
  border: none;
  color: white;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(100, 181, 246, 0.3);
}

.send-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #42a5f5, #1e88e5);
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(100, 181, 246, 0.5);
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.send-icon {
  font-size: 1.1rem;
  transform: rotate(-90deg);
}

.sending-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Toast notifications */
.toast-notification {
  position: absolute;
  top: -4rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  z-index: 200;
  backdrop-filter: blur(10px);
}

.toast-notification.success {
  background: rgba(16, 185, 129, 0.9);
}

.toast-notification.error {
  background: rgba(239, 68, 68, 0.9);
}

.toast-notification.info {
  background: rgba(100, 181, 246, 0.9);
}

/* Animations et transitions */
.typing-enter-active, .typing-leave-active {
  transition: all 0.3s ease;
}

.typing-enter-from, .typing-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.95);
}

.send-enter-active, .send-leave-active {
  transition: all 0.2s ease;
}

.send-enter-from, .send-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

.toast-enter-active, .toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from, .toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px);
}

/* Scrollbar personnalisée */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.emoji-grid::-webkit-scrollbar {
  width: 4px;
}

.emoji-grid::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

.emoji-grid::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

/* Responsive */
@media (max-width: 768px) {
  .chat-header {
    padding: 0.75rem;
  }
  
  .action-text {
    display: none;
  }
  
  .action-btn {
    min-width: 2rem;
    height: 2rem;
    padding: 0.25rem;
  }
  
  .user-avatar {
    width: 2rem;
    height: 2rem;
    font-size: 1rem;
  }
  
  .message-bubble {
    max-width: 85%;
    padding: 0.65rem 0.85rem;
  }
  
  .chat-input-container {
    padding: 0.75rem;
  }
  
  .emoji-grid {
    grid-template-columns: repeat(6, 1fr);
  }
  
  .input-wrapper {
    gap: 0.5rem;
  }
  
  .message-input {
    font-size: 16px; /* Éviter le zoom sur iOS */
  }
}

@media (max-width: 480px) {
  .chat-header {
    flex-direction: column;
    gap: 0.75rem;
    text-align: center;
  }
  
  .chat-actions {
    justify-content: center;
  }
  
  .message-bubble {
    max-width: 90%;
  }
  
  .emoji-toggle {
    width: 2rem;
    height: 2rem;
    font-size: 1rem;
  }
  
  .send-button {
    width: 2rem;
    height: 2rem;
  }
}

/* Animation du pulse pour le statut en ligne */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
