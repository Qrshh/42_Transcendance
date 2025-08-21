<template>
  <div class="profile-page">
    <!-- Header du profil -->
    <div class="profile-header">
      <div class="profile-banner">
        <div class="banner-gradient"></div>
        <button class="edit-banner-btn" @click="editBanner">
          <span class="edit-icon">📸</span>
          <span class="edit-text">Changer la bannière</span>
        </button>
      </div>
      
      <div class="profile-info">
        <div class="avatar-section">
          <div class="avatar-container">
            <div class="user-avatar" :style="{ background: getUserColor(user.username) }">
              {{ user.avatar || getDefaultAvatar(user.username) }}
            </div>
            <button class="avatar-edit" @click="editAvatar">✏️</button>
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
			    <button @click="logout" class="btn btn-secondary">
				    <span class="btn-icon">🚪</span>
				    <span class="btn-text">Déconnexion</span>
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
            <button @click="addFriend" class="btn btn-primary">
              <span class="btn-icon">➕</span>
              <span class="btn-text">Ajouter un ami</span>
            </button>
          </div>
          
          <div class="friends-grid">
            <div v-for="friend in friends" :key="friend.id" class="friend-card">
              <div class="friend-avatar" :style="{ background: getUserColor(friend.username) }">
                {{ friend.avatar || getDefaultAvatar(friend.username) }}
              </div>
              
              <div class="friend-info">
                <h4 class="friend-name">{{ friend.username }}</h4>
                <p class="friend-status" :class="getStatusClass(friend.status)">
                  <span class="status-dot"></span>
                  {{ getStatusText(friend.status) }}
                </p>
              </div>
              
              <div class="friend-actions">
                <button @click="challengeFriend(friend)" class="btn-icon-only" title="Défier">🎯</button>
                <button @click="messageFriend(friend)" class="btn-icon-only" title="Message">💬</button>
                <button @click="removeFriend(friend)" class="btn-icon-only danger" title="Supprimer">🗑️</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Onglet Paramètres MODIFIÉ AVEC 2FA -->
      <div v-if="activeTab === 'settings'" class="tab-content">
        <div class="settings-section">
          <!-- Section Profil -->
          <div class="settings-category">
            <h3 class="category-title">🔧 Informations du profil</h3>
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
                  <span class="checkbox-text">Notifications activées</span>
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
          </div>

          <!-- NOUVELLE SECTION 2FA -->
          <div class="settings-category">
            <h3 class="category-title">🔒 Sécurité du compte</h3>
            <div class="security-section">
              <TwoFactorAuth />
            </div>
          </div>

          <!-- Zone dangereuse -->
          <div class="settings-category danger-zone">
            <h3 class="danger-title">🗑️ Zone dangereuse</h3>
            <button @click="deleteAccount" class="btn btn-danger">
              <span class="btn-icon">🗑️</span>
              <span class="btn-text">Supprimer le compte</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { logout as authLogout } from '../stores/auth' // adapte le chemin si besoin
// NOUVEAU IMPORT POUR LA 2FA
import TwoFactorAuth from '@/components/TwoFactorAuth.vue'

interface User {
  id: string
  username: string
  email: string
  avatar?: string
  status: 'online' | 'offline' | 'playing'
  createdAt: string
}

interface Stats {
  totalGames: number
  gamesWon: number
  ranking: number
}

interface GameHistory {
  id: string
  opponent: string
  result: 'win' | 'loss'
  playerScore: number
  opponentScore: number
  date: string
  duration: string
}

interface Friend {
  id: string
  username: string
  avatar?: string
  status: 'online' | 'offline' | 'playing'
}

// État réactif
const user = ref<User>({
  id: '1',
  username: localStorage.getItem('username') || 'Joueur',
  email: 'joueur@example.com',
  status: 'online',
  createdAt: '2024-01-01'
})

const stats = ref<Stats>({
  totalGames: 0,
  gamesWon: 0,
  ranking: 0
})

const gameHistory = ref<GameHistory[]>([
  {
    id: '1',
    opponent: 'Alice',
    result: 'win',
    playerScore: 21,
    opponentScore: 18,
    date: '2024-01-15',
    duration: '5m 23s'
  },
  // Plus d'historique...
])

const friends = ref<Friend[]>([
  {
    id: '1',
    username: 'Alice',
    status: 'online'
  },
  // Plus d'amis...
])

const activeTab = ref('stats')
const editMode = ref({
  username: false,
  email: false
})

const settings = ref({
  username: user.value.username,
  email: user.value.email,
  language: 'fr',
  notifications: true,
  privateProfile: false
})

