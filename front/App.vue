<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute, RouterLink, RouterView } from 'vue-router'
import { io } from 'socket.io-client'
import { API_BASE, SOCKET_URL } from './config'
import themeMusicUrl from './music/theme.mp3'
//import Computer3D from './components/3d/Computer3D.vue'

/* ==== i18n & auth (comme ton code existant) ==== */
import { useI18n } from './composables/useI18n'
import { isLoggedIn } from './stores/auth'
const { t, onLangChange } = useI18n()
import { useGlobalToasts } from './composables/useGlobalToasts'
import { devNull } from 'os'

/* ==== Router & Socket ==== */
const router = useRouter()
const route = useRoute()
const socket = ref<ReturnType<typeof io> | null>(null)
// URL backend centralisée

/* ==== Session (réactif !) ==== */
const userName = ref((localStorage.getItem('username') || '').trim())
// Si ton store `isLoggedIn` est bien réactif, garde-le.
// Sinon, tu peux simplifier en: const logged = computed(() => !!userName.value)
const logged = computed(() => !!isLoggedIn && !!userName.value)

/* ==== Global toasts ==== */
const { toasts, removeToast, addToast } = useGlobalToasts()

/* Garder le header synchro avec localStorage (login/logout depuis n'importe où) */
function refreshAuthFromStorage() {
  userName.value = (localStorage.getItem('username') || '').trim()
}

/* ==== Lang ==== */
const selectedLang = ref(localStorage.getItem('lang') || 'en')
// function handleLangChange() {
//   onLangChange()
//   localStorage.setItem('lang', selectedLang.value)
// }

/* ==== Avatar & user menu ==== */
const showUserMenu = ref(false)
const showMobileNav = ref(false)
const avatarUrl = ref<string | null>(null)
const isConnected = ref(false)
const userGradient = computed(() => {
  const u = (userName.value || 'a').charCodeAt(0)
  const colors = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
  ]
  return colors[u % colors.length]
})
const userInitial = computed(() => (userName.value?.[0] || 'U').toUpperCase())

function toggleMenu() { showUserMenu.value = !showUserMenu.value }
function toggleMobileNav() { showMobileNav.value = !showMobileNav.value }
function closeMobileNav() { showMobileNav.value = false }
// --- Fullscreen flags (natif OU simulé .fs-root.fs-sim) ---
function isFullscreenActive() {
  const d: any = document
  return !!(
    d.fullscreenElement || d.webkitFullscreenElement ||
    document.querySelector('.fs-root.fs-sim') ||
    document.querySelector('.game-container.fs-sim')
  )
}
function onFsFlagChange() {
  document.documentElement.classList.toggle('fs-active', isFullscreenActive())
}

// --- remplace TA version de closeMenuOnOutside par celle-ci ---
function closeMenuOnOutside(e: MouseEvent) {
  // Ne ferme pas le menu / ne fait rien quand le jeu est en plein écran
  if (isFullscreenActive()) return
  const target = e.target as Element | null
  if (!target?.closest('.userbox')) showUserMenu.value = false
  if (!target?.closest('.nav-wrapper')) closeMobileNav()
}

function onAvatarKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMenu() }
  if (e.key === 'Escape') showUserMenu.value = false
}

function handleMobileNavResize() {
  if (window.innerWidth > 768) closeMobileNav()
}

