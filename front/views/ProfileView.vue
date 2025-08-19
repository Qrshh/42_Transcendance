<template>
  <div class="profile-page">
    <!-- Header du profil -->
    <div class="profile-header">
      <div class="profile-banner" :style="bannerStyle">
        <div class="banner-gradient"></div>
        <button class="edit-banner-btn" @click="triggerBannerPicker" :disabled="isUploadingBanner">
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

            <button class="avatar-edit" @click="triggerAvatarPicker" :disabled="isUploadingAvatar" title="Changer l’avatar">
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
            <h1 class="username">{{ user.username }}</h1>
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
        </div>
      </div>
    </div>

    <!-- Navigation des onglets -->
    <div class="profile-tabs">
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

    <!-- Contenu des onglets -->
    <div class="profile-content">
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

        <!-- Graphiques -->
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
              <h4 class="opponent">vs {{ game.opponent }}</h4>
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
            <button class="btn btn-primary" @click="openAddFriend" :disabled="isAddingFriend">
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

              <div class="friend-actions">
                <button @click.stop="challengeFriend(friend)" class="btn-icon-only" title="Défier">🎯</button>
                <button @click.stop="messageFriend(friend)" class="btn-icon-only" title="Message">💬</button>
                <button @click.stop="removeFriend(friend)" class="btn-icon-only danger" title="Supprimer">🗑️</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Onglet Paramètres -->
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
              <button
                type="button"
                @click="toggleEdit('username')"
                class="edit-btn"
              >
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
              <button
                type="button"
                @click="toggleEdit('email')"
                class="edit-btn"
              >
                {{ editMode.email ? '✅' : '✏️' }}
              </button>
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
                <input type="checkbox" v-model="settings.notifications" />
                <span class="checkbox-custom"></span>
                <span class="checkbox-text">Recevoir les notifications</span>
              </label>
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

          <div class="danger-zone">
            <h3 class="danger-title">Zone dangereuse</h3>
            <button @click="deleteAccount" class="btn btn-danger">
              <span class="btn-icon">🗑️</span>
              <span class="btn-text">Supprimer le compte</span>
            </button>
          </div>
        </div>
      </div>
    </div>

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
              <button type="button" class="btn btn-secondary" @click="closeAddFriend" :disabled="isAddingFriend">
                Annuler
              </button>
              <button type="submit" class="btn btn-primary" :disabled="isAddingFriend || !addFriendForm.username">
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
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
const router = useRouter()

/** ====== Config API ====== **/
const API_BASE = 'http://localhost:3000'

/** ====== Types ====== **/
interface User {
  id: string
  username: string
  email: string
  avatar: string | null
  banner?: string | null
  status: 'online' | 'offline' | 'playing'
  createdAt: string
}
interface Stats { totalGames: number; gamesWon: number; ranking: number }
interface GameHistory { id: string; opponent: string; result: 'win' | 'loss'; playerScore: number; opponentScore: number; date: string; duration: string }
interface Friend { id: string; username: string; avatar?: string | null; status: 'online' | 'offline' | 'playing' }

/** ====== État ====== **/
const user = ref<User>({
  id: '1',
  username: localStorage.getItem('username') || 'Joueur',
  email: 'joueur@example.com',
  avatar: null,
  banner: null,
  status: 'online',
  createdAt: '2024-01-01'
})
const stats = ref<Stats>({ totalGames: 42, gamesWon: 28, ranking: 156 })
const gameHistory = ref<GameHistory[]>([{ id: '1', opponent: 'Alice', result: 'win', playerScore: 21, opponentScore: 18, date: '2024-01-15', duration: '5m 23s' }])
const friends = ref<Friend[]>([])

const activeTab = ref<'stats'|'history'|'friends'|'settings'>('stats')
const editMode = ref({ username: false, email: false })
const settings = ref({ username: user.value.username, email: user.value.email, language: 'fr', notifications: true, privateProfile: false })

/** ====== Modal Ajouter un ami ====== **/
const showAddFriend = ref(false)
const isAddingFriend = ref(false)
const addFriendError = ref<string | null>(null)
const addFriendForm = ref({ username: '' })
const addFriendInputRef = ref<HTMLInputElement | null>(null)

