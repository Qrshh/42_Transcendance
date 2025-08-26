<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, RouterLink, RouterView } from 'vue-router'
import { io } from 'socket.io-client'

/* ==== i18n & auth (comme ton code existant) ==== */
import { useI18n } from './composables/useI18n'
import { isLoggedIn } from './stores/auth'
const { t, onLangChange } = useI18n()

/* ==== Router & Socket ==== */
const router = useRouter()
const socket = ref<ReturnType<typeof io> | null>(null)
const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:3000'

/* ==== Session (réactif !) ==== */
const userName = ref((localStorage.getItem('username') || '').trim())
// Si ton store `isLoggedIn` est bien réactif, garde-le.
// Sinon, tu peux simplifier en: const logged = computed(() => !!userName.value)
const logged = computed(() => !!isLoggedIn && !!userName.value)

/* Garder le header synchro avec localStorage (login/logout depuis n'importe où) */
function refreshAuthFromStorage() {
  userName.value = (localStorage.getItem('username') || '').trim()
}

/* ==== Lang ==== */
const selectedLang = ref(localStorage.getItem('lang') || 'en')
function handleLangChange() {
  onLangChange()
  localStorage.setItem('lang', selectedLang.value)
}

/* ==== Avatar & user menu ==== */
const showUserMenu = ref(false)
const avatarUrl = ref<string | null>(null)
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
function closeMenuOnOutside(e: MouseEvent) {
  if (!(e.target as Element)?.closest('.userbox')) showUserMenu.value = false
}
function onAvatarKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMenu() }
  if (e.key === 'Escape') showUserMenu.value = false
}

/* ==== Helpers ==== */
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
  try { await fetch(`${API_BASE}/logout`, { method: 'POST' }) } catch {}
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
function canAccessProfile() {
  return !!userName.value
}

/* ==== Lifecycle ==== */
onMounted(async () => {
  // écouter les changements d'auth globaux
  window.addEventListener('storage', refreshAuthFromStorage)
  window.addEventListener('auth-changed', refreshAuthFromStorage)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshAuthFromStorage()
  })

  // socket + identify
  socket.value = io(API_BASE, { withCredentials: true, transports: ['websocket'] })
  if (userName.value) socket.value.emit('identify', userName.value)

  socket.value.on('forceLogout', ({ reason }) => {
    try { localStorage.clear(); sessionStorage.clear() } catch {}
    refreshAuthFromStorage()
    window.dispatchEvent(new Event('auth-changed'))
    router.replace({ name: 'login' })
  })

  document.addEventListener('click', closeMenuOnOutside)

  // Récupère l'avatar s'il existe
  await loadAvatar(userName.value)
})

onBeforeUnmount(() => {
  socket.value?.off('forceLogout')
  socket.value?.disconnect()
  document.removeEventListener('click', closeMenuOnOutside)
  window.removeEventListener('storage', refreshAuthFromStorage)
  window.removeEventListener('auth-changed', refreshAuthFromStorage)
})

/* ==== Réagir au changement d’utilisateur ==== */
watch(userName, (n, o) => {
  if (n !== o) {
    if (n && socket.value) socket.value.emit('identify', n)
    loadAvatar(n)
    showUserMenu.value = false
  }
})
</script>


