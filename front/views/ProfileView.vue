<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from '../composables/useI18n'
const { t } = useI18n()

const router = useRouter()
const username = localStorage.getItem('username') || 'Invité'

const logout = () => {
  localStorage.removeItem('username')
  router.push('/about') // redirige vers login/register
}
</script>

<template>
  <div class="p-4 max-w-md mx-auto mt-10 bg-white rounded shadow">
    <h1 class="text-2xl font-bold mb-4">{{ t.username }}</h1>
    <p>Bienvenue sur ta page profil !</p>
    <button @click= "logout" class="mt-6 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
      Déconnexion
    </button>
  </div>
</template>

<style scoped>
/* Ajoute du style si tu veux */
</style>
