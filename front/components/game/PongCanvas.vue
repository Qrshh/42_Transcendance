<template>
  <div class="pong-canvas-wrapper">
    <canvas 
      ref="canvasEl" 
      :width="CANVAS_WIDTH" 
      :height="CANVAS_HEIGHT"
      class="pong-canvas"
    />
    
    <!-- Effets visuels overlay -->
    <div class="canvas-effects">
      <!--<div class="center-line"></div>
      <div class="glow-effect" :class="{ active: ballNearEdge }"></div>-->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import type { GameState } from './ts/types'
import { drawGameState } from './ts/drawing'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './ts/constants'

const props = defineProps<{
  state: GameState,
  onMove: (player: 'p1' | 'p2', direction: 'up' | 'down' | 'stop') => void
}>()

const canvasEl = ref<HTMLCanvasElement | null>(null)

// Effet visuel quand la balle est près des bords
const ballNearEdge = computed(() => {
  return props.state.ball.x < 50 || props.state.ball.x > CANVAS_WIDTH - 50
})

// Observer les changements de l'état du jeu et redessiner
watch(() => props.state, (newState) => {
  const ctx = canvasEl.value?.getContext('2d')
  if (ctx) {
    drawGameState(ctx, newState)
  }
}, { deep: true })

// Gestion des entrées utilisateur
const handleKeyDown = (e: KeyboardEvent) => {
  e.preventDefault()
  if (e.key === 'w' || e.key === 'W') props.onMove('p1', 'up')
  if (e.key === 's' || e.key === 'S') props.onMove('p1', 'down')
  if (e.key === 'ArrowUp') props.onMove('p2', 'up')
  if (e.key === 'ArrowDown') props.onMove('p2', 'down')
}

const handleKeyUp = (e: KeyboardEvent) => {
  e.preventDefault()
  if (e.key === 'w' || e.key === 'W' || e.key === 's' || e.key === 'S') {
    props.onMove('p1', 'stop')
  }
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    props.onMove('p2', 'stop')
  }
}

onMounted(() => {
  // Focus sur le canvas pour capturer les événements clavier
  canvasEl.value?.focus()
  
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  
  // Dessiner l'état initial
  const ctx = canvasEl.value?.getContext('2d')
  if (ctx) {
    drawGameState(ctx, props.state)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
})
</script>

<style scoped>
.pong-canvas-wrapper {
  position: relative;
  display: inline-block;
  background: #000;
  border-radius: 15px;
  /*overflow: hidden;*/
  box-shadow: 
    0 0 20px rgba(0, 0, 0, 0.5),
    inset 0 0 20px rgba(255, 255, 255, 0.1);
}

.pong-canvas {
  display: block;
  border: 3px solid var(--color-border);
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%);
  cursor: crosshair;
  transition: all 0.3s ease;
}

.pong-canvas:hover {
  border-color: var(--color-primary);
  box-shadow: var(--glow-primary);
}

.pong-canvas:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--glow-primary);
}

/* Effets visuels */
.canvas-effects {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  border-radius: 12px;
}

.center-line {
  position: absolute;
  left: 50%;
  top: 5%;
  bottom: 5%;
  width: 2px;
  background: linear-gradient(to bottom, 
    transparent 0%,
    rgba(255, 255, 255, 0.3) 10%,
    rgba(255, 255, 255, 0.6) 50%,
    rgba(255, 255, 255, 0.3) 90%,
    transparent 100%
  );
  transform: translateX(-50%);
}

.glow-effect {
  position: absolute;
  top: -10px;
  left: -10px;
  right: -10px;
  bottom: -10px;
  background: radial-gradient(circle at center, 
    rgba(var(--color-primary-rgb), 0.2) 0%,
    transparent 70%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
  border-radius: 25px;
}

.glow-effect.active {
  opacity: 1;
  animation: pulse-glow 1s ease-in-out infinite alternate;
}

@keyframes pulse-glow {
  from {
    background: radial-gradient(circle at center, 
      rgba(var(--color-primary-rgb), 0.2) 0%,
      transparent 70%
    );
  }
  to {
    background: radial-gradient(circle at center, 
      rgba(var(--color-primary-rgb), 0.4) 0%,
      transparent 70%
    );
  }
}

/* États de jeu */
.pong-canvas[data-status="waiting"] {
  filter: brightness(0.7);
  border-color: #FFC107;
}

.pong-canvas[data-status="finished"] {
  filter: brightness(1.2) saturate(1.3);
  border-color: #4CAF50;
  box-shadow: 0 0 30px rgba(76, 175, 80, 0.5);
}

/* Responsive */
@media (max-width: 768px) {
  .pong-canvas-wrapper {
    transform: scale(0.8);
    transform-origin: center;
  }
}

@media (max-width: 480px) {
  .pong-canvas-wrapper {
    transform: scale(0.65);
  }
}
</style>