<template>
  <header class="header-modern">
    <div class="header-content">
      <!-- Logo -->
      <div class="logo">
        <h1 class="logo-text">🎮 MasterPong</h1>
      </div>

      <!-- Nav -->
      <nav class="nav-modern">
        <RouterLink to="/" class="nav-link">{{ t.home }}</RouterLink>
        <RouterLink
          v-if="logged"
          to="/profile"
          class="nav-link"
        >{{ t.profile }}</RouterLink>
        <RouterLink v-else to="/about" class="nav-link">{{ t.loginRegister }}</RouterLink>
        <RouterLink v-if="logged" to="/social" class="nav-link">{{ t.messages }}</RouterLink>
        <RouterLink to="/game" class="nav-link">{{ t.play }}</RouterLink>
      </nav>

      <!-- Droite : langue + avatar -->
      <div class="header-right">
        <select v-model="selectedLang" @change="handleLangChange" class="lang-selector" aria-label="Language">
          <option value="en">🇬🇧 EN</option>
          <option value="fr">🇫🇷 FR</option>
          <option value="es">🇪🇸 ES</option>
        </select>

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
          </button>

          <div v-if="showUserMenu" class="user-menu" role="menu">
            <div class="user-menu-header">
              <div class="avatar-sm" :style="{ background: userGradient }">
                <img v-if="avatarUrl" :src="avatarUrl" alt="" @error="avatarUrl = null" />
                <span v-else>{{ userInitial }}</span>
              </div>
              <div class="user-meta">
                <div class="user-name">{{ userName }}</div>
                <div class="user-status">Connecté</div>
              </div>
            </div>

            <button class="menu-item" role="menuitem" @click="goProfileSettings">⚙️ Paramètres</button>
            <div class="menu-sep"></div>
            <button class="menu-item danger" role="menuitem" @click="doLogout">🚪 Déconnexion</button>
          </div>
        </div>
      </div>
    </div>
  </header>

  <main class="main-content">
    <RouterView />
  </main>
</template>

<style scoped>
/* ===== Header (look & feel ProfileView) ===== */
.header-modern{
  position: sticky;
  top: 0;
  z-index: 1000;
  backdrop-filter: blur(14px) saturate(120%);
  -webkit-backdrop-filter: blur(14px) saturate(120%);
  background: rgba(var(--color-background-soft-rgb, 22, 26, 43), .85);
  border-bottom: 1px solid rgba(255,255,255,.08);
  padding: .9rem 1.25rem;
  border-radius: 23px;
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
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Nav */
.nav-modern{
  display: flex; align-items: center; justify-content: center;
  gap: .35rem; flex-wrap: wrap;
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
  border: 2px solid rgba(0,0,0,.35);
  box-shadow: 0 6px 18px rgba(0,0,0,.35);
  overflow: hidden; cursor:pointer;
}
.avatar img{ width:100%; height:100%; object-fit: cover; display:block }

/* Dropdown */
.user-menu{
  position: absolute; top: calc(100% + 10px); right: 0; width: 260px;
  border-radius: 14px; padding: .65rem;
  background: rgba(23,26,43,.96);
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
  overflow:hidden; border:2px solid rgba(0,0,0,.35);
  background: linear-gradient(135deg,#4facfe 0%,#00f2fe 100%);
}
.avatar-sm img{ width:100%; height:100%; object-fit:cover; display:block }
.user-meta{ display:flex; flex-direction:column; min-width:0 }
.user-name{ font-weight:800; color:#fff; font-size:.95rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.user-status{ font-size:.8rem; color: rgba(255,255,255,.6) }

/* Items */
.menu-item{
  width:100%; background:transparent; border:0; color:#fff; font-weight:700;
  text-align:left; padding:.55rem .6rem; border-radius:10px; cursor:pointer;
  display:flex; align-items:center; gap:.55rem;
  transition: background .15s ease, transform .15s ease;
}
.menu-item:hover{ background: rgba(255,255,255,.08); transform: translateY(-1px) }
.menu-item.danger{ color:#ff6b6b }
.menu-sep{ height:1px; margin:.35rem 0; background: rgba(255,255,255,.12) }

/* ===== Main ===== */
.main-content{ min-height: calc(100vh - 72px); padding: 2rem }

/* ===== Responsive ===== */
@media (max-width: 900px){
  .header-content{ grid-template-columns: 1fr auto; gap:.8rem }
  .logo{ display:none }
  .nav-modern{ justify-content: flex-start }
}
@media (max-width: 640px){
  .nav-modern{ gap:.2rem }
  .nav-link{ padding:.5rem .6rem }
  .lang-selector{ display:none }
}
</style>