// Onglets
const tabs = computed(() => [
  { id: 'stats', label: 'Statistiques', icon: '📊' },
  { id: 'history', label: 'Historique', icon: '📜', count: gameHistory.value.length },
  { id: 'friends', label: 'Amis', icon: '👥', count: friends.value.length },
  { id: 'settings', label: 'Paramètres', icon: '⚙️' }
])

// Computed
const winRate = computed(() => {
  if (stats.value.totalGames === 0) return 0
  return Math.round((stats.value.gamesWon / stats.value.totalGames) * 100)
})

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

const getStatusClass = (status: string) => {
  return {
    'status-online': status === 'online',
    'status-offline': status === 'offline',
    'status-playing': status === 'playing'
  }
}

const getStatusText = (status: string) => {
  const statusMap = {
    'online': 'En ligne',
    'offline': 'Hors ligne',
    'playing': 'En jeu'
  }
  return statusMap[status as keyof typeof statusMap] || 'Inconnu'
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// Actions
const editProfile = () => {
  console.log('Édition du profil')
}

const editAvatar = () => {
  console.log('Changement d\'avatar')
}

const editBanner = () => {
  console.log('Changement de bannière')
}

const shareProfile = () => {
  navigator.share?.({
    title: `Profil de ${user.value.username}`,
    text: `Découvre le profil de ${user.value.username} sur MasterPong !`,
    url: window.location.href
  })
}

const addFriend = () => {
  console.log('Ajout d\'ami')
}

const challengeFriend = (friend: Friend) => {
  console.log('Défier', friend.username)
}

const messageFriend = (friend: Friend) => {
  console.log('Message à', friend.username)
}

const removeFriend = (friend: Friend) => {
  console.log('Supprimer ami', friend.username)
}

const toggleEdit = (field: string) => {
  editMode.value[field as keyof typeof editMode.value] = !editMode.value[field as keyof typeof editMode.value]
}

const saveSettings = () => {
  localStorage.setItem('username', settings.value.username)
  user.value.username = settings.value.username
  console.log('Paramètres sauvegardés')
}

const resetSettings = () => {
  settings.value = {
    username: user.value.username,
    email: user.value.email,
    language: 'fr',
    notifications: true,
    privateProfile: false
  }
}

const logout = () => {
  authLogout()
  window.location.href = '/login' // adapte la route si besoin
}

const deleteAccount = () => {
  if (confirm('Êtes-vous sûr de vouloir supprimer votre compte ?')) {
    localStorage.clear()
    window.location.href = '/'
  }
}

onMounted(() => {
  // Charger les données du profil
  console.log('Profil chargé')
})
</script>

<style scoped>
.profile-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
}

/* Header du profil */
.profile-header {
  background: var(--color-background-soft);
  border-radius: 20px;
  overflow: hidden;
  margin-bottom: 2rem;
  box-shadow: var(--shadow-lg);
}

.profile-banner {
  height: 200px;
  background: var(--gradient-primary);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.banner-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(45deg, 
    rgba(255,255,255,0.1) 0%, 
    rgba(255,255,255,0.05) 50%, 
    rgba(0,0,0,0.1) 100%);
}

.edit-banner-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(0,0,0,0.3);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.edit-banner-btn:hover {
  background: rgba(0,0,0,0.5);
}

.profile-info {
  padding: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-top: -50px;
}

.avatar-section {
  display: flex;
  gap: 1.5rem;
  align-items: flex-end;
}

.avatar-container {
  position: relative;
}

.user-avatar {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  color: white;
  border: 4px solid var(--color-background);
  box-shadow: var(--shadow-md);
}

.avatar-edit {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--color-primary);
  color: white;
  border: 2px solid var(--color-background);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
}

.user-details h1 {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 0.5rem;
}

