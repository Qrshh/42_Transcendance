<template>
  <div class="friend-list">
    <h3>👥 Mes Amis ({{ friends.length }})</h3>
    
    <div v-if="friends.length === 0" class="no-friends">
      Aucun ami pour le moment
    </div>
    
    <div v-for="friend in friends" :key="friend.friend" class="friend-item">
      <!-- Voyant en ligne + nom - Cliquer pour ouvrir le chat -->
      <div class="friend-info" @click="$emit('startChat', friend.friend)">
        <div class="status-indicator" :class="{ online: isOnline(friend.friend), offline: !isOnline(friend.friend) }"></div>
        <span class="friend-name">{{ friend.friend }}</span>
        <span class="online-status">{{ isOnline(friend.friend) ? 'En ligne' : 'Hors ligne' }}</span>
      </div>
      
      <!-- Menu d'actions -->
      <div class="friend-actions">
        <button @click="toggleActionsMenu(friend.friend)" class="actions-btn">⋮</button>
        
        <!-- Panneau d'actions -->
        <div v-if="activeActionMenu === friend.friend" class="actions-menu">
          <button @click="$emit('startChat', friend.friend)" class="action-item">
            💬 Envoyer un msg
          </button>
          <button @click="$emit('viewProfile', friend.friend)" class="action-item">
            👤 Voir le profil
          </button>
          <button @click="blockUser(friend.friend)" class="action-item block">
            🚫 Bloquer
          </button>
          <button @click="removeFriend(friend.friend)" class="action-item remove">
            ❌ Retirer
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

defineEmits<{
  startChat: [friendName: string]
  viewProfile: [friendName: string]
}>()

const friends = ref<Array<{ friend: string }>>([])
const onlineUsers = ref<Set<string>>(new Set())
const activeActionMenu = ref<string | null>(null)

const props = defineProps<{
  connectedUsers: string[]
}>()

// Charger la liste des amis
const loadFriends = async () => {
  try {
    const username = localStorage.getItem('username')
    const response = await fetch(`http://10.12.2.6:3000/friends/${username}`)
    friends.value = await response.json()
  } catch (error) {
    console.error('Erreur lors du chargement des amis:', error)
  }
}

// Vérifier si un utilisateur est en ligne
const isOnline = (username: string) => {
  return onlineUsers.value.has(username)
}

// Basculer le menu d'actions
const toggleActionsMenu = (friendName: string) => {
  activeActionMenu.value = activeActionMenu.value === friendName ? null : friendName
}

// Bloquer un utilisateur
const blockUser = async (friendName: string) => {
  if (confirm(`Êtes-vous sûr de vouloir bloquer ${friendName} ?`)) {
    try {
      const username = localStorage.getItem('username')
      await fetch('http://10.12.2.6:3000/chat/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocker: username, blocked: friendName })
      })
      alert(`${friendName} a été bloqué`)
    } catch (error) {
      console.error('Erreur lors du blocage:', error)
      alert('Erreur lors du blocage')
    }
  }
  activeActionMenu.value = null
}

// Retirer des amis
const removeFriend = async (friendName: string) => {
  if (confirm(`Êtes-vous sûr de vouloir retirer ${friendName} de vos amis ?`)) {
    try {
      const username = localStorage.getItem('username')
      await fetch('http://10.12.2.6:3000/friends/remove', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: username, to: friendName })
      })
      alert(`${friendName} a été retiré de vos amis`)
      loadFriends()
    } catch (error) {
      console.error('Erreur lors de la suppression:', error)
      alert('Erreur lors de la suppression')
    }
  }
  activeActionMenu.value = null
}

// Fermer le menu si on clique ailleurs
const closeMenuOnClickOutside = (event: MouseEvent) => {
  if (!(event.target as Element)?.closest('.friend-actions')) {
    activeActionMenu.value = null
  }
}

onMounted(() => {
  loadFriends()
  document.addEventListener('click', closeMenuOnClickOutside)
})

// Mettre à jour les utilisateurs en ligne
watch(() => props.connectedUsers, (newUsers) => {
  onlineUsers.value = new Set(newUsers)
}, { immediate: true })
</script>

<style scoped>
.friend-list {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.friend-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  margin-bottom: 0.5rem;
  background: rgba(0, 0, 0, 0.2);
}

.friend-info {
  display: flex;
  align-items: center;
  flex: 1;
  cursor: pointer;
  gap: 0.75rem;
  transition: background 0.2s;
  padding: 0.5rem;
  border-radius: 6px;
}

.friend-info:hover {
  background: rgba(255, 255, 255, 0.05);
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-indicator.online {
  background-color: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
}

.status-indicator.offline {
  background-color: #ef4444;
}

.friend-name {
  font-weight: 500;
  color: white;
}

.online-status {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
}

.friend-actions {
  position: relative;
}

.actions-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1.2rem;
}

.actions-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.actions-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: #2a2a2a;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 0.5rem 0;
  min-width: 160px;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.action-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0.5rem 1rem;
  border: none;
  background: none;
  color: white;
  cursor: pointer;
  font-size: 0.9rem;
  gap: 0.5rem;
}

.action-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.action-item.block:hover {
  background: rgba(239, 68, 68, 0.2);
}

.action-item.remove:hover {
  background: rgba(239, 68, 68, 0.2);
}

.no-friends {
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
  font-style: italic;
  padding: 2rem;
}
</style>
