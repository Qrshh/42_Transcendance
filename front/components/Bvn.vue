<template>
  <!-- Module Header du site mais aussi à la fois un squelette 
  vue js si vous avez besoin d'une base vue, c'est ici :)
  -->
  <Basic>
    <template #heading>{{ t.welcome }}</template>
    <a href="https://google.com/" target="_blank" rel="noopener">lien basique</a>
  </Basic>
</template>

<script setup lang="ts">
  import Basic from './Basic.vue'
  import { useI18n } from '../composables/useI18n'
	const { t } = useI18n()
</script>

<style scoped>

</style>