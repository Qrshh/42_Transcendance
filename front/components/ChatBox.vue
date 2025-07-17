<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import axios from 'axios'

const props = defineProps<{ receiver: string }>()
const sender = localStorage.getItem('username') || ''

const message = ref('')
const messages = ref<any[]>([])

const fetchMessages = async () => {
  const res = await axios.get(`http://localhost:3000/chat/message/${sender}/${props.receiver}`)
  messages.value = res.data
}

const sendMessage = async () => {
  if (!message.value.trim()) return

  try {
    await axios.post('http://localhost:3000/chat/message', {
      sender,
      receiver: props.receiver,
      content: message.value,
    })
    message.value = ''
    await fetchMessages()
  } catch (err: any) {
    if (err.response?.status === 403) {
      alert(`Impossible d'envoyer un message : vous avez été bloqué par ${props.receiver}.`)
    } else {
      console.error('Erreur lors de l\'envoi du message :', err)
    }
  }
}


onMounted(fetchMessages)

// Recharge les messages si on change de destinataire
watch(() => props.receiver, fetchMessages)
</script>

<template>
  <div class="space-y-4">
    <h3 class="text-xl font-bold">Chat avec {{ props.receiver }}</h3>

    <div class="border h-64 overflow-y-auto p-2 rounded bg-gray-100">
      <div
        v-for="(msg, index) in messages"
        :key="index"
        :class="msg.sender === sender ? 'text-right text-blue-600' : 'text-left text-black'"
        class="mb-1"
      >
        <span class="text-sm font-semibold">{{ msg.sender }}:</span>
        <span>{{ msg.content }}</span>
      </div>
    </div>

    <div class="flex space-x-2">
      <input
        v-model="message"
        type="text"
        placeholder="Votre message"
        class="flex-1 border rounded px-2 py-1"
      />
      <button
        @click="sendMessage"
        class="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
      >
        Envoyer
      </button>
    </div>
  </div>
</template>
