<template>
  <div class="profile-page">
    <!-- Header du profil (toujours visible) -->
    <div class="profile-header">
      <div class="profile-banner" :style="bannerStyle">
        <div class="banner-gradient"></div>
        <button
          class="edit-banner-btn"
          v-if="isSelf"
          @click="triggerBannerPicker"
          :disabled="isUploadingBanner"
        >
          <span class="edit-icon">{{ isUploadingBanner ? '⏳' : '📸' }}</span>
          <span class="edit-text">Changer la bannière</span>
        </button>
        <input
          ref="bannerInput"
          id="bannerInput"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          @change="uploadBanner"
        />
      </div>

      <!-- ⚠️ profile-info DOIT rester dans profile-header -->
      <div class="profile-info">
        <div class="avatar-section">
          <div class="avatar-container">
            <div class="user-avatar" :style="{ background: getUserColor(user.username) }">
              <img
                v-if="user.avatar"
                :src="user.avatar"
                alt="Avatar"
                class="avatar-img"
                @error="onAvatarError"
              />
              <span v-else class="avatar-initials">
                {{ user.username?.[0]?.toUpperCase() || 'U' }}
              </span>
            </div>

            <button
              class="avatar-edit"
              v-if="isSelf"
              @click="triggerAvatarPicker"
              :disabled="isUploadingAvatar"
              title="Changer l’avatar"
            >
              {{ isUploadingAvatar ? '⏳' : '✏️' }}
            </button>
            <input
              ref="avatarInput"
              id="avatarInput"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              @change="uploadAvatar"
            />
          </div>

          <div class="user-details">
            <h1 class="username">
              {{ user.username }}
            </h1>
            <p class="user-status" :class="getStatusClass(user.status)">
              <span class="status-dot"></span>
              {{ getStatusText(user.status) }}
            </p>
            <p class="join-date">Membre depuis {{ formatDate(user.createdAt) }}</p>
          </div>
        </div>
        <div class="profile-actions">
          <button @click="shareProfile" class="btn btn-secondary">
            <span class="btn-icon">📤</span>
            <span class="btn-text">Partager</span>
          </button>
          <button v-if="isSelf" @click="handleLogout" class="btn btn-secondary" style="background-color: #850606;">
              <span class="btn-icon">🚪</span>
              <span class="btn-text">Déconnexion</span>
            </button>
        </div>
      </div>
    </div> <!-- /profile-header -->

    <!-- Navigation des onglets (masquée si profil privé et que ce n’est pas moi) -->
    <div v-if="!user.isPrivate || isSelf" class="profile-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="activeTab = tab.id"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        <span class="tab-text">{{ tab.label }}</span>
        <span v-if="tab.count" class="tab-count">{{ tab.count }}</span>
      </button>
    </div>

    <!-- Contenu des onglets (masqué si profil privé et que ce n’est pas moi) -->
    <div v-if="!user.isPrivate || isSelf" class="profile-content">
      <!-- Onglet Statistiques -->
      <div v-if="activeTab === 'stats'" class="tab-content">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">🏆</div>
            <div class="stat-info">
              <h3 class="stat-number">{{ stats.gamesWon }}</h3>
              <p class="stat-label">Parties gagnées</p>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon">🎮</div>
            <div class="stat-info">
              <h3 class="stat-number">{{ stats.totalGames }}</h3>
              <p class="stat-label">Parties jouées</p>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon">📊</div>
            <div class="stat-info">
              <h3 class="stat-number">{{ winRate }}%</h3>
              <p class="stat-label">Taux de victoire</p>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon">⭐</div>
            <div class="stat-info">
              <h3 class="stat-number">{{ stats.ranking }}</h3>
              <p class="stat-label">Classement</p>
            </div>
          </div>
        </div>

        <div class="charts-section">
          <div class="chart-card">
            <h3 class="chart-title">Historique des performances</h3>
            <div class="performance-chart">
              <canvas ref="performanceChart"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Onglet Historique -->
      <div v-if="activeTab === 'history'" class="tab-content">
        <div class="game-history">
          <div v-for="game in gameHistory" :key="game.id" class="history-item">
            <div class="game-result" :class="game.result">
              <span class="result-icon">{{ game.result === 'win' ? '🏆' : '💔' }}</span>
              <span class="result-text">{{ game.result === 'win' ? 'Victoire' : 'Défaite' }}</span>
            </div>

            <div class="game-details">
              <h4 class="opponent">Joue contre: {{ game.opponent }}</h4>
              <p class="game-score">{{ game.playerScore }} - {{ game.opponentScore }}</p>
              <p class="game-date">{{ formatDate(game.date) }}</p>
            </div>

            <div class="game-duration">
              <span class="duration-text">{{ game.duration }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Onglet Amis -->
      <div v-if="activeTab === 'friends'" class="tab-content">
        <div class="friends-section">
          <div class="friends-header">
            <h3 class="section-title">Mes amis ({{ friends.length }})</h3>
            <button
              v-if="isSelf"
              class="btn btn-primary"
              @click="openAddFriend"
              :disabled="isAddingFriend"
            >
              <span class="btn-icon">{{ isAddingFriend ? '⏳' : '➕' }}</span>
              <span class="btn-text">{{ isAddingFriend ? 'Ajout...' : 'Ajouter un ami' }}</span>
            </button>
          </div>

          <div class="friends-grid">
            <div
              v-for="friend in friends"
              :key="friend.id"
              class="friend-card"
              @click="viewFriend(friend)"
            >
              <div class="friend-avatar" :style="{ background: getUserColor(friend.username) }">
                <img
                  v-if="friend.avatar"
                  :src="friend.avatar"
                  alt=""
                  class="friend-avatar-img"
                  @error="onFriendAvatarError"
                />
                <span v-else class="friend-initials">
                  {{ friend.username?.[0]?.toUpperCase() || 'U' }}
                </span>
              </div>

              <div class="friend-info">
                <h4 class="friend-name">{{ friend.username }}</h4>
                <p class="friend-status" :class="getStatusClass(friend.status)">
                  <span class="status-dot"></span>
                  {{ getStatusText(friend.status) }}
                </p>
              </div>

              <div v-if="isSelf" class="friend-actions">
                <button @click.stop="challengeFriend(friend)" class="btn-icon-only" title="Défier">🎯</button>
                <button @click.stop="messageFriend(friend)" class="btn-icon-only" title="Message">💬</button>
                <button @click.stop="removeFriend(friend)" class="btn-icon-only danger" title="Supprimer">🗑️</button>
              </div>
            </div>
          </div>
        </div>
      </div>



      <!-- Onglet Paramètres (uniquement si isSelf dans tabs) -->
      <div v-if="activeTab === 'settings'" class="tab-content">
        <div class="settings-section">
          <form @submit.prevent="saveSettings" class="settings-form">
            <div class="setting-group">
              <label class="setting-label">Nom d'utilisateur</label>
              <input
                v-model="settings.username"
                type="text"
                class="setting-input"
                :readonly="!editMode.username"
              />
              <button type="button" @click="toggleEdit('username')" class="edit-btn">
                {{ editMode.username ? '✅' : '✏️' }}
              </button>
            </div>

            <div class="setting-group">
              <label class="setting-label">Email</label>
              <input
                v-model="settings.email"
                type="email"
                class="setting-input"
                :readonly="!editMode.email"
              />
              <button type="button" @click="toggleEdit('email')" class="edit-btn">
                {{ editMode.email ? '✅' : '✏️' }}
              </button>
            </div>

            <!-- Mot de passe -->
            <div class="setting-group">
              <label class="setting-label">Mot de passe</label>
              <input type="password" class="setting-input" :value="'••••••••'" readonly />
              <button type="button" @click="toggleEdit('password')" class="edit-btn">
                {{ editMode.password ? '✅' : '✏️' }}
              </button>
            </div>

            <div class="setting-group" v-if="editMode.password">
              <label class="setting-label">Sécurité</label>
              <input
                v-model="passwordForm.current"
                type="password"
                class="setting-input"
                placeholder="Mot de passe actuel"
                autocomplete="current-password"
              />
              <input
                v-model="passwordForm.new1"
                type="password"
                class="setting-input"
                placeholder="Nouveau mot de passe"
                autocomplete="new-password"
              />
              <input
                v-model="passwordForm.new2"
                type="password"
                class="setting-input"
                placeholder="Confirmer le nouveau"
                autocomplete="new-password"
              />
            </div>

            <div class="setting-group">
              <label class="setting-label">Langue</label>
              <select v-model="settings.language" class="setting-select">
                <option value="fr">🇫🇷 Français</option>
                <option value="en">🇬🇧 English</option>
                <option value="es">🇪🇸 Español</option>
              </select>
            </div>

            <div class="setting-group">
              <label class="setting-checkbox">
                <input type="checkbox" v-model="settings.privateProfile" />
                <span class="checkbox-custom"></span>
                <span class="checkbox-text">Profil privé</span>
              </label>
            </div>

            <div class="settings-actions">
              <button type="submit" class="btn btn-primary">
                <span class="btn-icon">💾</span>
                <span class="btn-text">Sauvegarder</span>
              </button>

              <button type="button" @click="resetSettings" class="btn btn-secondary">
                <span class="btn-icon">🔄</span>
                <span class="btn-text">Réinitialiser</span>
              </button>
            </div>
          </form>
             <!-- NOUVELLE SECTION 2FA -->
            <div class="settings-category">
              <h3 class="category-title">🔒 Sécurité du compte</h3>
              <div class="security-section">
                <TwoFactorAuth />
              </div>
            </div>

          <div class="danger-zone">
            <h3 class="danger-title">Zone dangereuse</h3>
            <button @click="deleteAccount" class="btn btn-danger">
              <span class="btn-icon">🗑️</span>
              <span class="btn-text">Supprimer le compte</span>
            </button>
          </div>
        </div>
      </div>
    </div> <!-- /profile-content -->

    <!-- Vue restreinte (si profil privé et que ce n'est PAS moi) -->
    <div v-else class="profile-content">
      <div class="no-access text-center" style="padding:2rem">
        <div style="font-size:3rem; line-height:1">🔒</div>
        <h3 class="no-content-title" style="margin:.5rem 0">Profil privé</h3>
        <p class="no-content-text">
          Ce joueur a rendu son profil privé. Tu ne peux voir que les informations d’en-tête.
        </p>
      </div>
    </div>

    <!-- Bouton Déconnexion (toujours caché si pas soi-même) -->
    <div class="text-center" style="margin-top:1rem">
      <div class="danger-zone">
        <button v-if="isSelf" @click="handleLogout" class="btn btn-danger">
          <span class="btn-icon">🚪</span>
          <span class="btn-text">Déconnexion</span>
        </button>
      </div>
    </div>
    <!-- ===== Chat flottant ===== -->
    <Teleport to="body">
      <ChatBoxLite
        v-if="showChat && selectedUser"
        :me="selfUsername"
        :receiver="selectedUser"
        :socket="statsSocket"
        :isOnline="true"
        :offsetIndex="0"
        @close="showChat = false"
        @challengeUser="challengeFriend({ username: $event } as any)"
        @viewProfile="(u) => router.push('/profile/' + encodeURIComponent(u))"
      />
    </Teleport>

    <!-- ===== Modal Ajouter un ami ===== -->
    <transition name="fade">
      <div v-if="showAddFriend" class="af-overlay" @click.self="closeAddFriend">
        <div class="af-modal" role="dialog" aria-modal="true" aria-labelledby="af-title">
          <div class="af-header">
            <h3 id="af-title">Ajouter un ami</h3>
            <button class="af-close" @click="closeAddFriend" aria-label="Fermer">✕</button>
          </div>

          <form class="af-body" @submit.prevent="submitAddFriend">
            <label class="af-label" for="af-username">Pseudo de l’ami</label>
            <input
              id="af-username"
              ref="addFriendInputRef"
              v-model.trim="addFriendForm.username"
              type="text"
              class="af-input"
              placeholder="ex : Alice"
              :disabled="isAddingFriend"
              autocomplete="off"
              required
            />
            <p v-if="addFriendError" class="af-error">{{ addFriendError }}</p>

            <div class="af-actions">
              <button
                type="button"
                class="btn btn-secondary"
                @click="closeAddFriend"
                :disabled="isAddingFriend"
              >
                Annuler
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                :disabled="isAddingFriend || !addFriendForm.username"
              >
                {{ isAddingFriend ? 'Ajout...' : 'Ajouter' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </transition>
    <!-- ===== /Modal ===== -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, onUnmounted, nextTick  } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { logout as authLogout } from '../stores/auth'
// NOUVEAU IMPORT POUR LA 2FA
import TwoFactorAuth from '../components/TwoFactorAuth.vue'
import { io } from 'socket.io-client';
import ChatBoxLite from '../components/ChatBoxLite.vue'

/** ====== Config API ====== **/
const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:3000'
const route = useRoute()
const router = useRouter()

const statsSocket = io(API_BASE, { transports: ['websocket'] });

/** ====== Types ====== **/
interface User {
  id: string
  username: string
  email: string
  avatar: string | null
  banner?: string | null
  status: 'online' | 'offline' | 'playing'
  createdAt: string
  isPrivate?: boolean
}
interface Stats { totalGames: number; gamesWon: number; ranking: number }
interface GameHistory {
  id: string
  opponent: string
  result: 'win' | 'loss'
  playerScore: number
  opponentScore: number
  date: string
  duration: string
}
interface Friend { id: string; username: string; avatar?: string | null; status: 'online' | 'offline' | 'playing' }

/** ====== Session / Profil affiché ====== **/
const selfUsername = ref(localStorage.getItem('username') || 'Joueur')
const viewedUsername = computed(() =>
  (route.params.username as string) || selfUsername.value
)
const isSelf = computed(() => viewedUsername.value === selfUsername.value)

/** ====== État ====== **/
const user = ref<User>({
  id: '0',
  username: viewedUsername.value,
  email: 'user@example.com',
  avatar: null,
  banner: null,
  status: 'online',
  createdAt: '2024-01-01',
  isPrivate: false
})
const stats = ref<Stats>({ totalGames: 0, gamesWon: 0, ranking: 0 })
const gameHistory = ref<GameHistory[]>([])
const friends = ref<Friend[]>([])

const activeTab = ref<'stats'|'history'|'friends'|'settings'>('stats')

const showChat = ref(false)
const selectedUser = ref<string | null>(null)
function openChatWithUser(username: string) { selectedUser.value = username; showChat.value = true }

/** Paramètres (Settings) **/
const editMode = ref({ username: false, email: false, password: false })
const settings = ref({
  username: user.value.username,
  email: user.value.email,
  language: localStorage.getItem('pref_language') || 'fr',
  privateProfile: localStorage.getItem('pref_private') === 'true'
})
const passwordForm = ref({ current: '', new1: '', new2: '' })
// --- sélection de l’onglet via l’URL (et fallback localStorage) ---
const validTabs = new Set(['stats','history','friends','settings'])

function applyTabFromRouteOrMemory() {
  const qTab = typeof route.query.tab === 'string' ? route.query.tab : ''
  const mem  = localStorage.getItem('profile_target_tab') || ''
  const picked = (qTab || mem).toLowerCase()

  // settings uniquement pour soi-même
  if (picked && validTabs.has(picked) && (picked !== 'settings' || isSelf.value)) {
    activeTab.value = picked as any
  }

  // on nettoie la mémoire pour éviter des effets collatéraux
  localStorage.removeItem('profile_target_tab')
}

/** ====== Modal Ajouter un ami ====== **/
const showAddFriend = ref(false)
const isAddingFriend = ref(false)
const addFriendError = ref<string | null>(null)
const addFriendForm = ref({ username: '' })
const addFriendInputRef = ref<HTMLInputElement | null>(null)
const openAddFriend = () => { addFriendError.value = null; addFriendForm.value.username = ''; showAddFriend.value = true; requestAnimationFrame(() => addFriendInputRef.value?.focus()) }
const closeAddFriend = () => { showAddFriend.value = false }
const submitAddFriend = async () => {
const to = addFriendForm.value.username.trim()
if (!to) return
if (to === selfUsername.value) { addFriendError.value = 'Tu ne peux pas t’ajouter toi-même 😅'; return }
  try {
    isAddingFriend.value = true
    addFriendError.value = null
    const res = await fetch(`${API_BASE}/friends/request`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: selfUsername.value, to })
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) { addFriendError.value = payload?.error || `Erreur HTTP ${res.status}`; return }
    await fetchFriends()
    activeTab.value = 'friends'
    closeAddFriend()
  } catch (e: any) { addFriendError.value = e?.message || 'Erreur inconnue' }
  finally { isAddingFriend.value = false }
}

/** ====== Suppression compte ====== **/
const deleteAccount = async () => {
  if (!confirm('Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.')) return
  try {
    const res = await fetch(`${API_BASE}/user/${encodeURIComponent(user.value.username)}`, { method: 'DELETE' })
    if (!res.ok) { const txt = await res.text().catch(()=> ''); throw new Error(txt || 'Suppression impossible') }
    localStorage.clear()
     router.push('/')
  } catch (e: any) {
    alert(e.message || 'Erreur lors de la suppression du compte')
  }
}

/** ====== Onglets / Computed ====== **/
const tabs = computed(() => {
  const base = [
    { id: 'stats', label: 'Statistiques', icon: '📊' },
    { id: 'history', label: 'Historique', icon: '📜', count: gameHistory.value.length },
    { id: 'friends', label: 'Amis', icon: '👥', count: friends.value.length },
  ]
  if (isSelf.value) base.push({ id: 'settings', label: 'Paramètres', icon: '⚙️' })
  return base
})
const winRate = computed(() => stats.value.totalGames === 0 ? 0 : Math.round((stats.value.gamesWon / stats.value.totalGames) * 100))

/** ====== Utils ====== **/
const getUserColor = (username: string) => {
  if (!username || !username.length) return 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
  const colors = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
  ]
  return colors[username.charCodeAt(0) % colors.length]
}
const getStatusClass = (status: string) => ({
  'status-online': status === 'online',
  'status-offline': status === 'offline',
  'status-playing': status === 'playing'
})
const getStatusText = (status: string) =>
  ({ online: 'En ligne', offline: 'Hors ligne', playing: 'En jeu' } as any)[status] || 'Inconnu'
