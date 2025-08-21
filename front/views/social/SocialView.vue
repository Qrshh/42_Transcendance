<template>
  <div class="social-container">
    <!-- Header avec tabs -->
    <div class="social-header">
      <h2 class="social-title">🌐 Social</h2>

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

    <!-- Fenêtre de chat -->
    <div v-if="activeChatUser" class="chat-overlay" @click="closeIfClickOutside">
      <div class="chat-window" @click.stop>
        <div class="chat-header">
          <div class="chat-user-info">
            <div
              class="status-indicator"
              :class="{ online: isUserOnline(activeChatUser), offline: !isUserOnline(activeChatUser) }"
            ></div>
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

    <!-- Profil -->
    <ProfileView
      v-if="selectedProfile && !activeChatUser"
      :username="selectedProfile"
      @close="closeProfile"
      @sendMessage="handleSendMessage"
    />

    <!-- Interface sociale -->
    <div v-else-if="!activeChatUser" class="social-interface">
      <!-- Amis -->
      <div v-if="activeTab === 'friends'" class="tab-content">
        <h3 class="section-title">🟢 Amis en ligne ({{ onlineFriends.length }})</h3>
        <AddFriend @friendAdded="onFriendsChanged" />
        <!--<FriendRequest @requestHandled="onFriendsChanged" />-->
        <FriendList
          @startChat="startChat"
          @viewProfile="viewProfile"
          @friendRemoved="onFriendsChanged"
        />
      </div>

      <!-- Messages -->
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

          <!-- Vide -->
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

      <!-- En ligne (amis uniquement) -->
      <div v-if="activeTab === 'online'" class="tab-content">
        <div class="online-section">
          <div class="section-header">
            <h3 class="section-title">🟢 Amis en ligne ({{ onlineFriends.length }})</h3>
          </div>

          <div class="online-users-grid">
            <div
              v-for="user in onlineFriends"
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
                <button @click.stop="startChat(user)" class="action-btn" title="Message">💬</button>
                <button @click.stop="viewProfile(user)" class="action-btn" title="Profil">👤</button>
                <button @click.stop="challengeUser(user)" class="action-btn" title="Défier">🎯</button>
              </div>
            </div>
          </div>

          <div v-if="onlineFriends.length === 0" class="no-users-online">
            <div class="no-content-icon">😴</div>
            <h3 class="no-content-title">Personne en ligne</h3>
            <p class="no-content-text">Tes amis reviendront bientôt !</p>
          </div>
        </div>
      </div>

      <!-- Notifications -->
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
                <button
                  v-if="notification.actionable"
                  @click.stop="handleNotificationAction(notification)"
                  class="btn btn-primary"
                >
                  {{ notification.actionText }}
                </button>

                <button
                  v-if="notification.actionable && notification.actionData?.type === 'friendRequest'"
                  @click.stop="declineFriendRequest(notification.actionData.fromUser).then(() => dismissNotification(notification.id))"
                  class="btn btn-secondary"
                >
                  Refuser
                </button>


                <button @click.stop="dismissNotification(notification.id)" class="btn-icon-only">✕</button>
              </div>
            </div>
          </div>

          <div v-if="notifications.length === 0" class="no-notifications">
            <div class="no-content-icon">🔔</div>
            <h3 class="no-content-title"> {{ t.notifications }} </h3>
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
            </div><!-- user-search -->
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { io, type Socket } from 'socket.io-client'
import AddFriend from '../social/AddFriend.vue'
import FriendRequest from '../social/FriendRequest.vue'
import FriendList from '../social/FriendList.vue'
import ProfileView from '../ProfileView.vue'
import ChatBox from '../../components/ChatBox.vue'
import { useI18n } from '../../composables/useI18n'

const { t } = useI18n()

/* ================== Config ================== */
const SOCKET_URL = 'http://localhost:3000'
const API_BASE   = 'http://localhost:3000'

/* ================== Types ================== */
interface Conversation {
  id: string
  participant: string
  lastMessage: { content: string; timestamp: string; senderId: string }
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
  actionData?: {
    type: 'friendRequest' | string
    fromUser?: string
    // ...autres champs si besoin
  }
}

/* ================== State ================== */
let socket: Socket | null = null