/* ==== Thème clair/sombre ==== */
const theme = ref<'light' | 'dark'>(
  (localStorage.getItem('theme') as 'light'|'dark'|null) ||
  (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
)
function applyTheme(t: 'light'|'dark') {
  theme.value = t
  document.documentElement.setAttribute('data-theme', t)
  try { localStorage.setItem('theme', t) } catch {}
}
function toggleTheme(){ applyTheme(theme.value === 'dark' ? 'light' : 'dark') }

// Teinte de l’overlay 3D selon le thème
const overlayTintColor = computed(() => theme.value === 'dark' ? '#111111' : '#ffffff')

// Afficher/désactiver la 3D de fond selon la route
const showBg3D = computed(() => route.name !== 'game')

/* ==== Helpers ==== */
function truncate(text: string, max = 90) {
  const s = String(text || '')
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}
function openChatFromToast(username: string) {
  if (!username) return
  try { localStorage.setItem('social_open_chat_with', username) } catch {}
  router.push('/social').then(() => {
    // Déclenche un événement pour SocialView (au cas où elle est déjà montée)
    setTimeout(() => {
      try { window.dispatchEvent(new CustomEvent('openChat', { detail: { username } })) } catch {}
    }, 50)
  })
}

/* ==== Actions notifs ==== */
async function acceptFriendRequest(fromUser: string) {
  try {
    const me = (userName.value || localStorage.getItem('username') || '').trim()
    if (!me || !fromUser) return
    await fetch(`${API_BASE}/friends/respond`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromUser, to: me, accept: true })
    })
    addToast({ title: 'Ami ajouté', message: `${fromUser} est maintenant dans vos amis ✔`, type: 'success', icon: '✅' })
  } catch (e: any) {
    addToast({ title: 'Erreur', message: e?.message || 'Impossible d’accepter la demande', type: 'error', icon: '❌' })
  }
}
function acceptChallenge(challengeId: string) {
  if (!challengeId) return
  try { socket.value?.emit('challengeRespond', { challengeId, accept: true }) }
  catch {}
}

/* ==== Challenge start global ==== */
let handledStart = false
function handleChallengeStartGlobal({ roomId }: any = {}) {
  if (!roomId) return
  if (handledStart) return
  handledStart = true
  try { localStorage.setItem('pendingRoomId', String(roomId)) } catch {}
  try { window.dispatchEvent(new CustomEvent('challengeStart', { detail: { roomId: String(roomId) } })) } catch {}
  if (router.currentRoute.value.path !== '/game') {
    router.push('/game').finally(() => setTimeout(() => { handledStart = false }, 1500))
  } else {
    setTimeout(() => { handledStart = false }, 1500)
  }
}
async function loadAvatar(name?: string | null) {
  if (!name) { avatarUrl.value = null; return }
  try {
    const r = await fetch(`${API_BASE}/user/${encodeURIComponent(name)}`)
    const j = r.ok ? await r.json() : null
    avatarUrl.value = j?.avatar || null
  } catch { avatarUrl.value = null }
}



/* ==== Actions ==== */
async function doLogout() {
  try { await fetch(`${API_BASE}/auth/logout`, { method: 'POST' }) } catch {}
  try { localStorage.clear(); sessionStorage.clear() } catch {}
  // >>> important : synchro immédiate du header
  refreshAuthFromStorage()
  window.dispatchEvent(new Event('auth-changed'))
  router.replace('/login')
}
function goProfileSettings() {
  localStorage.setItem('profile_target_tab', 'settings')
  router.push({ path: '/profile', query: { tab: 'settings' } })
  showUserMenu.value = false
}

/* ==== Gestion de la musique ==== */
const audio = ref<HTMLAudioElement | null>(null)
const volume = ref(Number(localStorage.getItem('volume') || 0.5))
const isPlaying = ref(false)
const showVolume = ref(false)
const musicSrc = themeMusicUrl

function toggleMusic()
{
  if(!audio.value) return 
  if(isPlaying.value){
    audio.value.pause()
    isPlaying.value = false
  } else {
    audio.value.play().catch(() => {})
    isPlaying.value = true
  }
}

function toggleVolume(){
  showVolume.value = !showVolume.value
}

watch(volume, (v) => {
  if(audio.value)
    audio.value.volume = v
  localStorage.setItem('volume', String(v))
})

