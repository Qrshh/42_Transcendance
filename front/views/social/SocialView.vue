<template>
  <div class="social-container">
    <!-- Header avec tabs de navigation -->
    <div class="social-header">
      <h2 class="social-title">🌐 Social</h2>
      
      <!-- Tabs de navigation -->
      <div class="social-tabs">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          @click="activeTab = tab.id"
          class="tab-btn"
          :class="{ active: activeTab === tab.id }"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          <span class="tab-text">{{ tab.label }}</span>
          <span v-if="tab.count > 0" class="tab-count">{{ tab.count }}</span>
        </button>
      </div>
    </div>
    
    <!-- Fenêtre de chat (reste inchangée) -->
    <div v-if="activeChatUser" class="chat-overlay" @click="closeIfClickOutside">
      <div class="chat-window" @click.stop>
        <div class="chat-header">
          <div class="chat-user-info">
            <div class="status-indicator" :class="{ online: isUserOnline(activeChatUser), offline: !isUserOnline(activeChatUser) }"></div>
            <h3>💬 {{ activeChatUser }}</h3>
            <span class="online-status">{{ isUserOnline(activeChatUser) ? 'En ligne' : 'Hors ligne' }}</span>
          </div>
          <button @click="closeChat" class="close-btn">✕</button>
        </div>

        <div class="chat-content">
          <ChatBox :receiver="activeChatUser" :socket="socket" />
        </div>
      </div>
    </div>
    
    <!-- Afficher le profil (reste inchangé) -->
    <ProfileView 
      v-if="selectedProfile" 
      :username="selectedProfile"
      @close="closeProfile"
      @sendMessage="handleSendMessage"
    />
    
    <!-- Interface sociale avec tabs -->
    <div v-else-if="!activeChatUser" class="social-interface">
      <!-- Onglet Amis -->
      <div v-if="activeTab === 'friends'" class="tab-content">
        <AddFriend @friendAdded="refreshFriends" />
        <FriendRequest @requestHandled="refreshFriends" />
        <FriendList 
          :connectedUsers="connectedUsers" 
          @startChat="startChat" 
          @viewProfile="viewProfile"
        />
      </div>

      <!-- Onglet Messages -->
      <div v-if="activeTab === 'messages'" class="tab-content">
        <div class="messages-section">
          <div class="messages-header">
            <h3 class="section-title">💬 Conversations récentes</h3>
            <button @click="createNewConversation" class="btn btn-primary">
              <span class="btn-icon">➕</span>
              <span class="btn-text">Nouvelle conversation</span>
            </button>
          </div>

          <div class="conversations-grid">
            <div 
              v-for="conversation in conversations" 
              :key="conversation.id"
              @click="openConversation(conversation)"
              class="conversation-card"
            >
              <div class="conversation-avatar" :style="{ background: getUserColor(conversation.participant) }">
                {{ getDefaultAvatar(conversation.participant) }}
              </div>
              
              <div class="conversation-info">
                <div class="conversation-header">
                  <h4 class="participant-name">{{ conversation.participant }}</h4>
                  <span class="message-time">{{ formatTime(conversation.lastMessage.timestamp) }}</span>
                </div>
                
                <p class="last-message" :class="{ unread: conversation.unreadCount > 0 }">
                  {{ conversation.lastMessage.content }}
                </p>
                
                <div class="conversation-footer">
                  <div class="participant-status" :class="getStatusClass(conversation.participant)">
                    <span class="status-dot"></span>
                    <span class="status-text">{{ getStatusText(conversation.participant) }}</span>
                  </div>
                  
                  <span v-if="conversation.unreadCount > 0" class="unread-badge">
                    {{ conversation.unreadCount }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Message si pas de conversations -->
          <div v-if="conversations.length === 0" class="no-conversations">
            <div class="no-content-icon">💬</div>
            <h3 class="no-content-title">Aucune conversation</h3>
            <p class="no-content-text">Commence une nouvelle discussion avec tes amis !</p>
            <button @click="activeTab = 'friends'" class="btn btn-secondary">
              <span class="btn-icon">👥</span>
              <span class="btn-text">Voir mes amis</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Onglet En ligne -->
      <div v-if="activeTab === 'online'" class="tab-content">
        <div class="online-section">
          <div class="section-header">
            <h3 class="section-title">🟢 Utilisateurs en ligne ({{ connectedUsers.length }})</h3>
          </div>

          <div class="online-users-grid">
            <div 
              v-for="user in connectedUsers" 
              :key="user"
              class="online-user-card"
            >
              <div class="user-avatar" :style="{ background: getUserColor(user) }">
                {{ getDefaultAvatar(user) }}
              </div>
              
              <div class="user-info">
                <h4 class="user-name">{{ user }}</h4>
                <p class="user-status online">
                  <span class="status-dot"></span>
                  En ligne
                </p>
              </div>
              
              <div class="user-actions">
                <button @click="startChat(user)" class="action-btn" title="Message">
                  💬
                </button>
                <button @click="viewProfile(user)" class="action-btn" title="Profil">
                  👤
                </button>
                <button @click="challengeUser(user)" class="action-btn" title="Défier">
                  🎯
                </button>
              </div>
            </div>
          </div>

          <!-- Message si personne en ligne -->
          <div v-if="connectedUsers.length === 0" class="no-users-online">
            <div class="no-content-icon">😴</div>
            <h3 class="no-content-title">Personne en ligne</h3>
            <p class="no-content-text">Tes amis reviendront bientôt !</p>
          </div>
        </div>
      </div>

      <!-- Onglet Notifications -->
      <div v-if="activeTab === 'notifications'" class="tab-content">
        <div class="notifications-section">
          <div class="section-header">
            <h3 class="section-title">🔔 Notifications</h3>
            <button v-if="notifications.length > 0" @click="markAllAsRead" class="btn btn-secondary">
              <span class="btn-icon">✓</span>
              <span class="btn-text">Tout marquer comme lu</span>
            </button>
          </div>

          <div class="notifications-list">
            <div 
              v-for="notification in notifications" 
              :key="notification.id"
              class="notification-item"
              :class="{ unread: !notification.read }"
            >
              <div class="notification-icon">{{ notification.icon }}</div>
              
              <div class="notification-content">
                <h4 class="notification-title">{{ notification.title }}</h4>
                <p class="notification-message">{{ notification.message }}</p>
                <span class="notification-time">{{ formatTime(notification.timestamp) }}</span>
              </div>
              
              <div class="notification-actions">
                <button v-if="notification.actionable" @click="handleNotificationAction(notification)" class="btn btn-primary">
                  {{ notification.actionText }}
                </button>
                <button @click="dismissNotification(notification.id)" class="btn-icon-only">
                  ✕
                </button>
              </div>
            </div>
          </div>

          <!-- Message si pas de notifications -->
          <div v-if="notifications.length === 0" class="no-notifications">
            <div class="no-content-icon">🔔</div>
            <h3 class="no-content-title">Aucune notification</h3>
            <p class="no-content-text">Tu es à jour ! 🎉</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal nouvelle conversation -->
    <Transition name="modal">
      <div v-if="showNewConversationModal" class="modal-overlay" @click.self="showNewConversationModal = false">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">Nouvelle conversation</h3>
            <button @click="showNewConversationModal = false" class="modal-close">✕</button>
          </div>
          
          <div class="modal-body">
            <div class="user-search">
              <input 
                v-model="searchQuery"
                type="text"
                placeholder="Rechercher un utilisateur..."
                class="search-input"
              />
              
              <div class="search-results">
                <div 
                  v-for="user in filteredFriends" 
                  :key="user"
                  @click="startConversationWithUser(user)"
                  class="user-result"
                >
                  <div class="user-avatar" :style="{ background: getUserColor(user) }">
                    {{ getDefaultAvatar(user) }}
                  </div>
                  
                  <div class="user-info">
                    <h4 class="user-name">{{ user }}</h4>
                    <p class="user-status" :class="getStatusClass(user)">
                      <span class="status-dot"></span>
                      {{ getStatusText(user) }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { io, type Socket } from 'socket.io-client'
import AddFriend from './AddFriend.vue'
import FriendRequest from './FriendRequest.vue'
import FriendList from './FriendList.vue'
import ProfileView from '../ProfileView.vue'
import ChatBox from '../../components/ChatBox.vue'

// Types
interface Conversation {
  id: string
  participant: string
  lastMessage: {
    content: string
    timestamp: string
    senderId: string
  }
  unreadCount: number
}

interface Notification {
  id: string
  title: string
  message: string
  icon: string
  timestamp: string
  read: boolean
  actionable?: boolean
  actionText?: string
  actionData?: any
}

let socket: Socket | null = null

// État existant
const connectedUsers = ref<string[]>([])
const selectedProfile = ref<string | null>(null)
const activeChatUser = ref<string | null>(null)

// Nouvel état pour les tabs
const activeTab = ref('friends')
const showNewConversationModal = ref(false)
const searchQuery = ref('')

// Données pour les conversations
const conversations = ref<Conversation[]>([
  {
    id: '1',
    participant: 'Alice',
    lastMessage: {
      content: 'Salut ! Tu veux faire une partie ?',
      timestamp: new Date(Date.now() - 300000).toISOString(), // 5 min ago
      senderId: 'Alice'
    },
    unreadCount: 1
  },
  {
    id: '2', 
    participant: 'Bob',
    lastMessage: {
      content: 'GG pour la dernière partie ! 🎮',
      timestamp: new Date(Date.now() - 3600000).toISOString(), // 1h ago
      senderId: 'Bob'
    },
    unreadCount: 0
  }
])

// Données pour les notifications
const notifications = ref<Notification[]>([
  {
    id: '1',
    title: 'Demande d\'ami',
    message: 'Charlie souhaite devenir votre ami',
    icon: '👥',
    timestamp: new Date(Date.now() - 600000).toISOString(), // 10 min ago
    read: false,
    actionable: true,
    actionText: 'Accepter',
    actionData: { type: 'friendRequest', userId: 'Charlie' }
  },
  {
    id: '2',
    title: 'Défi reçu',
    message: 'Diana vous défie en partie !',
    icon: '🎯',
    timestamp: new Date(Date.now() - 900000).toISOString(), // 15 min ago
    read: false,
    actionable: true,
    actionText: 'Accepter le défi',
    actionData: { type: 'gameChallenge', userId: 'Diana' }
  }
])

// Computed
const tabs = computed(() => [
  { 
    id: 'friends', 
    label: 'Amis', 
    icon: '👥', 
    count: 0 
  },
  { 
    id: 'messages', 
    label: 'Messages', 
    icon: '💬', 
    count: conversations.value.reduce((sum, conv) => sum + conv.unreadCount, 0)
  },
  { 
    id: 'online', 
    label: 'En ligne', 
    icon: '🟢', 
    count: connectedUsers.value.length 
  },
  { 
    id: 'notifications', 
    label: 'Notifications', 
    icon: '🔔', 
    count: notifications.value.filter(n => !n.read).length 
  }
])

const filteredFriends = computed(() => {
  if (!searchQuery.value) return connectedUsers.value
  
  return connectedUsers.value.filter(user => 
    user.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

// Fonctions existantes (inchangées)
const isUserOnline = (username: string) => {
  return connectedUsers.value.includes(username)
}

const startChat = (friendName: string) => {
  selectedProfile.value = null
  activeChatUser.value = friendName
  
  // Marquer la conversation comme lue
  const conversation = conversations.value.find(c => c.participant === friendName)
  if (conversation) {
    conversation.unreadCount = 0
  }
}

const closeChat = () => {
  activeChatUser.value = null
}

const closeIfClickOutside = (event: MouseEvent) => {
  if (event.target === event.currentTarget) {
    closeChat()
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && activeChatUser.value) {
    closeChat()
  }
}

const refreshFriends = () => {
  console.log('Rafraîchissement des amis demandé')
}

const viewProfile = (username: string) => {
  activeChatUser.value = null
  selectedProfile.value = username
}

const closeProfile = () => {
  selectedProfile.value = null
}

const handleSendMessage = (username: string) => {
  startChat(username)
}

// Nouvelles fonctions
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

const getStatusClass = (username: string) => {
  if (isUserOnline(username)) return 'online'
  return 'offline'
}

const getStatusText = (username: string) => {
  if (isUserOnline(username)) return 'En ligne'
  return 'Hors ligne'
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 60000) return 'À l\'instant'
  if (diff < 3600000) return `Il y a ${Math.floor(diff / 60000)}min`
  if (diff < 86400000) return `Il y a ${Math.floor(diff / 3600000)}h`
  return date.toLocaleDateString('fr-FR')
}

const openConversation = (conversation: Conversation) => {
  startChat(conversation.participant)
}

const createNewConversation = () => {
  showNewConversationModal.value = true
  searchQuery.value = ''
}

const startConversationWithUser = (user: string) => {
  showNewConversationModal.value = false
  
  // Vérifier si conversation existe déjà
  const existingConv = conversations.value.find(c => c.participant === user)
  if (!existingConv) {
    // Créer nouvelle conversation
    conversations.value.unshift({
      id: Date.now().toString(),
      participant: user,
      lastMessage: {
        content: 'Nouvelle conversation',
        timestamp: new Date().toISOString(),
        senderId: localStorage.getItem('username') || 'me'
      },
      unreadCount: 0
    })
  }
  
  startChat(user)
}

const challengeUser = (username: string) => {
  console.log(`Défier ${username} en partie`)
  // Ici on implémenterait la logique de défi
}

const markAllAsRead = () => {
  notifications.value.forEach(notification => {
    notification.read = true
  })
}

const handleNotificationAction = (notification: Notification) => {
  console.log('Action notification:', notification.actionData)
  
  if (notification.actionData?.type === 'friendRequest') {
    // Accepter demande d'ami
    console.log(`Accepter demande d'ami de ${notification.actionData.userId}`)
  } else if (notification.actionData?.type === 'gameChallenge') {
    // Accepter défi
    console.log(`Accepter défi de ${notification.actionData.userId}`)
  }
  
  dismissNotification(notification.id)
}

const dismissNotification = (notificationId: string) => {
  const index = notifications.value.findIndex(n => n.id === notificationId)
  if (index !== -1) {
    notifications.value.splice(index, 1)
  }
}

// Lifecycle (inchangé)
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  
  console.log('🔌 Connexion socket SocialView')
  socket = io('http://localhost:3000')
  const username = localStorage.getItem('username')
  
  if (username) {
    socket.emit('identify', username)
  }

  socket.on('userConnected', (username: string) => {
    console.log('👥 Utilisateur connecté:', username)
    if (!connectedUsers.value.includes(username)) {
      connectedUsers.value.push(username)
    }
  })
  
  socket.on('userDisconnected', (username: string) => {
    console.log('👥 Utilisateur déconnecté:', username)
    connectedUsers.value = connectedUsers.value.filter(user => user !== username)
  })
  
  socket.emit('requestConnectedUsers')
  socket.on('connectedUsersList', (users: string[]) => {
    console.log('👥 Liste des utilisateurs connectés:', users)
    connectedUsers.value = users
  })

  // Écouter les nouveaux messages pour mettre à jour les conversations
  socket.on('messageReceived', (data: { sender: string, message: string, timestamp: string }) => {
    const conversation = conversations.value.find(c => c.participant === data.sender)
    if (conversation) {
      conversation.lastMessage = {
        content: data.message,
        timestamp: data.timestamp,
        senderId: data.sender
      }
      if (activeChatUser.value !== data.sender) {
        conversation.unreadCount++
      }
    } else {
      // Créer nouvelle conversation
      conversations.value.unshift({
        id: Date.now().toString(),
        participant: data.sender,
        lastMessage: {
          content: data.message,
          timestamp: data.timestamp,
          senderId: data.sender
        },
        unreadCount: activeChatUser.value !== data.sender ? 1 : 0
      })
    }
  })
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  
  if (socket) {
    console.log('🔌 Déconnexion socket SocialView')
    socket.disconnect()
  }
})
</script>

<style scoped>
/* Styles existants (inchangés) */
.social-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(135deg, #667eea0f 0%, #764ba200 100%);
  color: white;
  padding: 1rem;
  position: relative;
}

/* Styles existants pour chat-overlay, chat-window etc. restent inchangés... */

/* Nouveaux styles pour les tabs */
.social-header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.social-title {
  text-align: center;
  margin: 0;
  color: #64b5f6;
}

.social-tabs {
  display: flex;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  padding: 0.5rem;
  gap: 0.5rem;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.7);
  transition: all 0.3s ease;
  font-weight: 500;
  flex: 1;
  justify-content: center;
  position: relative;
}

.tab-btn:hover {
  color: white;
  background: rgba(255, 255, 255, 0.1);
}

.tab-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.tab-count {
  background: rgba(255, 255, 255, 0.3);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  min-width: 1.5rem;
  text-align: center;
}

.tab-content {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Section styles */
.section-header,
.messages-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: white;
  margin: 0;
}

/* Conversations */
.conversations-grid {
  display: grid;
  gap: 1rem;
}

.conversation-card {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.conversation-card:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
}

.conversation-avatar {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: white;
  flex-shrink: 0;
}

.conversation-info {
  flex: 1;
  min-width: 0;
}

.conversation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.participant-name {
  font-weight: 600;
  color: white;
  margin: 0;
  font-size: 1rem;
}

.message-time {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
}

.last-message {
  color: rgba(255, 255, 255, 0.8);
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.last-message.unread {
  font-weight: 600;
  color: white;
}

.conversation-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.participant-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.participant-status.online { color: #10b981; }
.participant-status.offline { color: #ef4444; }

.unread-badge {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  min-width: 1.5rem;
  text-align: center;
}

/* Utilisateurs en ligne */
.online-users-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.online-user-card {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: all 0.3s ease;
}

.online-user-card:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
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
  flex-shrink: 0;
}

.user-info {
  flex: 1;
}

.user-name {
  font-weight: 600;
  color: white;
  margin: 0 0 0.25rem 0;
}

.user-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  margin: 0;
}

.user-status.online { color: #10b981; }

.user-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 0.5rem;
  cursor: pointer;
  color: white;
  transition: all 0.3s ease;
  font-size: 1rem;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}

/* Notifications */
.notifications-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.notification-item {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: all 0.3s ease;
}

.notification-item.unread {
  border-color: #64b5f6;
  background: rgba(100, 181, 246, 0.1);
}

.notification-icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.notification-content {
  flex: 1;
}

.notification-title {
  font-weight: 600;
  color: white;
  margin: 0 0 0.25rem 0;
}

.notification-message {
  color: rgba(255, 255, 255, 0.8);
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
}

.notification-time {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
}

.notification-actions {
  display: flex;
  gap: 0.5rem;
}

/* Messages vides */
.no-conversations,
.no-users-online,
.no-notifications {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 3rem;
}

.no-content-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.no-content-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
  margin-bottom: 0.5rem;
}

.no-content-text {
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 2rem;
}

/* Boutons */
.btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
}

