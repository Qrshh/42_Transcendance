<template>
  <div class="user-profile-page">
    <div class="profile-container">
      <ProfileView 
        :username="currentUsername"
        :connectedUsers="connectedUsers"
        @close="goHome"
        @sendMessage="handleSendMessage"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { io, type Socket } from 'socket.io-client'
import ProfileView from './ProfileView.vue'

const router = useRouter()
const currentUsername = localStorage.getItem('username') || ''
const connectedUsers = ref<string[]>([])

let socket: Socket | null = null

const goHome = () => {
  router.push('/')
}

const handleSendMessage = (username: string) => {
  // Rediriger vers la page social avec le chat ouvert
  router.push('/social')
  // Tu pourrais aussi passer un paramètre pour ouvrir directement le chat
}

onMounted(() => {
  // Si pas connecté, rediriger vers login
  if (!currentUsername) {
    router.push('/about')
    return
  }

  // Connexion socket pour le statut en ligne
  socket = io('http://10.12.2.6:3000')
  socket.emit('identify', currentUsername)

  socket.on('userConnected', (username: string) => {
    if (!connectedUsers.value.includes(username)) {
      connectedUsers.value.push(username)
    }
  })
  
  socket.on('userDisconnected', (username: string) => {
    connectedUsers.value = connectedUsers.value.filter(user => user !== username)
  })
  
  socket.emit('requestConnectedUsers')
  socket.on('connectedUsersList', (users: string[]) => {
    connectedUsers.value = users
  })
})

onBeforeUnmount(() => {
  if (socket) {
    socket.disconnect()
  }
})
</script>

<style scoped>
.user-profile-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea0f 0%, #764ba200 100%);
  padding: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile-container {

  max-width: 1000px;

  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);

}
</style>
