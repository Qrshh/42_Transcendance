<template>
  <div class="about flex flex-col items-center space-y-4">
    <h1 class="text-2xl font-bold">{{ isLogin ? t.login : t.register }}</h1>

    <input v-if="!isLogin" v-model="username" type="text" :placeholder="t.usernamePlaceholder" class="border p-2 rounded" />
    <input v-model="email" type="email" :placeholder="t.emailPlaceholder" class="border p-2 rounded" />
    <input v-model="password" type="password" :placeholder="t.passwordPlaceholder" class="border p-2 rounded" />

    <button @click="isLogin ? handleLogin() : handleRegister()" class="bg-blue-500 text-white px-4 py-2 rounded">
      {{ isLogin ? t.loginBtn : t.registerBtn }}
    </button>

    <button @click="toggleMode" class="text-sm text-blue-700 hover:underline">
      {{ isLogin ? t.switchToRegister : t.switchToLogin }}
    </button>

    <p v-if="message" class="text-green-600">{{ message }}</p>
    <p v-if="error" class="text-red-600">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '../composables/useI18n'
import { useRouter } from 'vue-router'
import axios from 'axios'

const { t } = useI18n()

const isLogin = ref(true)
const username = ref('')
const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const message = ref<string | null>(null)

const router = useRouter()

const toggleMode = () => {
  isLogin.value = !isLogin.value
  error.value = null
  message.value = null
}

const handleLogin = async () => {
  error.value = null
  try {
    const res = await axios.post('http://localhost:3000/login', {
      email: email.value,
      password: password.value,
    })
    localStorage.setItem('username', res.data.username)
    router.push('/')
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Erreur de connexion'
  }
}

const handleRegister = async () => {
  error.value = null
  try {
    const res = await axios.post('http://localhost:3000/register', {
      username: username.value,
      email: email.value,
      password: password.value,
    })
    message.value = 'Compte créé avec succès. Connecte-toi maintenant.'
    toggleMode()
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Erreur lors de la création du compte'
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
