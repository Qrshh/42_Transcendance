<template>
  <div class="social-page ">
    <!-- Header -->
    <div class="panel social-header">
      <div class="header-left">
        <h2 class="title">🌐 Social</h2>
        <p class="subtitle">{{ t.socialMsg }}</p>
      </div>

      <div class="header-actions">
        <button class="btn btn-secondary" @click="openAddFriend">
          <span class="btn-icon">➕</span>
          <span class="btn-text"> {{ t.addFriend }}</span>
        </button>
      </div>
    </div>

    <!-- Onglets (mêmes styles que ProfileView) -->
    <div class="profile-tabs panel">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="activeTab = tab.id as any"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        <span class="tab-text">{{ tab.label }}</span>
        <span v-if="tab.count" class="tab-count">{{ tab.count }}</span>
      </button>
    </div>

    <!-- Contenu (mêmes styles que ProfileView) -->
    <div class="panel">
      <!-- AMIS -->
      <div v-if="activeTab === 'friends'" class="tab-content">
        <div class="friends-header ">
          <h3 class="section-title">👥 {{t.myFriends}} ({{ friendsUsernames.length }})</h3>

        </div>

        <FriendList
          :connectedUsers="connectedUsers"
          @startChat="startChat"
          @viewProfile="goProfile"
        />
      </div>

      <!-- MESSAGES -->
      <div v-if="activeTab === 'messages'" class="tab-content">
        <div class="messages-header">
          <h3 class="section-title">💬 {{ t.recentConv }}</h3>
          <button class="btn btn-secondary" @click="createNewConversation">
            <span class="btn-icon">📝</span>
            <span class="btn-text">{{ t.new }}</span>
          </button>
        </div>

        <div class="conversations-grid">
          <button
            v-for="c in conversations"
            :key="c.id"
            class="conversation-card panel"
            @click="openConversation(c)"
          >
            <div class="friend-avatar" :style="{ background: getUserColor(c.participant) }">
              <img
                v-if="convAvatar(c.participant)"
                class="friend-avatar-img"
                :src="convAvatar(c.participant)"
                :alt="`Avatar ${c.participant}`"
                @error="onConvAvatarError(c.participant)"
              />
              <span v-else class="friend-initials">{{ initials(c.participant) }}</span>
            </div>

            <div class="conv-info">
              <div class="top">
                <span class="name">{{ c.participant }}</span>
                <span class="time">{{ formatTime(c.lastMessage.timestamp) }}</span>
              </div>

              <p class="last">{{ c.lastMessage.content }}</p>

              <div class="bottom">
                <span
                  class="status"
                  :class="isUserOnline(c.participant) ? 'online' : 'offline'"
                >
                  <span class="dot"></span>
                  {{ isUserOnline(c.participant) ? 'En ligne' : 'Hors ligne' }}
                </span>

                <span v-if="c.unreadCount > 0" class="badge">{{ c.unreadCount }}</span>
              </div>
            </div>
          </button>
        </div>

        <div v-if="conversations.length === 0" class="empty">
          <div class="big">💬</div>
          <h4>{{ t.noConv }}</h4>
          <p>{{ t.startConvMsg }}</p>
          <button class="btn btn-primary" @click="activeTab = 'friends'">{{ t.viewFriends }}</button>
        </div>
      </div>

      <!-- NOTIFICATIONS -->
      <div v-if="activeTab === 'notifications'" class="tab-content">
        <div class="notif-header">
          <h3 class="section-title">🔔 {{ t.notif }}</h3>
          <button v-if="notifications.length" class="btn btn-secondary" @click="markAllAsRead">
            <span class="btn-icon">✓</span>
            <span class="btn-text">{{ t.allReadBtn }}</span>
          </button>
        </div>

        <div class="notif-list">
          <div
            v-for="n in notifications"
            :key="n.id"
            class="notif-card"
            :class="{ unread: !n.read }"
          >
            <div class="notif-ic">{{ n.icon }}</div>

            <div class="notif-content">
              <h4 class="notif-title">{{ n.title }}</h4>
              <p class="notif-msg">{{ n.message }}</p>
              <span class="notif-time">{{ formatTime(n.timestamp) }}</span>
            </div>

            <div class="notif-actions">
              <button
                v-if="n.actionable"
                class="btn btn-primary"
                @click="handleNotificationAction(n)"
              >
                {{ n.actionText || 'Ouvrir' }}
              </button>

              <button
                v-if="n.actionable && n.actionData?.type === 'friendRequest'"
                class="btn btn-secondary"
                @click="declineFriendRequest(n.actionData.fromUser).then(() => dismissNotification(n.id))"
              >
                {{ t.declineBtn }}
              </button>

              <button
                v-if="n.actionable && n.actionData?.type === 'challenge'"
                class="btn btn-secondary"
                @click="declineChallenge(n.actionData.id); dismissNotification(n.id)"
              >
                {{ t.declineBtn }}
              </button>

              <button class="btn-icon-only" @click="dismissNotification(n.id)">✕</button>
            </div>
          </div>
        </div>

        <div v-if="notifications.length === 0" class="empty">
          <div class="big">🎉</div>
          <h4>{{ t.noNotif }}</h4>
          <p>{{ t.youUpToD }}</p>
        </div>
      </div>
    </div>

    <!-- Chat flottant (même logique que ProfileView) -->
    <Teleport to="body">
      <ChatBoxLite
        v-if="activeChatUser"
        :me="me"
        :receiver="activeChatUser"
        :socket="socket"
        :isOnline="isUserOnline(activeChatUser)"
        :offsetIndex="0"
        @close="activeChatUser = null"
        @challengeUser="onChallengeFromChat"
        @viewProfile="goProfile"
      />
    </Teleport>

    <!-- Modal: nouvelle conversation -->
    <Transition name="fade">
      <div v-if="showNewConversationModal" class="af-overlay" @click.self="showNewConversationModal = false">
        <div class="af-modal">
          <div class="af-header">
            <h3>{{ t.newConv }}</h3>
            <button class="af-close" @click="showNewConversationModal = false">✕</button>
          </div>
          <div class="af-body">
            <input
              v-model="searchQuery"
              class="af-input"
              type="text"
              :placeholder= "t.lookForFrnd"
            />
            <div class="search-results">
              <button
                v-for="u in filteredFriends"
                :key="u"
                class="user-result"
                @click="startConversationWithUser(u)"
              >
                <div class="friend-avatar" :style="{ background: getUserColor(u) }">
                  <span class="friend-initials">{{ initials(u) }}</span>
                </div>
                <div class="user-info">
                  <div class="name">{{ u }}</div>
                  <div class="mini-status" :class="isUserOnline(u)?'online':'offline'">
                    <span class="dot"></span>{{ isUserOnline(u) ? t.online : t.offline}}
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Modal: ajouter un ami (rapide) -->
    <Transition name="fade">
      <div v-if="showAddFriend" class="af-overlay" @click.self="closeAddFriend">
        <div class="af-modal">
          <div class="af-header">
            <h3 class="oui">{{ t.addFriend }}</h3>
            <button class="af-close" @click="closeAddFriend">✕</button>
          </div>
          <form class="af-body" @submit.prevent="submitAddFriend">
            <input
              ref="addFriendInputRef"
              v-model.trim="addFriendForm.username"
              class="af-input"
              type="text"
              placeholder="Pseudo (ex: Alice)"
              :disabled="isAddingFriend"
              required
            />
            <p v-if="addFriendError" class="af-error">{{ addFriendError }}</p>
            <div class="af-actions">
              <button type="button" class="btn btn-secondary" @click="closeAddFriend" :disabled="isAddingFriend">{{ t.cancelBtn }}</button>
              <button type="submit" class="btn btn-primary" :disabled="isAddingFriend || !addFriendForm.username">
                {{ isAddingFriend ? 'Ajout…' : t.add }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import { useRouter } from 'vue-router'
import { useI18n } from '../../composables/useI18n'
const { t, onLangChange } = useI18n()

import FriendList from '../social/FriendList.vue'
import ChatBoxLite from '../../components/ChatBoxLite.vue'

/* ================== Config ================== */
import { API_BASE, SOCKET_URL } from '../../config'

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
  actionData?: any
}

