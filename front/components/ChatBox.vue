<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue'
import axios from 'axios'
import { io, Socket } from 'socket.io-client'

const props = defineProps<{ receiver: string }>()
const sender = localStorage.getItem('username') || ''

const message = ref('')
const messages = ref<any[]>([])
const isTyping = ref(false)
const typingUser = ref('')
let socket: Socket | null = null
let typingTimeout: number | null = null

// Connexion WebSocket
const connectSocket = () => {
  socket = io('http://localhost:3000')
  
  // S'identifier auprès du serveur
  socket.emit('identify', sender)
  
  // Écouter les nouveaux messages
  socket.on('newMessage', (msg) => {
    // Ajouter seulement si c'est une conversation avec le bon utilisateur
    if ((msg.sender === props.receiver && msg.receiver === sender) ||
        (msg.sender === sender && msg.receiver === props.receiver)) {
      messages.value.push(msg)
      scrollToBottom()
    }
  })
  
  // Confirmation d'envoi
  socket.on('messageSent', (msg) => {
    // Le message est déjà ajouté localement, on pourrait juste mettre à jour son statut
    scrollToBottom()
  })
  
  // Gestion des erreurs
  socket.on('messageError', (error) => {
    alert(error.error)
  })
  
  // Indicateur de frappe
  socket.on('userTyping', ({ sender: typingSender }) => {
    if (typingSender === props.receiver) {
      isTyping.value = true
      typingUser.value = typingSender
    }
  })
  
  socket.on('userStoppedTyping', ({ sender: typingSender }) => {
    if (typingSender === props.receiver) {
      isTyping.value = false
      typingUser.value = ''
    }
  })
}

// Charger l'historique des messages
const fetchMessages = async () => {
  try {
    const res = await axios.get(`http://localhost:3000/chat/message/${sender}/${props.receiver}`)
    messages.value = res.data
    scrollToBottom()
  } catch (err) {
    console.error('Erreur lors du chargement des messages:', err)
  }
}

// Envoyer un message via WebSocket
const sendMessage = async () => {
  if (!message.value.trim() || !socket) return

  const msgData = {
    sender,
    receiver: props.receiver,
    content: message.value,
  }
  
  // Ajouter immédiatement le message localement pour une UX fluide
  messages.value.push({
    ...msgData,
    timestamp: new Date().toISOString()
  })
  
  // Envoyer via WebSocket
  socket.emit('sendMessage', msgData)
  
  message.value = ''
  scrollToBottom()
}

// Gestion de la frappe
const handleTyping = () => {
  if (!socket) return
  
  socket.emit('typing', { sender, receiver: props.receiver })
  
  // Clear le timeout précédent
  if (typingTimeout) {
    clearTimeout(typingTimeout)
  }
  
  // Arrêter l'indicateur après 3 secondes d'inactivité
  typingTimeout = setTimeout(() => {
    socket!.emit('stopTyping', { sender, receiver: props.receiver })
  }, 3000)
}

// Scroll automatique vers le bas
const scrollToBottom = () => {
  setTimeout(() => {
    const chatContainer = document.querySelector('.chat-messages')
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight
    }
  }, 50)
}

onMounted(() => {
  connectSocket()
  fetchMessages()
})

onUnmounted(() => {
  if (socket) {
    socket.disconnect()
  }
  if (typingTimeout) {
    clearTimeout(typingTimeout)
  }
})

// Recharger les messages si on change de destinataire
watch(() => props.receiver, () => {
  fetchMessages()
  isTyping.value = false
  typingUser.value = ''
})
</script>

<template>
  <div class="space-y-4">
    <h3 class="text-xl font-bold">Chat avec {{ props.receiver }}</h3>

    <div class="border h-64 overflow-y-auto p-2 rounded bg-gray-100 chat-messages">
      <div
        v-for="(msg, index) in messages"
        :key="`${msg.timestamp}-${index}`"
        :class="msg.sender === sender ? 'text-right' : 'text-left'"
        class="mb-2"
      >
        <div :class="msg.sender === sender ? 'inline-block bg-blue-500 text-white rounded-lg px-3 py-1 max-w-xs' : 'inline-block bg-gray-300 text-black rounded-lg px-3 py-1 max-w-xs'">
          <span class="text-xs font-semibold block">{{ msg.sender }}</span>
          <span class="break-words">{{ msg.content }}</span>
          <span class="text-xs opacity-75 block">
            {{ new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }}
          </span>
        </div>
      </div>
      
      <!-- Indicateur de frappe -->
      <div v-if="isTyping" class="text-left text-gray-500 italic text-sm">
        {{ typingUser }} est en train d'écrire...
      </div>
    </div>

    <div class="flex space-x-2">
      <input
        v-model="message"
        @input="handleTyping"
        @keyup.enter="sendMessage"
        type="text"
        placeholder="Votre message..."
        class="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        @click="sendMessage"
        class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
      >
        Envoyer
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-messages {
  scroll-behavior: smooth;
}
</style>