const openAddFriend = () => {
  addFriendError.value = null
  addFriendForm.value.username = ''
  showAddFriend.value = true
  requestAnimationFrame(() => addFriendInputRef.value?.focus())
}
const closeAddFriend = () => { showAddFriend.value = false }
// helpers en haut du <script setup>
// ➜ remplace intégralement ta fonction submitAddFriend par ceci
const submitAddFriend = async () => {
  const to = addFriendForm.value.username.trim()
  if (!to) return
  if (to === user.value.username) { 
    addFriendError.value = 'Tu ne peux pas t’ajouter toi-même 😅'
    return
  }

  try {
    isAddingFriend.value = true
    addFriendError.value = null

    // IMPORTANT : correspond à ton server.js
    const res = await fetch(`${API_BASE}/friends/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: user.value.username, to })
    })

    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      addFriendError.value = payload?.error || `Erreur HTTP ${res.status}`
      return
    }

    // succès : on recharge (au cas où) et on ferme la modal
    await fetchFriends()
    activeTab.value = 'friends'
    closeAddFriend()
  } catch (e: any) {
    addFriendError.value = e?.message || 'Erreur inconnue'
  } finally {
    isAddingFriend.value = false
  }
}


/** ====== Onglets / Computed ====== **/
const tabs = computed(() => [
  { id: 'stats', label: 'Statistiques', icon: '📊' },
  { id: 'history', label: 'Historique', icon: '📜', count: gameHistory.value.length },
  { id: 'friends', label: 'Amis', icon: '👥', count: friends.value.length },
  { id: 'settings', label: 'Paramètres', icon: '⚙️' }
])
const winRate = computed(() => stats.value.totalGames === 0 ? 0 : Math.round((stats.value.gamesWon / stats.value.totalGames) * 100))

/** ====== Utils ====== **/
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
const getStatusClass = (status: string) => ({ 'status-online': status === 'online', 'status-offline': status === 'offline', 'status-playing': status === 'playing' })
const getStatusText = (status: string) => ({ online: 'En ligne', offline: 'Hors ligne', playing: 'En jeu' } as any)[status] || 'Inconnu'
const formatDate = (date: string) => new Date(date).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })

/** ====== Actions ====== **/
watch(activeTab, (tab) => { if (tab === 'friends') fetchFriends() })

const shareProfile = () => {
  navigator.share?.({ title: `Profil de ${user.value.username}`, text: `Découvre le profil de ${user.value.username} sur MasterPong !`, url: window.location.href })
}
const fetchFriends = async () => {
  try {
    const u = encodeURIComponent(user.value.username)
    let r = await fetch(`${API_BASE}/friends/${u}/full`)
    if (!r.ok) {
      r = await fetch(`${API_BASE}/friends/${u}`)
      if (!r.ok) throw new Error('friends fetch failed')
      const rows: Array<{ friend: string; avatar?: string | null }> = await r.json()
      friends.value = rows.map((x, i) => ({ id: String(i + 1), username: x.friend, avatar: x.avatar ?? null, status: 'offline' }))
      return
    }
    const rows: Array<{ username: string; avatar: string | null }> = await r.json()
    friends.value = rows.map((x, i) => ({ id: String(i + 1), username: x.username, avatar: x.avatar, status: 'offline' }))
  } catch (e) {
    console.warn('fetchFriends error:', e)
    friends.value = []
  }
}
const onFriendAvatarError = (e: Event) => { (e.target as HTMLImageElement).style.display = 'none' }
const messageFriend = (friend: Friend) => { localStorage.setItem('openChatWith', friend.username); console.log('Message à', friend.username) }
const challengeFriend = (friend: Friend) => { console.log('Défier', friend.username) }
const viewFriend = (friend: Friend) => { window.location.href = `/profile/${encodeURIComponent(friend.username)}` }

const removeFriend = async (friend: Friend) => {
  if (!confirm(`Supprimer ${friend.username} de vos amis ?`)) return
  try {
    const res = await fetch(`${API_BASE}/friends/remove`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: user.value.username, to: friend.username })
    })
    if (!res.ok) {
      const txt = await res.text().catch(()=> '')
      throw new Error(txt || 'Erreur suppression ami')
    }
    friends.value = friends.value.filter(f => f.username !== friend.username)
  } catch (e: any) {
    alert(e.message || 'Suppression impossible')
  }
}

const toggleEdit = (field: string) => { (editMode.value as any)[field] = !(editMode.value as any)[field] }
const saveSettings = () => { localStorage.setItem('username', settings.value.username); user.value.username = settings.value.username }
const resetSettings = () => { settings.value = { username: user.value.username, email: user.value.email, language: 'fr', notifications: true, privateProfile: false } }

/** ====== Suppression compte ====== **/
const deleteAccount = async () => {
  if (!confirm('Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.')) return
  try {
    const res = await fetch(`${API_BASE}/user/${encodeURIComponent(user.value.username)}`, { method: 'DELETE' })
    if (!res.ok) { const txt = await res.text().catch(()=> ''); throw new Error(txt || 'Suppression impossible') }
    localStorage.clear()
    window.location.href = '/'
  } catch (e: any) {
    alert(e.message || 'Erreur lors de la suppression du compte')
  }
}

/** ====== Avatar / Bannière ====== **/
const avatarInput = ref<HTMLInputElement | null>(null)
const isUploadingAvatar = ref(false)
const triggerAvatarPicker = () => avatarInput.value?.click()
const onAvatarError = (e: Event) => { (e.target as HTMLImageElement).style.display = 'none' }

const bannerInput = ref<HTMLInputElement | null>(null)
const isUploadingBanner = ref(false)
const bannerStyle = computed(() => ({ background: user.value.banner ? `url("${user.value.banner}") center/cover no-repeat` : `var(--gradient-primary)` }))
const triggerBannerPicker = () => bannerInput.value?.click()

const uploadBanner = async (evt: Event) => {
  const input = evt.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const MAX_MB = 5
  const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
  if (!ALLOWED.includes(file.type)) { alert('Formats autorisés: PNG, JPEG, WEBP, GIF'); input.value = ''; return }
  if (file.size > MAX_MB * 1024 * 1024) { alert(`Fichier trop lourd (max ${MAX_MB} Mo)`); input.value = ''; return }

  try {
    isUploadingBanner.value = true
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_BASE}/user/${encodeURIComponent(user.value.username)}/banner`, { method: 'POST', body: form })
    const data = await res.json()
    if (!res.ok || !data?.success) throw new Error(data?.error || 'Upload bannière échoué')
    user.value.banner = data.bannerUrl
  } catch (err: any) {
    alert(`Erreur upload bannière: ${err.message || err}`)
  } finally { isUploadingBanner.value = false; input.value = '' }
}