const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })

/** ====== Actions ====== **/
const shareProfile = async () => {
  const title = `Profil de ${user.value.username}`
  const url = window.location.href
  try {
    if (navigator.share) await navigator.share({ title, text: title, url })
    else { await navigator.clipboard.writeText(url); alert('Lien copié !') }
  } catch { /* noop */ }
}

const fetchUser = async () => {
  try {
    const u = encodeURIComponent(viewedUsername.value)
    const r = await fetch(`${API_BASE}/user/${u}`)
    if (!r.ok) return
    const data = await r.json()
    user.value.id = String(data.id)
    user.value.username = data.username
    user.value.email = data.email
    user.value.avatar = data.avatar ?? null
    user.value.banner = data.banner ?? null
    user.value.status = data.status ?? 'offline'
    user.value.createdAt = data.createdAt || data.created_at || user.value.createdAt
    user.value.isPrivate = !!data.isPrivate
    if (isSelf.value) settings.value.privateProfile = !!data.isPrivate
    settings.value.username = data.username
    settings.value.email = data.email
  } catch (e) { console.warn('fetchUser error:', e) }
}

const fetchStats = async () => {
  try {
    const r = await fetch(`${API_BASE}/user/${encodeURIComponent(viewedUsername.value)}/stats`)
    if (!r.ok) return
    const s = await r.json()
    stats.value.totalGames = Number(s.totalGames) || 0
    stats.value.gamesWon = Number(s.gamesWon) || 0
    stats.value.ranking = Number(s.ranking) || 0
    await nextTick(); renderPerformanceChart()
  } catch (e) { console.warn('fetchStats error:', e) }
}