const me = (localStorage.getItem('username') || '').trim()

const connectedUsersSet = new Set<string>()
const connectedUsers = ref<string[]>([])

const friendsUsernames = ref<string[]>([])

const selectedProfile = ref<string | null>(null)
const activeChatUser = ref<string | null>(null)
const activeTab = ref<'friends'|'messages'|'online'|'notifications'>('friends')

const showNewConversationModal = ref(false)
const searchQuery = ref('')

const conversations = ref<Conversation[]>([])
const notifications = ref<Notification[]>([])

/* ================== Helpers ================== */

const pushFriendRequestNotification = (fromUser: string) => {
  notifications.value.unshift({
    id: `fr-${fromUser}-${Date.now()}`,
    title: 'Demande d’ami',
    message: `${fromUser} souhaite devenir votre ami`,
    icon: '👥',
    timestamp: new Date().toISOString(),
    read: false,
    actionable: true,
    actionText: 'Accepter',
    actionData: { type: 'friendRequest', fromUser }
  });
};

const preloadPendingFriendRequests = async () => {
  if (!me) return;
  try {
    const r = await fetch(`${API_BASE}/friends/requests/${encodeURIComponent(me)}`);
    if (!r.ok) return;
    const rows: Array<{ fromUser: string }> = await r.json();

    const existingFrom = new Set(
      notifications.value
        .filter(n => n.actionData?.type === 'friendRequest' && n.actionData.fromUser)
        .map(n => n.actionData!.fromUser as string)
    );

    rows.forEach(({ fromUser }) => {
      if (fromUser && !existingFrom.has(fromUser)) pushFriendRequestNotification(fromUser);
    });
  } catch (e) {
    console.warn('preloadPendingFriendRequests error:', e);
  }
};



const normalize = (s: string) => (s || '').trim()
const toKey = (s: string) => normalize(s).toLowerCase()

const setConnectedUsers = (users: string[]) => {
  connectedUsersSet.clear()
  users.forEach(u => {
    const v = normalize(u)
    if (v && v !== me) connectedUsersSet.add(v)
  })
  connectedUsers.value = Array.from(connectedUsersSet.values())
}
const addConnectedUser = (u: string) => {
  const v = normalize(u)
  if (v && v !== me) connectedUsersSet.add(v)
  connectedUsers.value = Array.from(connectedUsersSet.values())
}
const removeConnectedUser = (u: string) => {
  connectedUsersSet.delete(normalize(u))
  connectedUsers.value = Array.from(connectedUsersSet.values())
}

const isUserOnline = (username: string) => {
  const key = toKey(username)
  for (const u of connectedUsersSet) if (toKey(u) === key) return true
  return false
}

/* ================== Friends (DB) ================== */
const loadFriends = async () => {
  if (!me) return
  try {
    const res = await fetch(`${API_BASE}/friends/${encodeURIComponent(me)}`)
    if (!res.ok) throw new Error('friends fetch failed')
    const list: Array<{ friend: string }> = await res.json()
    friendsUsernames.value = list.map(x => normalize(x.friend)).filter(Boolean)
  } catch (e) {
    console.warn('loadFriends error:', e)
  }
}

const onFriendsChanged = () => {
  loadFriends()
  window.dispatchEvent(new CustomEvent('friends:updated'))
}

/* ================== Computed ================== */
const onlineFriends = computed(() =>
  connectedUsers.value.filter(u => friendsUsernames.value.includes(u))
)

const tabs = computed(() => [
  { id: 'friends', label: 'Amis', icon: '👥', count: 0 },
  { id: 'messages', label: 'Messages', icon: '💬', count: conversations.value.reduce((s, c) => s + c.unreadCount, 0) },
  { id: 'online', label: 'En ligne', icon: '🟢', count: onlineFriends.value.length },
  { id: 'notifications', label: 'Notifications', icon: '🔔', count: notifications.value.filter(n => !n.read).length }
])

const filteredFriends = computed(() => {
  const q = searchQuery.value.toLowerCase()
  if (!q) return friendsUsernames.value
  return friendsUsernames.value.filter(u => u.toLowerCase().includes(q))
})