/* ==== Lifecycle ==== */
onMounted(async () => {
  // applique le thème sauvegardé
  applyTheme(theme.value)
  // écouter les changements d'auth globaux
  window.addEventListener('storage', refreshAuthFromStorage)
  window.addEventListener('auth-changed', refreshAuthFromStorage)
  window.addEventListener('resize', handleMobileNavResize)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshAuthFromStorage()
  })

  // socket + identify
  // Utilise le même endpoint socket que SocialView / plugin (backend)
  socket.value = io(SOCKET_URL, { withCredentials: true, transports: ['websocket'] })
  if (userName.value) socket.value.emit('identify', userName.value)

  socket.value.on('forceLogout', ({ reason }) => {
    try { localStorage.clear(); sessionStorage.clear() } catch {}
    refreshAuthFromStorage()
    window.dispatchEvent(new Event('auth-changed'))
    router.replace({ name: 'login' })
  })

  // présence socket (header dot)
  isConnected.value = !!socket.value?.connected
  socket.value.on('connect', () => { 
    isConnected.value = true 
    if (userName.value) socket.value?.emit('identify', userName.value)
  })
  socket.value.on('disconnect', () => { isConnected.value = false })

  // Notifications -> toasts globaux
  socket.value.on('newNotification', (n: any) => {
    try {
      const t = (n?.type || '').toLowerCase()
      const map = t.includes('success') ? 'success'
               : t.includes('error') ? 'error'
               : t.includes('warn') ? 'warning'
               : 'info'
      let action: { label: string; onClick?: () => void } | undefined
      if (t === 'friendrequest' && (n?.actionData?.fromUser || n?.fromUser)) {
        const fromUser = (n?.actionData?.fromUser || n?.fromUser || '').trim()
        action = { label: 'Accepter', onClick: () => acceptFriendRequest(fromUser) }
      } else if (t === 'challenge' && (n?.id || n?.actionData?.id)) {
        const chId = String(n?.id || n?.actionData?.id)
        action = { label: 'Accepter', onClick: () => acceptChallenge(chId) }
      }
      // Affiche le toast global
      // Note: la persistance et l'historique restent gérés par SocialView
      // (ici on se contente d'afficher le popup partout)
      addToast({
        title: n?.title || 'Notification',
        message: n?.message || '',
        type: map as any,
        icon: n?.icon || undefined,
        action
      })
    } catch {}
  })

  // Messages -> toast global à la réception
  socket.value.on('newMessage', (p: any) => {
    try {
      const me = (userName.value || '').trim()
      if (!me) return
      if ((p?.receiver || '').trim() !== me) return
      const sender = (p?.sender || '').trim()
      if (!sender) return
      addToast({
        title: 'Nouveau message',
        message: `${sender}: ${truncate(p?.content || '', 100)}`,
        type: 'info',
        icon: '💬',
        action: { label: 'Ouvrir', onClick: () => openChatFromToast(sender) }
      })
    } catch {}
  })

  // Challenge -> navigation globale
  socket.value.on('challengeStart', handleChallengeStartGlobal)
document.addEventListener('click', closeMenuOnOutside, { passive: true })
function isFullscreenActive() {
  const d: any = document
  return !!(
    d.fullscreenElement || d.webkitFullscreenElement ||
    document.querySelector('.fs-root.fs-sim') ||
    document.querySelector('.game-container.fs-sim')
  )
}
function onFsFlagChange() {
  document.documentElement.classList.toggle('fs-active', isFullscreenActive())
}

// écoute l'état FS pour poser le flag sur <html>
document.addEventListener('fullscreenchange', onFsFlagChange)
document.addEventListener('webkitfullscreenchange', onFsFlagChange as any)
onFsFlagChange() // init au chargement


  // Récupère l'avatar s'il existe
  await loadAvatar(userName.value)


  //musique
  if(audio.value){
    audio.value.src = musicSrc
    audio.value.volume = volume.value
    audio.value.loop = true
  }

  const startMusic = () => {
    if(isPlaying.value || !audio.value) return 
    audio.value.play().then(() => {
      isPlaying.value = true
    }).catch(err => console.warn("Impossible de lancer la musique:", err))
    window.removeEventListener('click', startMusic)
  }

  window.addEventListener('click', startMusic)
})