/* ================== State ================== */
const router = useRouter()
const me = (localStorage.getItem('username') || '').trim()
const socket: Socket = io(SOCKET_URL, { transports: ['websocket'] })
if (me) socket.emit('identify', me);
const activeTab = ref<'friends'|'messages'|'notifications'>('friends')

const connectedUsersSet = new Set<string>()
const connectedUsers = ref<string[]>([])
const friendsUsernames = ref<string[]>([])

const conversations = ref<Conversation[]>([])
const notifications = ref<Notification[]>([])
// Toasts globaux gérés dans App.vue si besoin

const activeChatUser = ref<string | null>(null)

const showNewConversationModal = ref(false)
const searchQuery = ref('')

/** Add friend modal (rapide) */
const showAddFriend = ref(false)
const isAddingFriend = ref(false)
const addFriendError = ref<string | null>(null)
const addFriendForm = ref({ username: '' })
const addFriendInputRef = ref<HTMLInputElement | null>(null)
// handler global pour openChat (doit être accessible pour cleanup)
let openChatHandler: ((e: Event) => void) | null = null

/* ================== Tabs ================== */
const tabs = computed(() => [
  { id: 'friends', label: t.value.friends, icon: '👥', count: friendsUsernames.value.length },
  { id: 'messages', label: t.value.messages , icon: '💬', count: conversations.value.reduce((s, c) => s + c.unreadCount, 0) },
  { id: 'notifications', label: t.value.notif, icon: '🔔', count: notifications.value.filter(n => !n.read).length }
])

