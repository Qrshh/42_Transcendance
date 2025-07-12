<template>
   <!-- Header du site et router pour la MonoPage-->
  <header>
    <div class="wrapper">
      <nav>
        <RouterLink to="/">Home</RouterLink>
        <RouterLink to="/about">Login / Register</RouterLink>
        <RouterLink to="/game">Play</RouterLink>
      </nav>
    </div>
  </header>
  <RouterView />
</template>

<script setup lang="ts">
  import { RouterLink, RouterView } from 'vue-router'
</script>

<style scoped>

</style>