const fetchHistory = async () => {
  try {
    const r = await fetch(`${API_BASE}/user/${encodeURIComponent(viewedUsername.value)}/history`)
    gameHistory.value = r.ok ? await r.json() : []
    await nextTick(); renderPerformanceChart()
  } catch (e) { console.warn('fetchHistory error:', e); gameHistory.value = [] }
}

const fetchFriends = async () => {
  try {
    const u = encodeURIComponent(viewedUsername.value)
    let r = await fetch(`${API_BASE}/friends/${u}/full`)
    if (!r.ok) {
      r = await fetch(`${API_BASE}/friends/${u}`)
      if (!r.ok) throw new Error('friends fetch failed')
      const rows: Array<{ friend: string; avatar?: string | null }> = await r.json()
      friends.value = rows.map((x, i) => ({ id: String(i + 1), username: x.friend, avatar: x.avatar ?? null, status: 'offline' }))
      return
    }
    const rows: Array<{ username: string; avatar: string | null; status?: string }> = await r.json()
    friends.value = rows.map((x, i) => ({ id: String(i + 1), username: x.username, avatar: x.avatar, status: (x.status as Friend['status']) || 'offline' }))
  } catch (e) { console.warn('fetchFriends error:', e); friends.value = [] }
}

const onFriendAvatarError = (e: Event) => { (e.target as HTMLImageElement).style.display = 'none' }
const messageFriend = (friend: Friend) => { openChatWithUser(friend.username) }
const challengeFriend = (friend: Friend) => {
  if (!isSelf.value) return;
  const me = selfUsername.value;
  const to = friend.username;
  console.log('🎯 Envoi d’un défi à', to);
  statsSocket.emit('identify', me);
  statsSocket.emit('challengePlayer', { from: me, to, options: { maxPoints: 10, durationMinutes: null } });
};

