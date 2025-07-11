<template>
  <canvas ref="canvasEl" :width="CANVAS_WIDTH" :height="CANVAS_HEIGHT" />
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import type { GameState } from './ts/types'
import { drawGameState } from './ts/drawing'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './ts/constants'

const props = defineProps<{
  state: GameState,
  onMove: (player: 'p1' | 'p2', direction: 'up' | 'down' | 'stop') => void
}>()

const canvasEl = ref<HTMLCanvasElement | null>(null)

// On observe les changements de l'état du jeu et on redessine
watch(() => props.state, (newState) => {
  const ctx = canvasEl.value?.getContext('2d')
  if (ctx) {
    drawGameState(ctx, newState)
  }
}, { deep: true })

// Gestion des entrées utilisateur
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'w') props.onMove('p1', 'up')
  if (e.key === 's') props.onMove('p1', 'down')
  if (e.key === 'ArrowUp') props.onMove('p2', 'up')
  if (e.key === 'ArrowDown') props.onMove('p2', 'down')
}

const handleKeyUp = (e: KeyboardEvent) => {
  if (e.key === 'w' || e.key === 's') props.onMove('p1', 'stop')
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') props.onMove('p2', 'stop')
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
})
</script>

<style scoped>
canvas {
  border: 4px solid white;
  background-color: black;
}
</style>