onBeforeUnmount(() => {
  socket.value?.off('forceLogout')
  socket.value?.off('connect')
  socket.value?.off('disconnect')
  socket.value?.off('challengeStart', handleChallengeStartGlobal)
  socket.value?.disconnect()
  document.removeEventListener('fullscreenchange', onFsFlagChange)
document.removeEventListener('webkitfullscreenchange', onFsFlagChange as any)
  document.removeEventListener('click', closeMenuOnOutside)
  window.removeEventListener('storage', refreshAuthFromStorage)
  window.removeEventListener('auth-changed', refreshAuthFromStorage)
  window.removeEventListener('resize', handleMobileNavResize)
})

/* ==== Réagir au changement d’utilisateur ==== */
watch(userName, (n, o) => {
  if (n !== o) {
    if (n && socket.value) socket.value.emit('identify', n)
    loadAvatar(n)
    showUserMenu.value = false
  }
})

watch(() => route.fullPath, () => {
  closeMobileNav()
})
</script>


<template>
  <!-- Fond 3D global, derrière toute l'UI -->
     <!-- Fond 3D global, derrière toute l'UI -->
<div class="bg3d" v-if="showBg3D">
    <!-- <Computer3D
    :model-path="'/models/scene.gltf'"
    :rotation-x="0" 
    :rotation-y="0"  
    :rotation-z="1.578"
    as-background
    :cover="true"
    :screen-coverage="1.2"
    :min-distance-factor="0.9"
    :max-fps="24"
    tint-overlay
    :tint-color="overlayTintColor"
    :tint-opacity="0.9"
    tint-blend="burn"
    fisheye
    :fisheye-strength="0.05"
    :light-orbit-speed="0.3"
  />-->