/* ================== UI utils ================== */
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
const getStatusClass = (username: string) => (isUserOnline(username) ? 'online' : 'offline')
const getStatusText  = (username: string) => (isUserOnline(username) ? 'En ligne' : 'Hors ligne')
const formatTime = (ts: string) => {
  const date = new Date(ts); const now = new Date()
  const diff = now.getTime() - date.getTime()
  if (diff < 60_000) return `À l'instant`
  if (diff < 3_600_000) return `Il y a ${Math.floor(diff/60_000)}min`
  if (diff < 86_400_000) return `Il y a ${Math.floor(diff/3_600_000)}h`
  return date.toLocaleDateString('fr-FR')
}

/* ================== Actions ================== */
const startChat = (friendName: string) => {
  selectedProfile.value = null
  activeChatUser.value = friendName
  const c = conversations.value.find(x => x.participant === friendName)
  if (c) c.unreadCount = 0
}
const closeChat = () => { activeChatUser.value = null }
const closeIfClickOutside = (e: MouseEvent) => { if (e.target === e.currentTarget) closeChat() }
const handleKeydown = (e: KeyboardEvent) => { if (e.key === 'Escape' && activeChatUser.value) closeChat() }
const viewProfile = (username: string) => { activeChatUser.value = null; selectedProfile.value = username }
const closeProfile = () => { selectedProfile.value = null }
const handleSendMessage = (username: string) => startChat(username)

const createNewConversation = () => {
  showNewConversationModal.value = true
  searchQuery.value = ''
}
const openConversation = (conv: Conversation) => startChat(conv.participant)
const startConversationWithUser = (user: string) => {
  showNewConversationModal.value = false
  const existing = conversations.value.find(c => c.participant === user)
  if (!existing) {
    conversations.value.unshift({
      id: Date.now().toString(),
      participant: user,
      lastMessage: { content: 'Nouvelle conversation', timestamp: new Date().toISOString(), senderId: me || 'me' },
      unreadCount: 0
    })
  }
  startChat(user)
}

const challengeUser = (username: string) => {
  console.log(`🎯 Défi envoyé à ${username}`)
}

const markAllAsRead = () => { notifications.value.forEach(n => (n.read = true)) }

const acceptFriendRequest = async (fromUser: string) => {
  const body = { from: fromUser, to: me, accept: true };
  const res = await fetch(`${API_BASE}/friends/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.text().catch(()=>'');
    console.error('acceptFriendRequest failed:', err);
  }
};

const declineFriendRequest = async (fromUser: string) => {
  const body = { from: fromUser, to: me, accept: false };
  const res = await fetch(`${API_BASE}/friends/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.text().catch(()=>'');
    console.error('declineFriendRequest failed:', err);
  }
};

const handleNotificationAction = async (n: Notification) => {
  if (n.actionData?.type === 'friendRequest') {
    const fromUser = n.actionData.fromUser;
    if (!fromUser) { console.warn('friendRequest: fromUser manquant'); return; }
    await acceptFriendRequest(fromUser);
    dismissNotification(n.id);
  }
};

const dismissNotification = (id: string) => {
  const i = notifications.value.findIndex(n => n.id === id)
  if (i !== -1) notifications.value.splice(i, 1)
}

// 1) Déclare le handler UNE SEULE FOIS (tout en haut du <script setup>)
const handleNewNotification = (raw: any) => {
  const n = {
    id: raw.id || `ntf-${Date.now()}`,
    title: raw.title || 'Notification',
    message: raw.message || '',
    icon: raw.icon || '🔔',
    timestamp: raw.timestamp || new Date().toISOString(),
    read: false,
    actionable: !!raw.actionable,
    actionText: raw.actionText,
    actionData: raw.actionData
  };
  notifications.value.unshift(n);
};