const viewFriend = (friend: Friend) => { router.push(`/profile/${encodeURIComponent(friend.username)}`) }
const removeFriend = async (friend: Friend) => {
  if (!isSelf.value) return
  if (!confirm(`Supprimer ${friend.username} de vos amis ?`)) return
  try {
    const res = await fetch(`${API_BASE}/friends/remove`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: selfUsername.value, to: friend.username })
    })
    if (!res.ok) { const txt = await res.text().catch(() => ''); throw new Error(txt || 'Erreur suppression ami') }
    friends.value = friends.value.filter(f => f.username !== friend.username)
  } catch (e: any) { alert(e.message || 'Suppression impossible') }
}

/** ====== Settings & Password ====== **/
const toggleEdit = (field: 'username' | 'email' | 'password') => { editMode.value[field] = !editMode.value[field] }

async function updatePasswordIfNeeded(oldUsernameForPath: string) {
  if (!editMode.value.password) return
  const cur = passwordForm.value.current.trim()
  const n1  = passwordForm.value.new1.trim()
  const n2  = passwordForm.value.new2.trim()
  if (!cur || !n1 || !n2) throw new Error('Complète tous les champs mot de passe')
  if (n1.length < 6) throw new Error('Le nouveau mot de passe doit faire au moins 6 caractères')
  if (n1 !== n2) throw new Error('La confirmation ne correspond pas')
  const r = await fetch(`${API_BASE}/user/${encodeURIComponent(oldUsernameForPath)}/password`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword: cur, newPassword: n1 })
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j?.error || j?.message || 'Échec de la mise à jour du mot de passe')
  passwordForm.value.current = ''; passwordForm.value.new1 = ''; passwordForm.value.new2 = ''; editMode.value.password = false
}

