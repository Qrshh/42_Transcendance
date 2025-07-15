<template>
  <div class="about flex flex-col items-center space-y-4">
    <h1 class="text-2xl font-bold">{{ isLogin ? 'Connexion' : 'Inscription' }}</h1>

    <input v-if="!isLogin" v-model="username" type="text" placeholder="Nom d'utilisateur" class="border p-2 rounded" />
    <input v-model="email" type="email" placeholder="Email" class="border p-2 rounded" />
    <input v-model="password" type="password" placeholder="Mot de passe" class="border p-2 rounded" />

    <button @click="isLogin ? handleLogin() : handleRegister()" class="bg-blue-500 text-white px-4 py-2 rounded">
      {{ isLogin ? 'Se connecter' : 'Créer un compte' }}
    </button>

    <button @click="toggleMode" class="text-sm text-blue-700 hover:underline">
      {{ isLogin ? "Pas de compte ? S'inscrire" : 'Déjà un compte ? Se connecter' }}
    </button>

    <p v-if="message" class="text-green-600">{{ message }}</p>
    <p v-if="error" class="text-red-600">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const email = ref('')
const password = ref('')
const username = ref('')
const isLogin = ref(true)
const error = ref(null)
const message = ref(null)
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
    router.push('/game')
  } catch (err) {
    error.value = err.response?.data?.message || 'Erreur de connexion'
  }
}

const handleRegister = async () => {
  error.value = null
	console.log('Register →', {
	username: username.value,
	email: email.value,
	password: password.value
	})
  try {
    const res = await axios.post('http://localhost:3000/register', {
      username: username.value,
      email: email.value,
      password: password.value,
    })
    message.value = 'Compte créé avec succès. Connecte-toi maintenant.'
    toggleMode()
  } catch (err) {
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