/* ================== Socket lifecycle ================== */
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  
  console.log('🔌 Connexion socket SocialView')
  socket = io('http://10.12.2.6:3000')
  const username = localStorage.getItem('username')
  
  if (username) {
    socket.emit('identify', username)
  }
  const identify = () => { if (me) socket?.emit('identify', me) }
  socket.on('connect', () => {
    identify()
    socket?.emit('requestConnectedUsers')
  })

  socket.on('connectedUsersList', (users: string[]) => setConnectedUsers(users))
  socket.on('userConnected', (username: string) => addConnectedUser(username))
  socket.on('userDisconnected', (username: string) => removeConnectedUser(username))
  socket!.off('newNotification', handleNewNotification);
  socket.on('newNotification', (n: any) => {
    // normalise et pousse
    notifications.value.unshift({
      id: n.id || `ntf-${Date.now()}`,
      title: n.title || 'Notification',
      message: n.message || '',
      icon: n.icon || '🔔',
      timestamp: n.timestamp || new Date().toISOString(),
      read: false,
      actionable: !!n.actionable,
      actionText: n.actionText,
      actionData: n.actionData
    });
  });
  socket.on('friendsUpdated', () => loadFriends());
  // Messages entrants
  const onIncoming = (data: { sender: string; message: string; timestamp: string }) => {
    const conv = conversations.value.find(c => c.participant === data.sender)
    if (conv) {
      conv.lastMessage = { content: data.message, timestamp: data.timestamp, senderId: data.sender }
      if (activeChatUser.value !== data.sender) conv.unreadCount++
    } else {
      conversations.value.unshift({
        id: Date.now().toString(),
        participant: data.sender,
        lastMessage: { content: data.message, timestamp: data.timestamp, senderId: data.sender },
        unreadCount: activeChatUser.value !== data.sender ? 1 : 0
      })
    }
  }
  socket.on('messageReceived', onIncoming)
  socket.on('newMessage', onIncoming)

  // Rafraîchir amis quand le serveur le demande
  socket.on('friendsUpdated', (payload: { users?: string[] } = {}) => {
    if (payload?.users?.includes?.(me)) loadFriends()
  })

  // Initial load
  loadFriends()
  preloadPendingFriendRequests();
  // Écoute locale
  window.addEventListener('friends:updated', loadFriends)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('friends:updated', loadFriends)
   if (socket) {
    socket.off('newNotification', handleNewNotification);
    socket.disconnect();
  }
})
</script>

<style scoped>

/* Conteneur global */
.social-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(135deg, #667eea0f 0%, #764ba200 100%);
  color: white;
  padding: 1rem;
  position: relative;
}