const uploadAvatar = async (evt: Event) => {
  const input = evt.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const MAX_MB = 5
  const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
  if (!ALLOWED.includes(file.type)) { alert('Formats autorisés: PNG, JPEG, WEBP, GIF'); input.value = ''; return }
  if (file.size > MAX_MB * 1024 * 1024) { alert(`Fichier trop lourd (max ${MAX_MB} Mo)`); input.value = ''; return }

  try {
    isUploadingAvatar.value = true
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_BASE}/user/${encodeURIComponent(user.value.username)}/avatar`, { method: 'POST', body: form })
    const data = await res.json()
    if (!res.ok || !data?.success) throw new Error(data?.error || 'Upload échoué')
    user.value.avatar = data.avatarUrl || null
  } catch (err: any) {
    alert(`Erreur upload avatar: ${err.message || err}`)
  } finally { isUploadingAvatar.value = false; input.value = '' }
}

/** ====== Lifecycle ====== **/
onMounted(async () => {
  try {
    const res = await fetch(`${API_BASE}/user/${encodeURIComponent(user.value.username)}`)
    if (res.ok) {
      const data = await res.json()
      user.value.email = data.email ?? user.value.email
      user.value.avatar = data.avatar || null
      user.value.banner = data.banner || null
      user.value.createdAt = data.created_at || user.value.createdAt
    }
  } catch (e) {
    console.warn('Impossible de charger le profil:', e)
  }
  fetchFriends()
})

/** ====== Expose ====== **/
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