/* ================== Helpers ================== */
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

const getUserColor = (username: string) => {
  const colors = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
  ]
  const u = (username || 'a').charCodeAt(0)
  return colors[u % colors.length]
}
const initials = (u: string) => (u?.[0] || 'U').toUpperCase()
const formatTime = (ts: string) => {
  const d = new Date(ts); const n = new Date()
  const diff = n.getTime() - d.getTime()
  if (diff < 60_000) return `À l'instant`
  if (diff < 3_600_000) return `Il y a ${Math.floor(diff/60_000)} min`
  if (diff < 86_400_000) return `Il y a ${Math.floor(diff/3_600_000)} h`
  return d.toLocaleDateString('fr-FR')
}

// Avatars des participants des conversations
const avatarByUser = ref<Record<string, string | null>>({})
const toAbs = (u?: string | null) => {
  if (!u) return null
  return u.startsWith('http') ? u : `${API_BASE}${u}`
}
const keyOf = (u: string) => toKey(u)
function convAvatar(u: string): string | null {
  return avatarByUser.value[keyOf(u)] || null
}
function onConvAvatarError(u: string) {
  const k = keyOf(u)
  avatarByUser.value[k] = null
}
async function ensureAvatar(u: string) {
  const k = keyOf(u)
  if (!k || k === toKey(me)) return
  if (k in avatarByUser.value) return
  try {
    const r = await fetch(`${API_BASE}/user/${encodeURIComponent(u)}`)
    if (!r.ok) { avatarByUser.value[k] = null; return }
    const j = await r.json()
    avatarByUser.value[k] = toAbs(j?.avatar || null)
  } catch { avatarByUser.value[k] = null }
}

