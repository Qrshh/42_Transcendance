<script setup lang="ts">
import { useI18n } from './composables/useI18n'
const { t, onLangChange } = useI18n()

import { isLoggedIn } from './stores/auth'

import {ref, onMounted} from 'vue'
import { io } from 'socket.io-client'

import { RouterLink, RouterView } from 'vue-router'
const username = localStorage.getItem('username')

const selectedLang = ref('en')
const socket = ref()

onMounted(() => {
  socket.value = io('http://10.12.2.6:3000')
  const username = localStorage.getItem('username')
  if (username && socket.value) {
    socket.value.emit('identify', username)
  }
  const saved = localStorage.getItem('lang') || 'en'
  selectedLang.value = saved
})

const canAccessProfile = () => {
  return localStorage.getItem('username') !== null
}
</script>

<template>
  <header class="header-modern">
    <div class="header-content">
      <div class="logo">
        <h1 class="logo-text">🎮 MasterPong</h1>
      </div>
      
      <nav class="nav-modern">
        <RouterLink to="/" class="nav-link">{{ t.home }}</RouterLink>
        <RouterLink v-if="isLoggedIn && canAccessProfile()" to="/profile" class="nav-link">{{ t.profile }}</RouterLink>
        <RouterLink v-else to="/about" class="nav-link">{{ t.loginRegister }}</RouterLink>
        <RouterLink v-if="isLoggedIn" to="/social" class="nav-link">{{ t.messages }}</RouterLink>
        <RouterLink to="/game" class="nav-link nav-link-special">{{ t.play }}</RouterLink>
      </nav>
    </div>
    
    <select v-model="selectedLang" @change="onLangChange" class="lang-selector">
      <option value="en">🇬🇧 EN</option>
      <option value="fr">🇫🇷 FR</option>
      <option value="es">🇪🇸 ES</option>
    </select>
  </header>

  <main class="main-content">
    <RouterView />
  </main>
</template>

<style scoped>
.header-modern {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 1000;
}

@media (prefers-color-scheme: dark) {
  .header-modern {
    background: rgba(15, 15, 35, 0.95);
    border-bottom-color: var(--color-border);
  }
}

.header-content {
  display: flex;
  align-items: center;
  gap: 3rem;
}

.logo-text {
  background: var(--gradient-primary);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-size: 1.5rem;
  font-weight: 800;
}

.nav-modern {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.nav-link {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.3s ease;
  position: relative;
}

.nav-link-special {
  background: var(--gradient-primary);
  color: white;
  font-weight: 600;
  box-shadow: var(--glow-primary);
}

.nav-link-special:hover {
  transform: scale(1.05);
  box-shadow: var(--glow-primary);
}

.lang-selector {
  padding: 0.5rem 1rem;
  border: 2px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background-soft);
  color: var(--color-text);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.lang-selector:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.1);
}

.main-content {
  min-height: calc(100vh - 80px);
  padding: 2rem;
}

@media (max-width: 768px) {
  .header-modern {
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }
  
  .header-content {
    flex-direction: column;
    gap: 1rem;
  }
  
  .nav-modern {
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style>
