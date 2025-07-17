<script setup lang="ts">
import { useI18n } from './composables/useI18n'
const { t, onLangChange } = useI18n()

import { isLoggedIn } from './stores/auth'

import {ref, onMounted} from 'vue'


import { RouterLink, RouterView } from 'vue-router'
const username = localStorage.getItem('username')

const selectedLang = ref('en') // valeur par défaut

onMounted(() => {
  const saved = localStorage.getItem('lang') || 'en'
  selectedLang.value = saved
})


</script>

<template>
  <header class="flex justify-between items-center p-4 border-b">
    <div class="wrapper flex gap-4 items-center">
      <nav class="flex gap-4">
        <RouterLink to="/">{{ t.home }}</RouterLink>
		<RouterLink v-if="isLoggedIn" to="/profile"> {{ t.profile }}</RouterLink>
        <RouterLink v-else to="/about">{{ t.loginRegister }}</RouterLink>
		<RouterLink v-if="isLoggedIn" to="/social"> {{ t.messages }}</RouterLink>
        <RouterLink to="/game">{{ t.play }}</RouterLink>
      </nav>
    </div>
    
    <!-- Sélecteur de langue -->
    <select v-model="selectedLang" @change="onLangChange" class="border p-1 rounded">
      <option value="en">🇬🇧</option>
      <option value="fr">🇫🇷</option>
      <option value="es">🇪🇸</option>
    </select>
  </header>

  <RouterView />
</template>


<style scoped>

</style>