const saveSettings = async () => {
  if (!isSelf.value) return
  if (event && event.target && event.target.closest('.no-save')) {
    return
  }
  try {
    const oldUsername = user.value.username
    await updatePasswordIfNeeded(oldUsername)
    const payload: Record<string, any> = {}
    if (settings.value.username && settings.value.username !== user.value.username) payload.username = settings.value.username.trim()
    if (settings.value.email && settings.value.email !== user.value.email) payload.email = settings.value.email.trim()
    payload.is_private = settings.value.privateProfile ? 1 : 0
    localStorage.setItem('pref_language', settings.value.language)
    localStorage.setItem('pref_private', String(settings.value.privateProfile))
    if (Object.keys(payload).length > 0) {
      const r = await fetch(`${API_BASE}/user/${encodeURIComponent(oldUsername)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.error || j?.message || 'Échec de la mise à jour du profil')
      if (payload.username) { user.value.username = payload.username; selfUsername.value = payload.username; localStorage.setItem('username', payload.username) }
      if (payload.email) user.value.email = payload.email
    }
    editMode.value.username = false; editMode.value.email = false
    alert('Paramètres enregistrés ✔')
  } catch (e: any) { alert(e?.message || 'Impossible d’enregistrer les paramètres') }
}

const resetSettings = () => {
  settings.value = {
    username: user.value.username,
    email: user.value.email,
    language: localStorage.getItem('pref_language') || 'fr',
    privateProfile: localStorage.getItem('pref_private') === 'true'
  }
  passwordForm.value.current = ''; passwordForm.value.new1 = ''; passwordForm.value.new2 = ''
  editMode.value.password = false
}

/** ====== Déconnexion ====== **/
const handleLogout = async () => {
  try { await fetch(`${API_BASE}/logout`, { method: 'POST' }) } catch {}
  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch {}
  window.dispatchEvent(new Event('auth-changed'))
  authLogout()
  router.replace('/login')
}

/** ====== Avatar / Bannière ====== **/
const avatarInput = ref<HTMLInputElement | null>(null)
const isUploadingAvatar = ref(false)
const triggerAvatarPicker = () => avatarInput.value?.click()
const onAvatarError = (e: Event) => { (e.target as HTMLImageElement).style.display = 'none' }

const bannerInput = ref<HTMLInputElement | null>(null)
const isUploadingBanner = ref(false)
const bannerStyle = computed(() => ({
  background: user.value.banner ? `url("${user.value.banner}") center/cover no-repeat` : `var(--gradient-primary)`
}))
const triggerBannerPicker = () => bannerInput.value?.click()

const uploadBanner = async (evt: Event) => {
  if (!isSelf.value) { (evt.target as HTMLInputElement).value=''; return }
  const input = evt.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const MAX_MB = 5
  const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
  if (!ALLOWED.includes(file.type)) { alert('Formats autorisés: PNG, JPEG, WEBP, GIF'); input.value = ''; return }
  if (file.size > MAX_MB * 1024 * 1024) { alert(`Fichier trop lourd (max ${MAX_MB} Mo)`); input.value = ''; return }
  try {
    isUploadingBanner.value = true
    const form = new FormData(); form.append('file', file)
    const res = await fetch(`${API_BASE}/user/${encodeURIComponent(user.value.username)}/banner`, { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.bannerUrl) throw new Error(data?.error || 'Upload bannière échoué')
    user.value.banner = data.bannerUrl
  } catch (err: any) { alert(`Erreur upload bannière: ${err.message || err}`) }
  finally { isUploadingBanner.value = false; input.value = '' }
}

const uploadAvatar = async (evt: Event) => {
  if (!isSelf.value) { (evt.target as HTMLInputElement).value=''; return }
  const input = evt.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const MAX_MB = 5
  const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
  if (!ALLOWED.includes(file.type)) { alert('Formats autorisés: PNG, JPEG, WEBP, GIF'); input.value = ''; return }
  if (file.size > MAX_MB * 1024 * 1024) { alert(`Fichier trop lourd (max ${MAX_MB} Mo)`); input.value = ''; return }
  try {
    isUploadingAvatar.value = true
    const form = new FormData(); form.append('file', file)
    const res = await fetch(`${API_BASE}/user/${encodeURIComponent(user.value.username)}/avatar`, { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.avatarUrl) throw new Error(data?.error || 'Upload avatar échoué')
    user.value.avatar = data.avatarUrl || null
  } catch (err: any) { alert(`Erreur upload avatar: ${err.message || err}`) }
  finally { isUploadingAvatar.value = false; input.value = '' }
}

/** ====== Mini chart perfs ====== **/
const performanceChart = ref<HTMLCanvasElement | null>(null)
const renderPerformanceChart = () => {
  const canvas = performanceChart.value; if (!canvas) return
  const ctx = canvas.getContext('2d'); if (!ctx) return
  const W = canvas.width = canvas.clientWidth || 480
  const H = canvas.height = 200
  const data = gameHistory.value.slice(-20).reverse()
  const yVals: number[] = []; let cum = 0
  for (const g of data) { cum += g.result === 'win' ? 1 : -1; yVals.push(cum) }
  ctx.clearRect(0,0,W,H)
  if (yVals.length === 0) { ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillText('Aucune donnée', 10, 20); return }
  const yMax = Math.max(...yVals) || 1
  const pad = 20
  const stepX = (W - pad*2) / Math.max(1, yVals.length - 1)
  ctx.globalAlpha = 0.15; ctx.beginPath()
  for (let i = 0; i <= 4; i++) { const y = pad + (H - pad*2) * (i / 4); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y) }
  ctx.strokeStyle = '#000'; ctx.stroke(); ctx.globalAlpha = 1
  ctx.beginPath()
  yVals.forEach((v, i) => {
    const x = pad + i * stepX
    const y = H - pad - (v / yMax) * (H - pad*2)
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  })
  ctx.lineWidth = 2; ctx.strokeStyle = '#4facfe'; ctx.stroke()
  ctx.fillStyle = '#4facfe'
  yVals.forEach((v, i) => { const x = pad + i * stepX; const y = H - pad - (v / yMax) * (H - pad*2); ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI*2); ctx.fill() })
}

const refetchProfileData = async () => { await Promise.allSettled([fetchStats(), fetchHistory()]) }

/** ====== Lifecycle ====== **/
let handledStart = false
onMounted(async () => {
  const me = localStorage.getItem('username') || 'anon';
  statsSocket.emit('identify', me);

  const handleChallengeStart = ({ roomId }: { roomId: string }) => {
    if (!roomId) return
    if (handledStart) return
    handledStart = true
    console.log('🎮 challengeStart (ProfileView):', roomId);
    window.dispatchEvent(new CustomEvent('challengeStart', { detail: { roomId } }));
    try { localStorage.setItem('pendingRoomId', roomId) } catch {}
    if (router.currentRoute.value.path !== '/game') {
      router.push('/game').finally(() => setTimeout(() => { handledStart = false }, 2000))
    } else {
      setTimeout(() => { handledStart = false }, 2000)
    }
  };
  applyTabFromRouteOrMemory()

  statsSocket.on('challengeStart', handleChallengeStart);
  statsSocket.on('playerStatsUpdated', (p: { username: string }) => {
    if (!p || (p.username !== viewedUsername.value)) return;
    Promise.allSettled([fetchStats(), fetchHistory()]);
  });

  await fetchUser();
  await Promise.allSettled([fetchStats(), fetchHistory(), fetchFriends()]);
  await nextTick(); renderPerformanceChart()
})

watch(() => route.query.tab, () => {
  applyTabFromRouteOrMemory()
})
watch(() => route.params.username, async () => {
  await fetchUser()
  await Promise.allSettled([fetchStats(), fetchHistory(), fetchFriends()])
})
watch(activeTab, async (tab) => {
  if (tab === 'friends') await fetchFriends()
  if (tab === 'history') await fetchHistory()
  if (tab === 'stats') await fetchStats()
})

onBeforeUnmount(() => {
  window.removeEventListener('playerStatsUpdated', refetchProfileData)
  statsSocket.off('challengeStart'); 
})
onUnmounted(() => { statsSocket.disconnect() })

/** ====== Expose (si besoin) ====== **/
const editAvatar = () => triggerAvatarPicker()
</script>


<style scoped>
.username { font-size: 2rem; font-weight: 700; color: var(--color-text); margin-top: 25px; line-height: 1.2; position: relative; display: inline-block; transition: color .3s }
.username::after { content: ""; display: block; width: 0; height: 3px; background: var(--gradient-primary); transition: width .3s; position: absolute; bottom: -4px; left: 0; border-radius: 2px }
.username:hover { color: var(--color-primary) }
.username:hover::after { width: 100% }
@media (max-width: 768px){ .username{ font-size:1.5rem } }

.profile-page { max-width: 1000px; margin: 0 auto; padding: 2rem }
.profile-header { background: var(--color-background-soft); border-radius: 20px; overflow: hidden; margin-bottom: 2rem; box-shadow: var(--shadow-lg) }
.profile-banner { height: 200px; position: relative; display: flex; align-items: center; justify-content: center }
.banner-gradient { position: absolute; inset: 0; background: linear-gradient(45deg, rgba(255,255,255,.1) 0%, rgba(255,255,255,.05) 50%, rgba(0,0,0,.1) 100%) }
.edit-banner-btn { position: absolute; top: 1rem; right: 1rem; display: flex; align-items: center; gap: .5rem; background: rgba(0,0,0,.3); color: #fff; border: 0; padding: .5rem 1rem; border-radius: 8px; cursor: pointer; transition: .3s }
.edit-banner-btn:hover { background: rgba(0,0,0,.5) }

.profile-info { padding: 2rem; display: flex; justify-content: space-between; align-items: flex-start; margin-top: -50px }
.avatar-section { display: flex; gap: 1.5rem; align-items: flex-end }
.avatar-container { position: relative }
.user-avatar { width: 100px; height: 100px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; color: #fff; border: 4px solid var(--color-background); box-shadow: var(--shadow-md); overflow: hidden }
.avatar-img { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: 50% }
.avatar-initials { font-weight: 700; font-size: 2rem; line-height: 1 }
.avatar-edit { position: absolute; bottom: 0; right: 0; width: 2rem; height: 2rem; border-radius: 50%; background: var(--color-primary); color: #fff; border: 2px solid var(--color-background); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: .8rem }

.user-details h1 { font-size: 2rem; font-weight: 700; color: var(--color-text); margin-bottom: .5rem }
.user-status { display: flex; align-items: center; gap: .5rem; font-weight: 500; margin-bottom: .5rem }
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor }
.status-online { color: #4CAF50 } .status-offline { color: #9E9E9E } .status-playing { color: #FF9800 }
.join-date { color: var(--color-text); opacity: .7; font-size: .9rem }
.profile-actions { display: flex; gap: 1rem }

.profile-tabs { display: flex; background: var(--color-background-soft); border-radius: 15px; padding: .5rem; margin-bottom: 2rem; gap: .5rem }
.tab-btn { display: flex; align-items: center; gap: .5rem; background: none; border: none; padding: .75rem 1.5rem; border-radius: 10px; cursor: pointer; color: var(--color-text); opacity: .7; transition: .3s; font-weight: 500; flex: 1; justify-content: center }
.tab-btn:hover { opacity: 1 }
.tab-btn.active { background: var(--gradient-primary); color: #fff; opacity: 1 }
.tab-count { background: rgba(255,255,255,.3); color: #fff; font-size: .75rem; font-weight: 600; padding: .25rem .5rem; border-radius: 12px; min-width: 1.5rem; text-align: center }

.profile-content { background: var(--color-background-soft); border-radius: 20px; padding: 2rem; box-shadow: var(--shadow-md) }
.tab-content { animation: fadeIn .3s ease }
@keyframes fadeIn { from{ opacity:0; transform: translateY(10px) } to{ opacity:1; transform: translateY(0) } }

.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2rem }
.stat-card { background: var(--color-background); border: 2px solid var(--color-border); border-radius: 15px; padding: 1.5rem; display: flex; align-items: center; gap: 1rem; transition: .3s }
.stat-card:hover { transform: translateY(-5px); box-shadow: var(--shadow-lg) }
.stat-icon { font-size: 2.5rem }
.stat-number { font-size: 2rem; font-weight: 700; color: var(--color-primary); margin-bottom: .25rem }
.stat-label { color: var(--color-text); opacity: .8; margin: 0; font-size: .9rem }

.game-history { display: flex; flex-direction: column; gap: 1rem }
.history-item { background: var(--color-background); border: 2px solid var(--color-border); border-radius: 15px; padding: 1.5rem; display: flex; align-items: center; gap: 1.5rem }
.game-result { display: flex; align-items: center; gap: .5rem; font-weight: 600; min-width: 120px }
.game-result.win { color: #4CAF50 } .game-result.loss { color: #f44336 }
.game-details { flex: 1 }
.opponent { font-size: 1.1rem; font-weight: 600; margin-bottom: .25rem }
.game-score { color: var(--color-text); opacity: .8; margin-bottom: .25rem }
.game-date { font-size: .8rem; color: var(--color-text); opacity: .6; margin: 0 }

.friends-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem }
.section-title { font-size: 1.5rem; font-weight: 700; color: var(--color-text) }
.friends-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem }
.friend-card { background: var(--color-background); border: 2px solid var(--color-border); border-radius: 15px; padding: 1.5rem; display: flex; align-items: center; gap: 1rem; transition: .2s; cursor: pointer }
.friend-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md) }
.friend-avatar { width: 3rem; height: 3rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: #fff; overflow: hidden }
.friend-avatar-img { width: 100%; height: 100%; object-fit: cover; display: block }
.friend-initials { font-weight: 700; font-size: 1.1rem; line-height: 1; color: #fff }
.friend-info { flex: 1 }
.friend-name { font-weight: 600; margin-bottom: .25rem }
.friend-actions { display: flex; gap: .5rem }
.btn-icon-only { width: 2.5rem; height: 2.5rem; border: none; border-radius: 8px; background: var(--color-background-soft); color: var(--color-text); cursor: pointer; transition: .2s; font-size: 1rem }
.btn-icon-only:hover { background: var(--color-primary); color: #fff }
.btn-icon-only.danger:hover { background: #f44336 }

/* NOUVELLES CLASSES POUR LES CATÉGORIES DE PARAMÈTRES */
.settings-category { margin-bottom: 3rem; padding-bottom: 2rem; border-bottom: 1px solid var(--color-border); }
.settings-category:last-child { border-bottom: none; margin-bottom: 0; }
.category-title { font-size: 1.3rem; font-weight: 700; color: var(--color-text); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem; }
.security-section { background: var(--color-background); border: 2px solid var(--color-border); border-radius: 15px; padding: 0; overflow: hidden; }

/* Surcharge pour le composant 2FA dans le profil */
.security-section :deep(.max-w-md) { max-width: none; margin: 0; box-shadow: none; border-radius: 0; }
.settings-form { display: flex; flex-direction: column; gap: 2rem; margin-bottom: 3rem }
.setting-group { display: flex; align-items: center; gap: 1rem }
.setting-label { font-weight: 600; color: var(--color-text); min-width: 120px }
.setting-input, .setting-select { flex: 1; background: var(--color-background); border: 2px solid var(--color-border); border-radius: 10px; padding: .75rem 1rem; color: var(--color-text); font-size: 1rem }
.setting-input:focus, .setting-select:focus { outline: none; border-color: var(--color-primary) }
.setting-input:read-only { background: var(--color-background-soft); opacity: .7 }
.edit-btn { background: var(--color-primary); color: #fff; border: none; padding: .5rem; border-radius: 8px; cursor: pointer; font-size: 1rem }
.setting-checkbox { display: flex; align-items: center; gap: 1rem; cursor: pointer; font-weight: 600 }
.setting-checkbox input { display: none }
.checkbox-custom { width: 1.5rem; height: 1.5rem; border: 2px solid var(--color-border); border-radius: 4px; position: relative; transition: .3s }
.setting-checkbox input:checked + .checkbox-custom { background: var(--gradient-primary); border-color: var(--color-primary) }
.setting-checkbox input:checked + .checkbox-custom::after { content: '✓'; position: absolute; color: #fff; font-weight: bold; top: 50%; left: 50%; transform: translate(-50%,-50%); font-size: .9rem }
.settings-actions { display: flex; gap: 1rem }
.danger-zone { border-top: 1px solid var(--color-border); padding-top: 2rem }
.danger-title { color: #f44336; font-weight: 600; margin-bottom: 1rem }

.btn { display: flex; align-items: center; gap: .5rem; padding: .75rem 1.5rem; border: none; border-radius: 12px; font-weight: 600; cursor: pointer; transition: .2s }
.btn-primary { background: var(--gradient-primary); color: #fff }
.btn-secondary { background: var(--color-background); border: 2px solid var(--color-border); color: var(--color-text) }
.btn-danger { background: #f44336; color: #fff }
.btn:hover { transform: translateY(-2px); box-shadow: var(--shadow-md) }

/* ===== Modal Ajouter un ami ===== */
.fade-enter-active, .fade-leave-active { transition: opacity .2s ease }
.fade-enter-from, .fade-leave-to { opacity: 0 }
.af-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: grid; place-items: center; z-index: 1000; border-radius: 3%}
.af-modal { width: min(520px, calc(100% - 2rem)); background: var(--color-background); border: 1px solid var(--color-border); border-radius: 16px; box-shadow: var(--shadow-lg); overflow: hidden; animation: popIn .12s ease }
@keyframes popIn { from { transform: scale(.98); opacity: .9 } to { transform: scale(1); opacity: 1 } }
.af-header { display:flex; align-items:center; justify-content:space-between; padding: 1rem 1.2rem; background: var(--color-background-soft); border-bottom: 1px solid var(--color-border) }
.af-header h3 { margin:0; font-size:1.1rem; font-weight:700; color:var(--color-text) }
.af-close { border:0; background:transparent; cursor:pointer; font-size:1.1rem; opacity:.7 }
.af-close:hover { opacity:1 }
.af-body { padding: 1.2rem }
.af-label { display:block; font-weight:600; margin-bottom:.5rem }
.af-input { width:100%; padding:.8rem 1rem; border-radius:10px; border:2px solid var(--color-border); background: var(--color-background); color: var(--color-text); font-size:1rem }
.af-input:focus { outline:none; border-color: var(--color-primary) }
.af-error { margin:.6rem 0 0; color:#ff4d4f; font-weight:600 }
.af-actions { display:flex; gap:.6rem; justify-content:flex-end; margin-top:1rem }
/* ===== /Modal ===== */

@media (max-width: 768px){
  .profile-page { padding: 1rem }
  .profile-info { flex-direction: column; gap: 1.5rem; text-align: center }
  .profile-actions { justify-content: center }
  .profile-tabs { flex-wrap: wrap }
  .stats-grid { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)) }
  .friends-grid { grid-template-columns: 1fr }
  .setting-group { flex-direction: column; align-items: flex-start; gap: .5rem }
  .setting-label { min-width: auto }
}
</style>