/* ================== Friends ================== */
async function loadFriends() {
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
function openAddFriend() {
  addFriendError.value = null
  addFriendForm.value.username = ''
  showAddFriend.value = true
  requestAnimationFrame(() => addFriendInputRef.value?.focus())
}
function closeAddFriend() { showAddFriend.value = false }
async function submitAddFriend() {
  const to = addFriendForm.value.username.trim()
  if (!to) return
  if (to === me) { addFriendError.value = 'Tu ne peux pas t’ajouter toi-même 😅'; return }
  try {
    isAddingFriend.value = true
    addFriendError.value = null
    const res = await fetch(`${API_BASE}/friends/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: me, to })
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) { addFriendError.value = payload?.error || `Erreur HTTP ${res.status}`; return }
    await loadFriends()
    activeTab.value = 'friends'
    closeAddFriend()
  } catch (e: any) {
    addFriendError.value = e?.message || 'Erreur inconnue'
  } finally {
    isAddingFriend.value = false
  }
}

/* ================== Conversations ================== */
function upsertConversation(participant: string, last: Conversation['lastMessage'], addUnread = 0) {
  const p = normalize(participant)
  if (!p) return
  const found = conversations.value.find(c => toKey(c.participant) === toKey(p))
  if (found) {
    if (new Date(last.timestamp).getTime() >= new Date(found.lastMessage.timestamp).getTime()) {
      found.lastMessage = last
    }
    found.unreadCount = Math.max(0, (found.unreadCount || 0) + addUnread)
  } else {
    conversations.value.push({ id: `conv-${p}`, participant: p, lastMessage: last, unreadCount: addUnread })
  }
  conversations.value.sort((a, b) => new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime())
  // Précharge l'avatar en tâche de fond
  ensureAvatar(p)
}
async function syncConversationsFromServer() {
  if (!me) return
  const peers = new Set<string>([...friendsUsernames.value, ...connectedUsers.value])
  const jobs = Array.from(peers).map(async peer => {
    if (!peer || peer === me) return
    try {
      const r = await fetch(`${API_BASE}/chat/message/${encodeURIComponent(me)}/${encodeURIComponent(peer)}?limit=1`)
      if (!r.ok) return
      const arr = await r.json()
      if (!Array.isArray(arr) || arr.length === 0) return
      const last = arr[arr.length - 1]
      const msg = { content: last.content || '', timestamp: last.timestamp || new Date().toISOString(), senderId: last.sender || last.from || peer }
      upsertConversation(peer, msg, 0)
      ensureAvatar(peer)
    } catch { /* noop */ }
  })
  await Promise.allSettled(jobs)
}
function startChat(username: string) {
  activeChatUser.value = username
  const c = conversations.value.find(x => toKey(x.participant) === toKey(username))
  if (c) c.unreadCount = 0
}
function openConversation(c: Conversation) { startChat(c.participant) }
function createNewConversation() { showNewConversationModal.value = true; searchQuery.value = '' }
const filteredFriends = computed(() => {
  const q = searchQuery.value.toLowerCase()
  if (!q) return friendsUsernames.value
  return friendsUsernames.value.filter(u => u.toLowerCase().includes(q))
})
function startConversationWithUser(u: string) {
  showNewConversationModal.value = false
  const existing = conversations.value.find(c => toKey(c.participant) === toKey(u))
  if (!existing) {
    conversations.value.unshift({
      id: `conv-${u}`,
      participant: u,
      lastMessage: { content: 'Nouvelle conversation', timestamp: new Date().toISOString(), senderId: me || 'me' },
      unreadCount: 0
    })
  }
  startChat(u)
}

/* ================== Notifications (avec persistance) ================== */
const LS_NOTIF_KEY = computed(() => `social_notifications_${me}`)
function saveNotifsLS() {
  try { localStorage.setItem(LS_NOTIF_KEY.value, JSON.stringify(notifications.value)) } catch {}
}
function loadNotifsLS() {
  try {
    const raw = localStorage.getItem(LS_NOTIF_KEY.value)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) notifications.value = arr
    }
  } catch {}
}
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
  })
  saveNotifsLS()
}
const preloadPendingFriendRequests = async () => {
  if (!me) return
  try {
    const r = await fetch(`${API_BASE}/friends/requests/${encodeURIComponent(me)}`)
    if (!r.ok) return
    const rows: Array<{ fromUser: string }> = await r.json()
    const existingFrom = new Set(
      notifications.value
        .filter(n => n.actionData?.type === 'friendRequest' && n.actionData.fromUser)
        .map(n => n.actionData!.fromUser as string)
    )
    rows.forEach(({ fromUser }) => {
      if (fromUser && !existingFrom.has(fromUser)) pushFriendRequestNotification(fromUser)
    })
  } catch {}
}
const markAllAsRead = () => { notifications.value.forEach(n => (n.read = true)); saveNotifsLS() }
const acceptFriendRequest = async (fromUser: string) => {
  const body = { from: fromUser, to: me, accept: true }
  await fetch(`${API_BASE}/friends/respond`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
const declineFriendRequest = async (fromUser: string) => {
  const body = { from: fromUser, to: me, accept: false }
  await fetch(`${API_BASE}/friends/respond`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
const handleNotificationAction = async (n: Notification) => {
  if (n.actionData?.type === 'friendRequest') {
    const fromUser = n.actionData.fromUser
    if (!fromUser) return
    await acceptFriendRequest(fromUser)
    dismissNotification(n.id)
  }
  if (n.actionData?.type === 'challenge') {
    acceptChallenge(n.actionData.id)
    dismissNotification(n.id)
  }
}
const dismissNotification = (id: string) => {
  const i = notifications.value.findIndex(n => n.id === id)
  if (i !== -1) notifications.value.splice(i, 1)
  saveNotifsLS()
}

/* ==== Challenge depuis SocialView et ChatBoxLite ==== */
function challengeUser(username: string) {
  if (!username || !me) return
  socket.emit('identify', me)
  socket.emit('challengePlayer', { from: me, to: username, options: { maxPoints: 10, durationMinutes: null } })
}
function onChallengeFromChat(username: string) { challengeUser(username) }
function acceptChallenge(chId: string) { socket.emit('challengeRespond', { challengeId: chId, accept: true }) }
function declineChallenge(chId: string) { socket.emit('challengeRespond', { challengeId: chId, accept: false }) }

/* ==== Navigation profil ==== */
function goProfile(username: string) {
  router.push('/profile/' + encodeURIComponent(username))
}

/* ====== Challenge start handling (CRUCIAL) ====== */
let handledStart = false
function handleChallengeStart(payload: any) {
  if (!payload || !payload.roomId) return
  if (handledStart) return
  handledStart = true
  const rid = String(payload.roomId)
  try { localStorage.setItem('pendingRoomId', rid) } catch {}
  // event global pour GameView si déjà monté
  window.dispatchEvent(new CustomEvent('challengeStart', { detail: { roomId: rid }}))
  // naviguer vers la page de jeu (si pas déjà dessus)
  if (router.currentRoute.value.path !== '/game') {
    // éviter doublon si on spam click : petit debounce visuel possible
    router.push('/game').finally(() => {
      // on relâche le flag après un court instant (optionnel)
      setTimeout(() => { handledStart = false }, 2000)
    })
  } else {
    // déjà sur /game → libérer après un court instant
    setTimeout(() => { handledStart = false }, 2000)
  }
}

/* ================== Socket lifecycle ================== */
onMounted(async () => {
  
  // Notifs LS
  loadNotifsLS()

  socket.on('connect', () => {
    if (me) socket.emit('identify', me)
    socket.emit('requestConnectedUsers')
  })
  socket.io?.on?.('reconnect', () => { if (me) socket.emit('identify', me) });
  // Présence
  socket.on('connectedUsersList', (users: string[]) => setConnectedUsers(users))
  socket.on('userConnected', (username: string) => addConnectedUser(username))
  socket.on('userDisconnected', (username: string) => removeConnectedUser(username))

  // Notifications entrantes
  socket.on('newNotification', (n: any) => {
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
    })
    saveNotifsLS()

    // Les popups sont désormais gérées globalement dans App.vue
  })

  // Messages entrants → upsert + badge si chat non ouvert
  const onIncoming = (data: { sender: string; message: string; timestamp: string }) => {
    const last = { content: data.message, timestamp: data.timestamp, senderId: data.sender }
    const unread = activeChatUser.value && toKey(activeChatUser.value) === toKey(data.sender) ? 0 : 1
    upsertConversation(data.sender, last, unread)
  }
  socket.on('messageReceived', onIncoming)
  socket.on('newMessage', onIncoming)

  // Liste amis
  socket.on('friendsUpdated', () => loadFriends())

  // ⚠️ Le point qui manquait pour l'acceptant
  socket.on('challengeStart', handleChallengeStart)

  await loadFriends()
  await preloadPendingFriendRequests()
  await syncConversationsFromServer()

  // Précharger avatars pour les conversations présentes
  conversations.value.forEach(c => ensureAvatar(c.participant))

  // resync quand on arrive sur Messages
  watch(activeTab, (t) => { if (t === 'messages') syncConversationsFromServer() })
  // resync quand amis changent
  watch(friendsUsernames, () => { syncConversationsFromServer() })

  // Ouvrir une conversation via événement global
  openChatHandler = (e: Event) => {
    try {
      const ce = e as CustomEvent
      const u = (ce.detail?.username || '').trim()
      if (u) {
        startConversationWithUser(u)
        activeTab.value = 'messages'
      }
    } catch {}
  }
  window.addEventListener('openChat', openChatHandler)

  // Consommer une cible stockée (si navigation déclenchée depuis un toast)
  try {
    const target = (localStorage.getItem('social_open_chat_with') || '').trim()
    if (target) {
      localStorage.removeItem('social_open_chat_with')
      startConversationWithUser(target)
      activeTab.value = 'messages'
    }
  } catch {}
})

onBeforeUnmount(() => {
  socket.off('connectedUsersList')
  socket.off('userConnected')
  socket.off('userDisconnected')
  socket.off('newNotification')
  socket.off('messageReceived')
  socket.off('newMessage')
  socket.off('challengeStart')
  socket.disconnect()
  if (openChatHandler) window.removeEventListener('openChat', openChatHandler)
  openChatHandler = null
})


</script>

<style scoped>
/* ====== En-tête (aligné sur ProfileView) ====== */
.social-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
  --social-foreground: var(--color-heading);
  --social-muted: var(--color-text);
}

.oui{color: white;}

:root:not([data-theme='dark']) .social-page,
[data-theme='light'] .social-page {
  --social-foreground: #fdfdff;
  --social-muted: #475569;
}
.social-header {
  border-radius: 7px;
  padding: 1.25rem 1.5rem;
  display: flex; align-items: center; justify-content: space-between;
  box-shadow: var(--shadow-lg);
  margin-bottom: 1.25rem;
}
.header-left .title { margin: 0; font-size: 1.6rem; font-weight: 800; color: white }
.header-left .subtitle { margin: .25rem 0 0; color: white; opacity: .78; font-size: .95rem }

/* ====== Onglets (copie du style ProfileView) ====== */
.profile-tabs { display: flex; border-radius: 12px; padding: .6rem; margin-bottom: 1.25rem; gap: .5rem }
.tab-btn { display: flex; align-items: center; gap: .55rem; background: transparent; border: 1px solid transparent; padding: .75rem 1.5rem; border-radius: 12px; cursor: pointer; color: var(--social-foreground); opacity: .85; transition: .25s; font-weight: 600; flex: 1; justify-content: center }
.tab-btn .tab-text,
.tab-btn .tab-icon { color: white; }
.tab-btn:hover { opacity: 1; transform: translateY(-2px); }
.tab-btn.active { background: var(--color-background); border-color: var(--color-border); color: var(--social-foreground); opacity: 1; box-shadow: var(--shadow-md); }
.tab-btn.active .tab-text,
.tab-btn.active .tab-icon { color: inherit; }
.tab-icon { font-size: 1.05rem; }
.tab-count { background: rgba(79, 172, 254, 0.15); color: var(--social-foreground); font-size: .75rem; font-weight: 600; padding: .2rem .55rem; border-radius: 999px; min-width: 1.6rem; text-align: center }

/* ====== Contenu (copie du style ProfileView) ====== */
.profile-content { background: var(--color-background-soft); border-radius: 7px; padding: 1.5rem; box-shadow: var(--shadow-md) }
.tab-content { animation: fadeIn .25s ease }
@keyframes fadeIn { from{ opacity:0; transform: translateY(10px) } to{ opacity:1; transform: translateY(0) } }

.section-title { font-size: 1.2rem; font-weight: 800; color: white; margin: 0 }
.friends-header, .messages-header, .notif-header { display:flex; align-items:center; justify-content:space-between; margin-bottom: 1rem }

/* ====== Conversations (look proche des cards amis) ====== */
.conversations-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem;
}
.conversation-card {
  display:flex; gap: .9rem; align-items:center; text-align:left;
  
  padding: 1rem; border-radius: 7px; transition: .2s; cursor: pointer;
}
.conversation-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md) }
.friend-avatar {
  width: 3rem; height: 3rem; border-radius: 50%; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; letter-spacing:.5px
}
.friend-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block }
.friend-initials { font-size: 1.1rem }
.conv-info { flex:1; min-width:0 }
.top { display:flex; justify-content:space-between; align-items:center; margin-bottom:.2rem }
.name { font-weight: 700; color: var(--social-foreground) }
.time { color: var(--social-muted); opacity:.7; font-size:.85rem }
.last { margin:.2rem 0 .5rem 0; color: var(--social-muted); opacity:.85; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.bottom { display:flex; justify-content:space-between; align-items:center }
.status { display:inline-flex; align-items:center; gap:.4rem; font-size:.86rem; color: var(--social-muted); opacity:.75 }
.status.online { color: #10b981; opacity:1 }
.status.offline { color: #ef4444; opacity:1 }
.status .dot { width:6px; height:6px; border-radius:50%; background: currentColor }
.badge { background: var(--gradient-primary); color:#fff; border-radius: 7px; padding:.15rem .45rem; font-size:.75rem; font-weight:700 }

/* ====== Notifications ====== */
.notif-list { display:flex; flex-direction:column; gap:.8rem }
.notif-card {
  display:flex; gap:.9rem; align-items:center; background: var(--color-background);
  border: 2px solid var(--color-border); border-radius: 7px; padding: .9rem 1rem;
}
.notif-card.unread { border-color: var(--color-primary) }
.notif-ic { font-size: 1.6rem; flex-shrink:0 }
.notif-content { flex:1 }
.notif-title { margin:0 0 .2rem; font-weight:800; color: var(--social-foreground) }
.notif-msg { margin:0 0 .25rem; color: var(--social-muted); opacity:.85 }
.notif-time { font-size:.85rem; color: var(--social-muted); opacity:.65 }
.btn-icon-only {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.35rem;
  height: 2.35rem;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--color-background);
  color: var(--social-foreground);
  cursor: pointer;
  transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
}
.btn-icon-only:hover {
  transform: translateY(-2px);
  border-color: var(--color-border-hover);
  box-shadow: var(--shadow-md);
  color: var(--social-foreground);
}

/* ====== États vides ====== */
.empty { text-align:center; padding: 2.4rem 1rem; color: var(--social-foreground) }
.empty .big { font-size: 3rem; opacity:.7 }
.empty h4 { margin:.4rem 0; font-size:1.2rem }
.empty p { margin:0 0 1rem; opacity:.75 }

/* ====== Boutons / commun ====== */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .55rem;
  padding: 0.85rem 1.25rem;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: var(--color-background-mute);
  color: white;
  font-weight: 700;
  cursor: pointer;
  transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease, filter .2s ease;
}

.btn:hover {
  transform: translateY(-2px);
  border-color: var(--color-border-hover);
  box-shadow: var(--shadow-md);
}

.btn:disabled {
  opacity: .6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
  filter: grayscale(.25);
}

.btn-primary {
  color: #0b132b;
  background: var(--gradient-brand);
  border-color: transparent;
  box-shadow: var(--glow-primary);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: var(--glow-primary), var(--shadow-lg);
}

.btn-secondary {
  background: var(--color-background);
  border-style: dashed;
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-background);
  border-style: solid;
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(0,0,0,.18);
}

.btn-icon {
  font-size: 1.05rem;
}

/* ====== Modals (add friend + new conversation) ====== */
.fade-enter-active,
.fade-leave-active { transition: opacity .18s ease }
.fade-enter-from,
.fade-leave-to { opacity: 0 }
.af-overlay { position: fixed; inset: 0; background: rgba(255, 251, 251, 0.64); display: grid; place-items: center; z-index: 1000; border-radius: 3%}
.af-modal {
  width: min(520px, 100%);
  background: var(--panel-bg, var(--color-background));
  border: 1px solid var(--panel-border, var(--color-border));
  border-radius: 18px;
  box-shadow: var(--panel-shadow);
  overflow: hidden;
  animation: popIn .18s ease;
}
@keyframes popIn { from { transform: translateY(8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.af-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1.2rem 1.5rem;
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--panel-border, var(--color-border));
}
.af-header h3 { margin: 0; font-size: 1.15rem; font-weight: 700; color: white; }
.af-close {
  border: none;
  background: transparent;
  color: var(--social-muted);
  opacity: 0.7;
  cursor: pointer;
  font-size: 1.1rem;
  transition: opacity .2s ease, transform .2s ease;
}
.af-close:hover { opacity: 1; transform: scale(1.05); }
.af-body { padding: 1.3rem 1.5rem 1.5rem; display: grid; gap: 1rem; opacity: 0.9; }
.af-input {
  width: 100%;
  padding: .85rem 1rem;
  border-radius: 12px;
  border: 1px solid var(--panel-border, var(--color-border));
  background: var(--color-background);
  color: var(--social-foreground);
  font-size: 1rem;
  transition: border-color .2s ease, box-shadow .2s ease;
}
.af-input::placeholder {
  color: rgba(100, 116, 139, 0.75);
}
.af-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(79, 172, 254, 0.18);
}
.af-error { margin: .4rem 0 0; color: var(--color-danger); font-weight: 600; }
.af-actions { display: flex; gap: .75rem; justify-content: flex-end; }
.search-results { display: grid; gap: .6rem; }
.user-result {
  display: flex;
  align-items: center;
  gap: .75rem;
  padding: .65rem .8rem;
  border-radius: 12px;
  background: var(--color-background-soft);
  border: 1px solid var(--panel-border, var(--color-border));
  cursor: pointer;
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
}
.user-result:hover {
  transform: translateY(-2px);
  border-color: var(--color-border-hover);
  box-shadow: var(--shadow-md);
}
.user-info .name { font-weight: 700; color: var(--color-heading); }
.mini-status { display: flex; align-items: center; gap: .35rem; font-size: .86rem; opacity: .8; }
.mini-status.online { color: #10b981; opacity: 1; }
.mini-status.offline { color: #ef4444; opacity: 1; }
.dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

/* ====== Responsive ====== */
@media (max-width: 768px){
  .social-page { padding: 1rem }
  .profile-tabs { flex-wrap: wrap }
  .conversations-grid { grid-template-columns: 1fr }
}
</style>
