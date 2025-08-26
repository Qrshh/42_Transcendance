<template>
  <div class="about flex flex-col items-center space-y-4">
    <h1 class="text-2xl font-bold">
      {{ requiresTwoFactor ? 'Authentification à 2 facteurs' : (isLogin ? t.login : t.register) }}
    </h1>

    <!-- Form login / register -->
    <div v-if="!requiresTwoFactor" class="w-[300px] flex flex-col gap-2">
      <input v-if="!isLogin" v-model.trim="username" type="text" :placeholder="t.usernamePlaceholder" class="border p-2 rounded w-full" />
      <input v-model.trim="email" type="email" :placeholder="t.emailPlaceholder" class="border p-2 rounded w-full" />
      <input v-model="password" type="password" :placeholder="t.passwordPlaceholder" class="border p-2 rounded w-full" />

      <button
        @click="isLogin ? handleLogin() : handleRegister()"
        :disabled="loading"
        class="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50 w-full mt-1"
      >
        {{ loading ? 'Chargement...' : (isLogin ? t.loginBtn : t.registerBtn) }}
      </button>

      <button @click="toggleMode" class="text-sm text-blue-700 hover:underline text-center">
        {{ isLogin ? t.switchToRegister : t.switchToLogin }}
      </button>
    </div>

    <!-- Étape 2FA -->
    <div v-else class="flex flex-col space-y-4 w-full max-w-md">
      <div class="text-center mb-2">
        <div class="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3">🔒</div>
        <p class="text-sm text-gray-600">Entrez le code de votre app ou un code de récupération</p>
      </div>

      <input
        v-model="twoFactorCode"
        type="text"
        placeholder="123456 ou AB12CD34"
        maxlength="8"
        class="border p-3 rounded text-center text-lg font-mono w-full"
        @input="formatTwoFactorCodeFlexible"
        @keyup.enter="handleTwoFactorLogin"
      />

      <button
        @click="handleTwoFactorLogin"
        :disabled="loading || (twoFactorCode.length !== 6 && twoFactorCode.length !== 8)"
        class="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50 w-full"
      >
        {{ loading ? 'Vérification...' : 'Vérifier' }}
      </button>

      <button @click="goBack" class="text-sm text-gray-500 hover:text-gray-700">← Retour à la connexion</button>
    </div>

    <p v-if="message" class="text-green-600">{{ message }}</p>
    <p v-if="error" class="text-red-600">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '../composables/useI18n'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { login as setSession } from '../stores/auth'

const { t } = useI18n()
const router = useRouter()

const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:3000'
const api = axios.create({ baseURL: API_BASE })

const isLogin = ref(true)
const username = ref('')
const email = ref('')
const password = ref('')
const twoFactorCode = ref('')
const error = ref<string | null>(null)
const message = ref<string | null>(null)
const loading = ref(false)
const requiresTwoFactor = ref(false)

// Toggle form
const toggleMode = () => {
  isLogin.value = !isLogin.value
  error.value = null
  message.value = null
  requiresTwoFactor.value = false
  twoFactorCode.value = ''
}

// Format 2FA (6 chiffres) ou code de récup (8 hexa)
const formatTwoFactorCodeFlexible = () => {
  twoFactorCode.value = twoFactorCode.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8)
}

// Helpers
function persistTokens(tokens: { accessToken: string; refreshToken: string }) {
  localStorage.setItem('accessToken', tokens.accessToken)
  localStorage.setItem('refreshToken', tokens.refreshToken)
  // Optionnel: header par défaut axios
  api.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`
}

function persistProfile(user: any) {
  localStorage.setItem('username', user.username)
  localStorage.setItem('email', user.email)
  localStorage.setItem('avatar', user.avatar || '/avatars/default.png')
  localStorage.setItem('twoFactorEnabled', String(!!user.twoFactorEnabled))
  // garder compat avec ton store existant
  setSession(user.username, user.email, user.avatar, user.twoFactorEnabled)
}

// Actions
const handleLogin = async () => {
  error.value = null
  loading.value = true
  try {
    const { data } = await api.post('/auth/login', {
      email: email.value,
      password: password.value,
    })

    if (data?.requiresTwoFactor) {
      requiresTwoFactor.value = true
      return
    }

    // connexion directe (2FA off)
    persistTokens(data.tokens)
    persistProfile(data.user)
    window.dispatchEvent(new Event('auth-changed'))
    router.push('/')
  } catch (err: any) {
    error.value = err?.response?.data?.message || err?.response?.data?.error || 'Erreur de connexion'
  } finally {
    loading.value = false
  }
}

const handleTwoFactorLogin = async () => {
  error.value = null
  loading.value = true
  try {
    const { data } = await api.post('/auth/login', {
      email: email.value,
      password: password.value,
      twoFactorCode: twoFactorCode.value
    })

    persistTokens(data.tokens)
    persistProfile(data.user)
    window.dispatchEvent(new Event('auth-changed'))
    router.push('/')
  } catch (err: any) {
    error.value = err?.response?.data?.message || err?.response?.data?.error || 'Code invalide'
    twoFactorCode.value = ''
  } finally {
    loading.value = false
  }
}

const handleRegister = async () => {
  error.value = null
  loading.value = true
  try {
    await api.post('/register', {
      username: username.value,
      email: email.value,
      password: password.value,
    })
    message.value = 'Compte créé avec succès. Connecte-toi maintenant.'
    toggleMode()
  } catch (err: any) {
    error.value = err?.response?.data?.error || 'Erreur lors de la création du compte'
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  requiresTwoFactor.value = false
  twoFactorCode.value = ''
  error.value = null
}
</script>

<style scoped>
.about {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
}
</style>