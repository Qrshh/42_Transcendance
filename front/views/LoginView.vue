<template>
  <div class="about flex flex-col items-center space-y-4">
    <!-- Titre dynamique -->
    <h1 class="text-2xl font-bold">
      {{ requiresTwoFactor ? 'Authentification à 2 facteurs' : (isLogin ? t.login : t.register) }}
    </h1>

    <!-- Formulaire normal OU inscription -->
    <div v-if="!requiresTwoFactor" style="display: flex; flex-direction: column; gap: 2px; width: 300px;">
      <input v-if="!isLogin" v-model="username" type="text" :placeholder="t.usernamePlaceholder" class="border p-2 rounded" style="width: 100%; display: block;" />
      <input v-model="email" type="email" :placeholder="t.emailPlaceholder" class="border p-2 rounded" style="width: 100%; display: block;" />
      <input v-model="password" type="password" :placeholder="t.passwordPlaceholder" class="border p-2 rounded" style="width: 100%; display: block;" />

      <button @click="isLogin ? handleLogin() : handleRegister()" 
              :disabled="loading"
              class="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
              style="width: 100%; display: block; margin-top: 2px;">
        {{ loading ? 'Chargement...' : (isLogin ? t.loginBtn : t.registerBtn) }}
      </button>

      <button @click="toggleMode" class="text-sm text-blue-700 hover:underline" style="display: block; text-align: center;">
        {{ isLogin ? t.switchToRegister : t.switchToLogin }}
      </button>
    </div>

    <!-- Formulaire 2FA -->
    <div v-if="requiresTwoFactor" class="flex flex-col space-y-4 w-full max-w-md">
      <div class="text-center mb-4">
        <div class="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3">
          🔒
        </div>
        <p class="text-sm text-gray-600">Entrez le code de votre app d'authentification</p>
      </div>

      <input v-model="twoFactorCode" 
             type="text" 
             placeholder="123456 ou AB12CD34"
             maxlength="8"
             class="border p-3 rounded text-center text-lg font-mono w-full"
             @input="formatTwoFactorCodeFlexible"
             @keyup.enter="handleTwoFactorLogin">
      
      <button @click="handleTwoFactorLogin" 
              :disabled="loading || (twoFactorCode.length !== 6 && twoFactorCode.length !== 8)"
              class="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50 w-full">
        {{ loading ? 'Vérification...' : 'Vérifier' }}
      </button>

      <button @click="goBack" class="text-sm text-gray-500 hover:text-gray-700">
        ← Retour à la connexion
      </button>
    </div>

    <p v-if="message" class="text-green-600">{{ message }}</p>
    <p v-if="error" class="text-red-600">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { login } from '../stores/auth'
import { ref } from 'vue'
import { useI18n } from '../composables/useI18n'
import { useRouter } from 'vue-router'
import axios from 'axios'

const { t } = useI18n()

const isLogin = ref(true)
const username = ref('')
const email = ref('')
const password = ref('')
const twoFactorCode = ref('')
const error = ref<string | null>(null)
const message = ref<string | null>(null)
const loading = ref(false)
const requiresTwoFactor = ref(false)

const router = useRouter()

const toggleMode = () => {
  isLogin.value = !isLogin.value
  error.value = null
  message.value = null
  requiresTwoFactor.value = false
}

const formatTwoFactorCodeFlexible = () => {
  twoFactorCode.value = twoFactorCode.value
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 8)
}

const handleLogin = async () => {
  error.value = null
  loading.value = true
  
  try {
    const res = await axios.post('http://10.12.2.6:3000/login', {
      email: email.value,
      password: password.value,
    })

    // Si 2FA requise
    if (res.data.requiresTwoFactor) {
      requiresTwoFactor.value = true
      loading.value = false
      return
    }

    // Connexion normale réussie
    login(res.data.username, res.data.email, res.data.avatar)
    router.push('/')
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Erreur de connexion'
  } finally {
    loading.value = false
  }
}

const handleTwoFactorLogin = async () => {
  error.value = null
  loading.value = true
  
  try {
    const res = await axios.post('http://10.12.2.6:3000/login', {
      email: email.value,
      password: password.value,
      twoFactorCode: twoFactorCode.value
    })

    // Connexion avec 2FA réussie
    login(res.data.username, res.data.email, res.data.avatar, res.data.twoFactorEnabled)
    router.push('/')
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Code invalide'
    twoFactorCode.value = ''
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  requiresTwoFactor.value = false
  twoFactorCode.value = ''
  error.value = null
}

const handleRegister = async () => {
  error.value = null
  loading.value = true
  
  try {
    const res = await axios.post('http://10.12.2.6:3000/register', {
      username: username.value,
      email: email.value,
      password: password.value,
    })
    message.value = 'Compte créé avec succès. Connecte-toi maintenant.'
    toggleMode()
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Erreur lors de la création du compte'
  } finally {
    loading.value = false
  }
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