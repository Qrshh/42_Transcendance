<script setup lang="ts">
import { useI18n } from './composables/useI18n'
const { t, onLangChange } = useI18n()

import { RouterLink, RouterView } from 'vue-router'
const username = localStorage.getItem('username')

</script>

<template>
  <header class="flex justify-between items-center p-4 border-b">
    <div class="wrapper flex gap-4 items-center">
      <nav class="flex gap-4">
        <RouterLink to="/">{{ t.home }}</RouterLink>
        <RouterLink to="/about">{{ t.loginRegister }}</RouterLink>
        <RouterLink to="/game">{{ t.play }}</RouterLink>
      </nav>
    </div>
    
    <!-- Sélecteur de langue -->
    <select @change="onLangChange" class="border p-1 rounded">
      <option value="en">🇬🇧</option>
      <option value="fr">🇫🇷</option>
      <option value="es">🇪🇸</option>
    </select>
  </header>

  <RouterView />
</template>


<style scoped>

</style>