</div>

  <div class="game-background">
    <div class="floating-shapes">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
      <div class="shape shape-3"></div>
      <div class="shape shape-4"></div>
    </div>
  </div>


  <header class="panel">
    <div class="header-content">
      <!-- Logo -->
      <div class="logo">
        <h1 class="logo-text">PataPong</h1>
      </div>

      <!-- Nav -->
      <nav
          :class="['nav-modern', { 'is-mobile-open': showMobileNav }]"
          id="primary-nav"
        >
          <RouterLink to="/" class="username" @click="closeMobileNav">{{ t.home }}</RouterLink>
          <RouterLink
            v-if="logged"
            to="/profile"
            class="username"
            @click="closeMobileNav"
          >{{ t.profile }}</RouterLink>
          <RouterLink v-else to="/login" class="username" @click="closeMobileNav">{{ t.loginRegister }}</RouterLink>
          <RouterLink v-if="logged" to="/social" class="username" @click="closeMobileNav">{{ t.messages }}</RouterLink>
          <RouterLink to="/game" class="username" @click="closeMobileNav">{{ t.play }}</RouterLink>
        </nav>
      <!-- Droite : langue + avatar -->
      <div class="header-right">
        <button class="theme-toggle" @click="toggleTheme" :title="theme === 'dark' ? 'Mode clair' : 'Mode sombre'">
          <span v-if="theme === 'dark'">☀️</span>
          <span v-else>🌙</span>
        </button>
        <select v-model="selectedLang" @change="onLangChange" class="lang-selector" aria-label="Language">
          <option value="en">🇬🇧 EN</option>
          <option value="fr">🇫🇷 FR</option>
          <option value="es">🇪🇸 ES</option>
        </select>

        

        <div class="music-controls">
          <!-- bouton play/pause -->
          <button @click="toggleMusic" class="music-btn theme-toggle">
            {{ isPlaying ? '⏸️' : '▶️' }}
          </button>

          <!-- bouton volume -->
          <button @click="toggleVolume" class="music-btn theme-toggle">🔊</button>

          <!-- slider qui pop seulement si showVolume -->
          <transition name="fade">
            <input
              v-if="showVolume"
              type="range"
              min="0"
              max="1"
              step="0.01"
              v-model.number="volume"
              class="music-slider"
            />
          </transition>
        </div>

        <audio ref="audio" :src="musicSrc" preload="auto"></audio>
        
        <!-- Avatar + menu -->
        <div class="userbox" v-if="logged">
          <button
            class="avatar"
            :style="{ background: userGradient }"
            @click.stop="toggleMenu"
            @keydown="onAvatarKeydown"
            :aria-expanded="showUserMenu"
            aria-haspopup="menu"
            type="button"
            title="Compte"
          >
            <img v-if="avatarUrl" :src="avatarUrl" alt="" @error="avatarUrl = null" />
            <span v-else>{{ userInitial }}</span>
            <span class="presence" :class="{ online: isConnected, offline: !isConnected }"></span>
          </button>

          <div v-if="showUserMenu" class="user-menu panel" role="menu">
            <div class="user-menu-header">
              <div class="avatar-sm" :style="{ background: userGradient }">
                <img v-if="avatarUrl" :src="avatarUrl" alt="" @error="avatarUrl = null" />
                <span v-else>{{ userInitial }}</span>
                <span class="presence presence-sm" :class="{ online: isConnected, offline: !isConnected }"></span>
              </div>
              <div class="user-meta">
                <div class="user-name">{{ userName }}</div>
                <div class="user-status">{{ isConnected ? 'Connecté' : 'Déconnecté' }}</div>
              </div>
            </div>

            <button class="menu-item" role="menuitem" @click="goProfileSettings">⚙️ Paramètres</button>
            <div class="menu-sep"></div>
            <button class="menu-item danger" role="menuitem" @click="doLogout">🚪 Déconnexion</button>
          </div>
        </div>
        <div class="nav-wrapper">
        <button
          class="nav-toggle"
          type="button"
          @click="toggleMobileNav"
          :aria-expanded="showMobileNav"
          aria-controls="primary-nav"
        >
          <span class="nav-toggle-line" :class="{ open: showMobileNav }"></span>
        </button>
        
      </div>

      </div>
    </div>
  </header>

  <main class="main-content">
    <RouterView />
  </main>

  <!-- Global toasts (disponible partout) -->
  <Teleport to="body">
    <div class="gtoast-container" aria-live="polite" aria-atomic="true">
      <transition-group name="gtoast" tag="div">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="gtoast panel"
          :class="t.type"
          role="status"
        >
          <div class="icon">{{ t.icon }}</div>
          <div class="content">
            <div v-if="t.title" class="title">{{ t.title }}</div>
            <div class="message">{{ t.message }}</div>
          </div>
          <button v-if="t.action" class="action" @click="t.action.onClick?.(); removeToast(t.id)" :aria-label="t.action.label">{{ t.action.label }}</button>
          <button class="close" @click="removeToast(t.id)" aria-label="Fermer">✕</button>
        </div>
      </transition-group>
    </div>
  </Teleport>
</template>

<style scoped>


.username { color: var(--color-text);
  line-height: 1.2;
  position: relative;
  display: inline-block;
  transition: color .3s;
  font-weight: 600; }
.username::after { content: ""; display: block; width: 0; height: 3px; background: var(--gradient-primary); transition: width .3s; position: absolute; bottom: -4px; left: 0; border-radius: 2px }
.username:hover { color: var(--color-primary) ; opacity: 0.5;}
.username:hover::after { width: 100%; transform: translateX(0%); }
@media (max-width: 768px){ .username{  } }
/* le fond 3D ne capte jamais d'événements */
.bg3d, .bg3d * { pointer-events: none !important;}

