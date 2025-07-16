<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from '../composables/useI18n'
import { logout } from '../stores/auth'
import axios from 'axios'

const { t } = useI18n()
const router = useRouter()

const username = localStorage.getItem('username') || 'Invité'
const email = localStorage.getItem('email') || 'inconnu@exemple.com'
const avatar = ref(localStorage.getItem('avatar') || '/avatars/default.png')

// Liste d’avatars prédéfinis — adapte selon ce que tu as dans /avatars
const avatars = [
  '/avatars/default.png',
  '/avatars/avatar2.png',
]

const selectedAvatar = ref(avatar.value)

const handleLogout = () => {
  logout()
  router.push('/about')
}

const saveAvatar = async () => {
  try {
    await axios.put('http://localhost:3000/user/avatar', {
      username,
      avatar: selectedAvatar.value,
    })
    avatar.value = selectedAvatar.value
    localStorage.setItem('avatar', avatar.value)
    alert(t.avatarUpdated || 'Avatar mis à jour !')
  } catch (e) {
    alert(t.avatarUpdateError || 'Erreur lors de la mise à jour de l\'avatar.')
  }
}
</script>

<template>
  <div class="p-6 max-w-lg mx-auto mt-12 bg-white rounded-2xl shadow-lg space-y-6">
    <div class="text-center space-y-4">
      <img 
        :src="`http://localhost:3000${avatar}`" 
        alt="Avatar" 
        class="w-24 h-24 rounded-full mx-auto border-2 border-gray-300"
      />
      <h1 class="text-3xl font-bold text-gray-800"> {{ username }} </h1>
      <p class="text-gray-500">{{ t.profileWelcome }}</p>
    </div>

    <div class="bg-gray-100 p-4 rounded-lg space-y-2">
      <p><strong>{{ t.email }} :</strong> {{ email }}</p>
      <p><strong>{{ t.lastLogin }} :</strong> aujourd’hui</p> <!-- Remplacer par dynamique plus tard -->
    </div>

    <div class="space-y-4">
      <label for="avatar-select" class="block font-semibold">{{ t.chooseAvatar }}</label>
      <select
        id="avatar-select"
        v-model="selectedAvatar"
        class="w-full p-2 border rounded"
      >
        <option v-for="a in avatars" :key="a" :value="a">
          {{ a.split('/').pop() }}
        </option>
      </select>
      <button
        @click="saveAvatar"
        class="w-full px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
      >
        {{ t.saveAvatarBtn || 'Save Avatar' }}
      </button>
    </div>

    <div class="text-center">
      <button
        @click="handleLogout"
        class="px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition"
      >
        🚪 {{ t.logoutBtn }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Personnalise selon tes besoins */
</style>