.user-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.status-online { color: #4CAF50; }
.status-offline { color: #9E9E9E; }
.status-playing { color: #FF9800; }

.join-date {
  color: var(--color-text);
  opacity: 0.7;
  font-size: 0.9rem;
}

.profile-actions {
  display: flex;
  gap: 1rem;
}

/* Onglets */
.profile-tabs {
  display: flex;
  background: var(--color-background-soft);
  border-radius: 15px;
  padding: 0.5rem;
  margin-bottom: 2rem;
  gap: 0.5rem;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 10px;
  cursor: pointer;
  color: var(--color-text);
  opacity: 0.7;
  transition: all 0.3s ease;
  font-weight: 500;
  flex: 1;
  justify-content: center;
}

.tab-btn:hover {
  opacity: 1;
}

.tab-btn.active {
  background: var(--gradient-primary);
  color: white;
  opacity: 1;
}

.tab-count {
  background: rgba(255,255,255,0.3);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  min-width: 1.5rem;
  text-align: center;
}

/* Contenu des onglets */
.profile-content {
  background: var(--color-background-soft);
  border-radius: 20px;
  padding: 2rem;
  box-shadow: var(--shadow-md);
}

.tab-content {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Statistiques */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: var(--color-background);
  border: 2px solid var(--color-border);
  border-radius: 15px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-5px);
  box-shadow: var(--shadow-lg);
}

.stat-icon {
  font-size: 2.5rem;
}

.stat-number {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: 0.25rem;
}

.stat-label {
  color: var(--color-text);
  opacity: 0.8;
  margin: 0;
  font-size: 0.9rem;
}

/* Historique */
.game-history {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.history-item {
  background: var(--color-background);
  border: 2px solid var(--color-border);
  border-radius: 15px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.game-result {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  min-width: 120px;
}

.game-result.win {
  color: #4CAF50;
}

.game-result.loss {
  color: #f44336;
}

.game-details {
  flex: 1;
}

.opponent {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.game-score {
  color: var(--color-text);
  opacity: 0.8;
  margin-bottom: 0.25rem;
}

.game-date {
  font-size: 0.8rem;
  color: var(--color-text);
  opacity: 0.6;
  margin: 0;
}

/* Amis */
.friends-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
}

.friends-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.friend-card {
  background: var(--color-background);
  border: 2px solid var(--color-border);
  border-radius: 15px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: all 0.3s ease;
}

.friend-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.friend-avatar {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: white;
}

.friend-info {
  flex: 1;
}

.friend-name {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.friend-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-icon-only {
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  border-radius: 8px;
  background: var(--color-background-soft);
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 1rem;
}

.btn-icon-only:hover {
  background: var(--color-primary);
  color: white;
}

.btn-icon-only.danger:hover {
  background: #f44336;
}

/* NOUVELLES CLASSES POUR LES CATÉGORIES DE PARAMÈTRES */
.settings-category {
  margin-bottom: 3rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--color-border);
}

.settings-category:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.category-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.security-section {
  background: var(--color-background);
  border: 2px solid var(--color-border);
  border-radius: 15px;
  padding: 0;
  overflow: hidden;
}

/* Surcharge pour le composant 2FA dans le profil */
.security-section :deep(.max-w-md) {
  max-width: none;
  margin: 0;
  box-shadow: none;
  border-radius: 0;
}

/* Paramètres */
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  margin-bottom: 3rem;
}

.setting-group {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.setting-label {
  font-weight: 600;
  color: var(--color-text);
  min-width: 120px;
}

.setting-input,
.setting-select {
  flex: 1;
  background: var(--color-background);
  border: 2px solid var(--color-border);
  border-radius: 10px;
  padding: 0.75rem 1rem;
  color: var(--color-text);
  font-size: 1rem;
}

.setting-input:focus,
.setting-select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.setting-input:read-only {
  background: var(--color-background-soft);
  opacity: 0.7;
}

.edit-btn {
  background: var(--color-primary);
  color: white;
  border: none;
  padding: 0.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
}

.setting-checkbox {
  display: flex;
  align-items: center;
  gap: 1rem;
  cursor: pointer;
  font-weight: 600;
}

.setting-checkbox input {
  display: none;
}

.checkbox-custom {
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid var(--color-border);
  border-radius: 4px;
  position: relative;
  transition: all 0.3s ease;
}

.setting-checkbox input:checked + .checkbox-custom {
  background: var(--gradient-primary);
  border-color: var(--color-primary);
}

.setting-checkbox input:checked + .checkbox-custom::after {
  content: '✓';
  position: absolute;
  color: white;
  font-weight: bold;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.9rem;
}

.settings-actions {
  display: flex;
  gap: 1rem;
}

.danger-zone {
  border-top: 1px solid var(--color-border);
  padding-top: 2rem;
}

.danger-title {
  color: #f44336;
  font-weight: 600;
  margin-bottom: 1rem;
}

/* Boutons */
.btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: var(--gradient-primary);
  color: white;
}

.btn-secondary {
  background: var(--color-background);
  border: 2px solid var(--color-border);
  color: var(--color-text);
}

.btn-danger {
  background: #f44336;
  color: white;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

/* Responsive */
@media (max-width: 768px) {
  .profile-page {
    padding: 1rem;
  }
  
  .profile-info {
    flex-direction: column;
    gap: 1.5rem;
    text-align: center;
  }
  
  .profile-actions {
    justify-content: center;
  }
  
  .profile-tabs {
    flex-wrap: wrap;
  }
  
  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }
  
  .friends-grid {
    grid-template-columns: 1fr;
  }
  
  .setting-group {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .setting-label {
    min-width: auto;
  }
}
</style>