/* ===== Header (look & feel ProfileView) ===== */
.header-modern{
  position: sticky;
  top: 0;
  z-index: 1000;
  box-shadow: 0 60px 20px rgba(255, 255, 255, 0) inset, 0 16px 14px rgb(74, 74, 74);
  backdrop-filter: blur(4px) saturate(20%);
  -webkit-backdrop-filter: blur(4px) saturate(20%);
  background: linear-gradient(transparent, #504f4fde);
  padding: .9rem 11.25rem;
  border-radius: 25px;
  border: 0px ;
}
.header-content{
  max-width: 1100px;
  margin: 0 auto;
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 1rem;
}

/* Logo */
.logo-text{
  margin: 0;
  font-size: 1.4rem;
  font-weight: 900;
  letter-spacing: .2px;
  background: white;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Nav */
.nav-wrapper{
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-toggle{
  display: none;
  width: 44px;
  height: 44px;
  border-radius: 11px;
  border: 1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.08);
  color: #fff;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background .2s ease, border-color .2s ease, transform .2s ease;
}
.nav-toggle:hover{ background: rgba(255,255,255,.14); transform: translateY(-1px); }
.nav-toggle-line{
  position: relative;
  width: 22px;
  height: 2px;
  background: currentColor;
  border-radius: 999px;
  transition: background .2s ease;
}
.nav-toggle-line::before,
.nav-toggle-line::after{
  content: '';
  position: absolute;
  left: 0;
  width: 22px;
  height: 2px;
  background: currentColor;
  border-radius: 999px;
  transition: transform .25s ease, top .25s ease;
}
.nav-toggle-line::before{ top: -7px; }
.nav-toggle-line::after{ top: 7px; }
.nav-toggle-line.open{
  background: transparent;
}
.nav-toggle-line.open::before{
  top: 0;
  transform: rotate(45deg);
}
.nav-toggle-line.open::after{
  top: 0;
  transform: rotate(-45deg);
}
.nav-modern{
  display: flex; align-items: center; justify-content: center;
  gap: .35rem; flex-wrap: wrap;
}
.nav-modern .username{
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-link{
  position: relative;
  padding: .55rem .8rem;
  border-radius: 10px;
  color: rgba(255,255,255,.85);
  font-weight: 600;
  transition: color .2s ease, background .2s ease, transform .2s ease;
}
.nav-link:hover{
  color:#fff; background: rgba(255,255,255,.06); transform: translateY(-1px);
}
/* underline animé + actif */
.nav-link::after{
  content:''; position:absolute; left:.8rem; right:.8rem; bottom:.35rem; height:2px;
  border-radius: 2px; background: var(--gradient-primary);
  transform: scaleX(0); transform-origin: left; transition: transform .25s ease;
}
a.router-link-active.nav-link::after,


/* Droite : langue + avatar */
.header-right{ display: flex; align-items: center; gap: .6rem }

.theme-toggle{
  padding:.45rem .6rem; border-radius:10px; border:1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.08); color:#fff; cursor:pointer;
}
.theme-toggle:hover{ background: rgba(255,255,255,.14) }

.lang-selector{
  padding:.5rem .7rem; border-radius:12px;
  border:1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color:#fff; font-weight:700; cursor:pointer;
  transition: border-color .2s ease, background .2s ease, transform .2s ease;
}
.lang-selector:hover{ background: rgba(255,255,255,.1); transform: translateY(-1px) }
.lang-selector:focus{
  outline:none; border-color: rgba(99,102,241,.65);
  box-shadow: 0 0 0 3px rgba(99,102,241,.18);
}

/* ===== Zone utilisateur (avatar + menu) ===== */
.userbox{ position: relative; display:inline-flex; align-items:center; gap:.5rem }
.avatar{
  width: 38px; height: 38px; border-radius: 50%;
  display: grid; place-items: center; color:#fff; font-weight:800; font-size:.95rem;
  border: 2px solid rgba(255,255,255,.18);
  box-shadow: 0 8px 22px rgba(0,0,0,.45);
  overflow: hidden; cursor:pointer;
}
.avatar img{ width:170%; height:120%; object-fit: cover; display:block }
.avatar:hover{ transform: translateY(-1px); box-shadow: 0 10px 26px rgba(0,0,0,.5) }

/* présence */
.presence{ position:absolute; right:-2px; bottom:-2px; width: 12px; height: 12px; border-radius:50%; border:2px solid rgba(23,26,43,1); box-shadow: 0 0 0 2px rgba(0,0,0,.15) inset }
.presence.online{ background:#10b981 }
.presence.offline{ background:#ef4444 }
.presence-sm{ width: 10px; height: 10px; right:-2px; bottom:-2px }

/* Dropdown */
.user-menu{
  position: absolute; top: calc(100% + 10px); right: 0; width: 260px;
  border-radius: 7px; padding: .65rem;
  border: 1px solid rgba(255,255,255,.12);
  box-shadow: 0 22px 48px rgba(0,0,0,.45);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  animation: menuIn .16s ease;
}
@keyframes menuIn{ from{ opacity:0; transform: translateY(-6px) } to{ opacity:1; transform: translateY(0) } }
.user-menu::before{
  content:''; position:absolute; right:12px; top:-6px; width:12px; height:12px;
  background: inherit; transform: rotate(45deg);
  border-left: 1px solid rgba(255,255,255,.12);
  border-top: 1px solid rgba(255,255,255,.12);
}

/* Header du menu */
.user-menu-header{
  display:flex; align-items:center; gap:.6rem;
  padding:.35rem .35rem .6rem; margin-bottom:.4rem;
  border-bottom: 1px solid rgba(255,255,255,.12);
}
.avatar-sm{
  width: 34px; height: 34px; border-radius:50%;
  display:grid; place-items:center; color:#fff; font-weight:800;
  overflow:hidden; border:2px solid rgba(255,255,255,.18);
  background: linear-gradient(135deg,#4facfe 0%,#00f2fe 100%);
}
.avatar-sm img{ width:100%; height:100%; object-fit:cover; display:block }
.user-meta{ display:flex; flex-direction:column; min-width:0 }
.user-name{ font-weight:800; color:#fff; font-size:.95rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.user-status{ font-size:.8rem; color: rgba(255,255,255,.6) }

/* Items */
.menu-item{
  width:100%; background:transparent; border:0; color:#fff; font-weight:700;
  text-align:left; padding:.55rem .6rem; border-radius:7px; cursor:pointer;
  display:flex; align-items:center; gap:.55rem;
  transition: background .15s ease, transform .15s ease;
}
.menu-item:hover{ background: rgba(255,255,255,.08); transform: translateY(-1px) }
.menu-item.danger{ color:#ff6b6b }
.menu-sep{ height:1px; margin:.35rem 0; background: rgba(255,255,255,.12) }

/* ===== Main ===== */
.main-content{  }

/* ===== Responsive ===== */
@media (max-width: 900px){
  .header-modern{ padding: .9rem 2rem; }
  .header-content{ grid-template-columns: auto auto; gap:.8rem }
  .logo{ }
  .nav-wrapper{ justify-content: flex-start }
}
@media (max-width: 720px){
  .header-modern{ padding: .8rem 1.2rem; }
  .header-content{ grid-template-columns: auto auto; }
  .nav-wrapper{ justify-content: flex-end; }
  .nav-toggle{ display: inline-flex; }
  .nav-modern{
    position: absolute;
    top: calc(100% + 12px);
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: .35rem;
    padding: 0.85rem 0.9rem;
    border: 1px solid var(--surface-card-border);
    border: 1px solid var(--panel-border, var(--color-border));
    background: var(--panel-bg, rgba(255, 255, 255, 0.75));
    box-shadow: var(--panel-shadow);
    border-radius: 7px;
    opacity: 0;
    visibility: hidden;
    transform: translateY(-10px);
    pointer-events: none;
    transition: opacity .2s ease, transform .2s ease;
    backdrop-filter: blur(12px);
    z-index: 20;
  }
  .nav-modern.is-mobile-open{
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
    pointer-events: auto;
  }
  .nav-modern .username{
    width: 100%;
    justify-content: flex-start;
    padding: 0.6rem 0.8rem;
    border-radius: 8px;
    margin: 0;
  }
  .nav-modern .username:hover{
    background: rgb(255, 255, 255);
    transform: none;
  }
  .nav-modern .username::after{ display:none; }
  .header-right{ gap: .45rem; }
}
@media (max-width: 720px){
  .header-right .theme-toggle{ padding:.45rem .55rem }
}
@media (max-width: 640px){
  .lang-selector{ display:none }
}

/* ===== Global toasts ===== */
.gtoast-container{
  position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
  display:flex; flex-direction:column; gap:.5rem; z-index: 12000;
  pointer-events: none; /* laisse passer les clics sauf sur les toasts */
}
.gtoast{
  display:flex; align-items:flex-start; gap:.6rem; min-width: 260px; max-width: 94vw;
  background: rgba(0,0,0,.9); color:#fff; padding:.65rem .8rem; border-radius:7px;
  border: 1px solid rgba(255,255,255,.12); box-shadow: 0 10px 26px rgba(0,0,0,.35);
  pointer-events: auto;
}
.gtoast .icon{ font-size:1.1rem; line-height:1; margin-top:.1rem }
.gtoast .content{ display:flex; flex-direction:column; gap:.1rem; flex:1; min-width:0 }
.gtoast .title{ font-weight:800; font-size:.95rem }
.gtoast .message{ opacity:.95 }
.gtoast .action{ background:rgba(255,255,255,.14); border:1px solid rgba(255,255,255,.22); color:#fff; padding:.3rem .55rem; border-radius:6px; cursor:pointer; margin-right:.35rem }
.gtoast .action:hover{ background:rgba(255,255,255,.22) }
.gtoast .close{ background:transparent; border:0; color:#fff; opacity:.85; cursor:pointer; font-weight:800 }
.gtoast.success{ background: rgba(16,185,129,.92) }
.gtoast.error{ background: rgba(239,68,68,.92) }
.gtoast.info{ background: rgba(100,181,246,.92) }
.gtoast.warning{ background: rgba(245,158,11,.92) }

.gtoast-enter-active,.gtoast-leave-active{ transition: all .2s ease }
.gtoast-enter-from,.gtoast-leave-to{ opacity:0; transform: translateY(-8px) }
html.fs-active .gtoast-container { pointer-events: none !important; }


.music-controls {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  position: relative;
}

.music-slider {
  position: absolute;
  top: 120%; /* en dessous du bouton */
  left: 50%;
  transform: translateX(-50%);
  width: 120px;
}

/* animation d’apparition/disparition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Background animé */
.game-background {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: -1;
  background: linear-gradient(135deg, var(--color-background) 0%, var(--color-background-soft) 100%);
}

.floating-shapes {
  position: absolute;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.shape {
  position: absolute;
  border-radius: 50%;
  background: linear-gradient(45deg, var(--color-primary), var(--color-secondary));
  opacity: 0.1;
  animation: float 6s ease-in-out infinite;
}

.shape-1 {
  width: 80px;
  height: 80px;
  top: 20%;
  left: 10%;
  animation-delay: -2s;
}

.shape-2 {
  width: 120px;
  height: 120px;
  top: 60%;
  right: 15%;
  animation-delay: -4s;
}

.shape-3 {
  width: 100px;
  height: 100px;
  bottom: 20%;
  left: 20%;
  animation-delay: -1s;
}

.shape-4 {
  width: 60px;
  height: 60px;
  top: 10%;
  right: 30%;
  animation-delay: -3s;
}

@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(180deg); }
}

</style>