/* Header & Tabs */
.social-header { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem; }
.social-title { text-align: center; margin: 0; color: #64b5f6; }
.social-tabs { display: flex; background: rgba(255, 255, 255, 0.1); border-radius: 15px; padding: 0.5rem; gap: 0.5rem; }
.tab-btn { display: flex; align-items: center; gap: 0.5rem; background: none; border: none; padding: 0.75rem 1rem; border-radius: 10px; cursor: pointer; color: rgba(255, 255, 255, 0.7); transition: all 0.3s ease; font-weight: 500; flex: 1; justify-content: center; position: relative; }
.tab-btn:hover { color: white; background: rgba(255, 255, 255, 0.1); }
.tab-btn.active { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
.tab-count { background: rgba(255, 255, 255, 0.3); color: white; font-size: 0.75rem; font-weight: 600; padding: 0.25rem 0.5rem; border-radius: 12px; min-width: 1.5rem; text-align: center; }

/* Transitions / sections */
.tab-content { animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.section-header, .messages-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.section-title { font-size: 1.3rem; font-weight: 700; color: white; margin: 0; }

/* Conversations */
.conversations-grid { display: grid; gap: 1rem; }
.conversation-card { background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 15px; padding: 1rem; cursor: pointer; transition: all 0.3s ease; display: flex; align-items: center; gap: 1rem; }
.conversation-card:hover { background: rgba(255, 255, 255, 0.15); transform: translateY(-2px); }
.conversation-avatar { width: 3rem; height: 3rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: white; flex-shrink: 0; }
.conversation-info { flex: 1; min-width: 0; }
.conversation-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem; }
.participant-name { font-weight: 600; color: white; margin: 0; font-size: 1rem; }
.message-time { font-size: 0.75rem; color: rgba(255, 255, 255, 0.6); }
.last-message { color: rgba(255, 255, 255, 0.8); margin: 0 0 0.5rem 0; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.last-message.unread { font-weight: 600; color: white; }
.conversation-footer { display: flex; justify-content: space-between; align-items: center; }
.participant-status { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; }
.status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.participant-status.online { color: #10b981; }
.participant-status.offline { color: #ef4444; }
.unread-badge { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-size: 0.7rem; font-weight: 600; padding: 0.25rem 0.5rem; border-radius: 12px; min-width: 1.5rem; text-align: center; }

/* Amis en ligne */
.online-users-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
.online-user-card { background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 15px; padding: 1rem; display: flex; align-items: center; gap: 1rem; transition: all 0.3s ease; }
.online-user-card:hover { background: rgba(255, 255, 255, 0.15); transform: translateY(-2px); }
.user-avatar { width: 2.5rem; height: 2.5rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; color: white; flex-shrink: 0; }
.user-info { flex: 1; }
.user-name { font-weight: 600; color: white; margin: 0 0 0.25rem 0; }
.user-status { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; margin: 0; }
.user-status.online { color: #10b981; }

/* Notifications */
.notifications-list { display: flex; flex-direction: column; gap: 1rem; }
.notification-item { background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 15px; padding: 1rem; display: flex; align-items: center; gap: 1rem; transition: all 0.3s ease; }
.notification-item.unread { border-color: #64b5f6; background: rgba(100, 181, 246, 0.1); }
.notification-icon { font-size: 2rem; flex-shrink: 0; }
.notification-content { flex: 1; }
.notification-title { font-weight: 600; color: white; margin: 0 0 0.25rem 0; }
.notification-message { color: rgba(255, 255, 255, 0.8); margin: 0 0 0.5rem 0; font-size: 0.9rem; }
.notification-time { font-size: 0.75rem; color: rgba(255, 255, 255, 0.6); }
.notification-actions { display: flex; gap: 0.5rem; }

/* États vides */
.no-conversations, .no-users-online, .no-notifications {
  display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 3rem;
}
.no-content-icon { font-size: 4rem; margin-bottom: 1rem; opacity: 0.5; }
.no-content-title { font-size: 1.5rem; font-weight: 700; color: white; margin-bottom: 0.5rem; }
.no-content-text { color: rgba(255, 255, 255, 0.7); margin-bottom: 2rem; }

/* Boutons */
.btn { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; }
.btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
.btn-secondary { background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); color: white; }
.btn:hover { transform: translateY(-2px); }
.btn-icon-only { background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; padding: 0.5rem; cursor: pointer; color: white; transition: all 0.3s ease; }
.btn-icon-only:hover { background: rgba(255, 255, 255, 0.2); }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.8); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 2rem; }
.modal-content { background: linear-gradient(135deg, #1e1e2e, #2a2a3e); border: 1px solid rgba(255,255,255,.1); border-radius: 20px; padding: 2rem; max-width: 500px; width: 100%; max-height: 80vh; overflow-y: auto; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.modal-title { font-size: 1.3rem; font-weight: 700; color: white; margin: 0; }
.modal-close { background: rgba(255, 255, 255, 0.1); border: none; border-radius: 50%; width: 2rem; height: 2rem; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; color: white; cursor: pointer; transition: all 0.3s ease; }
.modal-close:hover { background: rgba(255, 255, 255, 0.2); }
.search-input { width: 100%; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 12px; padding: 0.75rem 1rem; color: white; font-size: 1rem; margin-bottom: 1rem; }
.search-input:focus { outline: none; border-color: #64b5f6; }
.search-input::placeholder { color: rgba(255, 255, 255, 0.5); }
.search-results { max-height: 300px; overflow-y: auto; }
.user-result { display: flex; align-items: center; gap: 1rem; padding: 1rem; border-radius: 12px; cursor: pointer; transition: all 0.3s ease; }
.user-result:hover { background: rgba(255, 255, 255, 0.1); }

/* Responsive */
@media (max-width: 768px) {
  .social-container { padding: 0.5rem; }
  .social-tabs { flex-wrap: wrap; }
  .tab-btn { font-size: 0.8rem; padding: 0.5rem; }
  .tab-text { display: none; }
  .online-users-grid { grid-template-columns: 1fr; }
  .conversation-card, .online-user-card { padding: 0.75rem; }
  .user-actions { display: none; }
}
</style>