.btn:hover {
  transform: translateY(-2px);
}

.btn-icon-only {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 0.5rem;
  cursor: pointer;
  color: white;
  transition: all 0.3s ease;
}

.btn-icon-only:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Modal (styles inchangés de ta version précédente) */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.modal-content {
  background: linear-gradient(135deg, #1e1e2e, #2a2a3e);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 2rem;
  max-width: 500px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.modal-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: white;
  margin: 0;
}

.modal-close {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
}

.modal-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.search-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  color: white;
  font-size: 1rem;
  margin-bottom: 1rem;
}

.search-input:focus {
  outline: none;
  border-color: #64b5f6;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.search-results {
  max-height: 300px;
  overflow-y: auto;
}

.user-result {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.user-result:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* Responsive */
@media (max-width: 768px) {
  .social-container {
    padding: 0.5rem;
  }
  
  .social-tabs {
    flex-wrap: wrap;
  }
  
  .tab-btn {
    font-size: 0.8rem;
    padding: 0.5rem;
  }
  
  .tab-text {
    display: none;
  }
  
  .online-users-grid {
    grid-template-columns: 1fr;
  }
  
  .conversation-card,
  .online-user-card {
    padding: 0.75rem;
  }
  
  .user-actions {
    display: none;
  }
}

/* Tous les autres styles existants restent inchangés... */
</style>
