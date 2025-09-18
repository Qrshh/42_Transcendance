<template>
  <div class="local-game" :class="arenaClass">

    <div v-if="!gameStarted" class="menu" :class="arenaClass">
      <h2 class="menu-title">⚙️ Paramètres de la partie</h2>
      <p class="menu-sub">Ces réglages sont appliqués à tous les modes locaux.</p>

      <ul class="settings-list">
        <li>
          <span class="label">Thème d'arène</span>
          <span class="value">{{ arenaLabel }}</span>
        </li>
        <li>
          <span class="label">Vitesse de balle</span>
          <span class="value">{{ ballSpeedLabel }}</span>
        </li>
        <li>
          <span class="label">Taille de balle</span>
          <span class="value">{{ ballSizeLabel }}</span>
        </li>
        <li>
          <span class="label">Power-ups</span>
          <span class="value">{{ powerUpLabel }}</span>
        </li>
      </ul>

      <div class="toggle-row">
        <label class="toggle">
          <input type="checkbox" v-model="acceleratingBall" />
          <span class="slider"></span>
          <span class="toggle-text">🚀 Balle accélérante</span>
        </label>
        <label class="toggle">
          <input type="checkbox" v-model="dashPaddle" />
          <span class="slider"></span>
          <span class="toggle-text">⚡ Dash des paddles</span>
        </label>
      </div>

      <div class="menu-actions">
        <button class="btn ghost" type="button" @click="openCustomization">Personnaliser…</button>
        <button class="btn primary" type="button" @click="startMatch">▶️ Lancer la partie</button>
      </div>
    </div>

    <div v-else>
      <div class="game-header">
        <div class="game-mode-info">
          <h2 class="mode-title">🏠 Mode Local</h2>
          <p class="mode-description">Joueur 1 vs Joueur 2</p>
        </div>

        <div class="game-controls">
          <div class="control-hint">
            <span class="keys">W/S</span>
            <span class="vs">vs</span>
            <span class="keys">↑/↓</span>
          </div>
          <div class="config-chip">{{ arenaLabel }} • {{ ballSpeedLabel }}</div>
          <button
            class="btn"
            type="button"
            title="Pause (P)"
            @click="togglePause"
            :disabled="!canTogglePause"
          >P</button>
          <button
            class="btn"
            type="button"
            title="Plein écran"
            @pointerdown.capture.prevent.stop="toggleFullscreen"
            @click.capture.prevent.stop
          >⤢</button>
        </div>
      </div>

      <div class="game-canvas-container">
      <PongCanvas
        ref="canvasRef"
        :state="gameState"
        :onMove="handlePlayerMove"
        controls="both"
        :showFullscreenButton="false"
        :countdown="countdownToStart"
        :resultActionLabel="gameState.gameOver ? '🔄 Nouvelle partie' : ''"
        :onResultAction="resetGame"
      />

        <div
          v-if="!gameState.gameOver && gameState.status !== 'playing' && countdownToStart === 0"
          class="game-overlay"
        >
          <div class="overlay-content">
            <h3 class="overlay-title">{{ overlayTitle }}</h3>
            <p v-if="overlayMessage" class="overlay-message">{{ overlayMessage }}</p>
          </div>
        </div>

      </div>

      <div class="game-footer">
        <div class="game-instructions">
          <div class="instruction-item">
            <span class="instruction-icon">⚡</span>
            <span class="instruction-text">Première à {{ targetScore }} points gagne</span>
          </div>
          <div class="instruction-item">
            <span class="instruction-icon">🎯</span>
            <span class="instruction-text">
              {{ acceleratingBall ? 'La balle accélère après chaque échange' : 'Vitesse constante' }}
            </span>
          </div>
          <div class="instruction-item" v-if="dashPaddle">
            <span class="instruction-icon">⚡</span>
            <span class="instruction-text">Dash disponible (Espace / Entrée)</span>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, computed, ref, watch } from 'vue'
import PongCanvas from '../PongCanvas.vue'
import { createInitialState } from '../ts/state'
import { updateGame } from '../ts/engine'
import { movePaddle } from '../ts/controls'
import { useGameLoop } from '../ts/gameloop'
import { useGameSettings, resolveBallRadius, resolveBallSpeed } from '../../../stores/gameSettings'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../ts/constants'

const { settings } = useGameSettings()

const gameState = createInitialState({
  arena: settings.arena,
  ballSpeed: settings.ballSpeed,
  ballSize: settings.ballSize,
  baseSpeed: resolveBallSpeed(settings.ballSpeed),
  ballRadius: resolveBallRadius(settings.ballSize),
  accelBall: settings.accelBall,
  paddleDash: settings.paddleDash,
  powerUps: settings.powerUps,
})

gameState.usernames = { p1: 'Joueur 1', p2: 'Joueur 2' }
gameState.icons = { p1: '🎮', p2: '🎯' }

const canvasRef = ref<InstanceType<typeof PongCanvas> | null>(null)
const gameStarted = ref(false)
const countdownToStart = ref(0)
let countdownTimer: number | null = null
const fsLatch = ref(false)
let fsLatchTimer: number | null = null

const markCustom = () => {
  if (settings.preset !== 'custom') settings.preset = 'custom'
}

const acceleratingBall = computed({
  get: () => settings.accelBall,
  set: (val: boolean) => {
    markCustom()
    settings.accelBall = val
    if (gameState.settings) gameState.settings.accelBall = val
  }
})

const dashPaddle = computed({
  get: () => settings.paddleDash,
  set: (val: boolean) => {
    markCustom()
    settings.paddleDash = val
    if (gameState.settings) gameState.settings.paddleDash = val
  }
})

const arenaClass = computed(() => `arena-${settings.arena}`)

const arenaLabel = computed(() => {
  switch (settings.arena) {
    case 'neon': return 'Neon futuriste'
    case 'cosmic': return 'Cosmos'
    default: return 'Classique 1972'
  }
})

const ballSpeedLabel = computed(() => {
  switch (settings.ballSpeed) {
    case 'fast': return 'Rapide'
    case 'extreme': return 'Extrême'
    default: return 'Normale'
  }
})

const ballSizeLabel = computed(() => settings.ballSize === 'large' ? 'Large' : 'Standard')

const powerUpLabel = computed(() => {
  switch (settings.powerUps) {
    case 'rare': return 'Occasionnel'
    case 'frequent': return 'Fréquent'
    default: return 'Désactivé'
  }
})

const targetScore = computed(() => gameState.targetScore ?? 5)
const isPaused = computed(() => gameState.status === 'paused')
const canTogglePause = computed(() =>
  gameStarted.value &&
  !gameState.gameOver &&
  countdownToStart.value === 0 &&
  gameState.status !== 'starting'
)
const overlayTitle = computed(() => {
  if (isPaused.value) return '⏸ Pause'
  if (gameState.status === 'waiting') return '🕒 En attente…'
  if (gameState.status === 'starting') return '⏳ Préparation…'
  return '⏳ Préparation…'
})
const overlayMessage = computed(() => {
  if (isPaused.value) return 'Appuyez sur P pour reprendre'
  if (gameState.status === 'waiting') return 'En attente du lancement de la partie'
  return undefined
})

useGameLoop(() => {
  if (!gameStarted.value) return
  if (gameState.gameOver) return
  if (countdownToStart.value > 0) return
  if (gameState.status === 'paused') return
  if (gameState.status === 'starting') gameState.status = 'playing'
  if (gameState.status !== 'playing') return
  updateGame(gameState, { accelerating: acceleratingBall.value })
})

const handlePlayerMove = (player: 'p1' | 'p2', direction: 'up' | 'down' | 'stop' | 'dash') => {
  if (direction === 'dash' && !dashPaddle.value) return
  movePaddle(gameState, player, direction)
}

const toggleFullscreen = () => {
  if (fsLatch.value) return
  fsLatch.value = true
  canvasRef.value?.toggleFs()
  if (fsLatchTimer) window.clearTimeout(fsLatchTimer)
  fsLatchTimer = window.setTimeout(() => {
    fsLatch.value = false
    fsLatchTimer = null
  }, 400)
}

const togglePause = () => {
  if (!canTogglePause.value) return
  if (isPaused.value) {
    gameState.status = 'playing'
  } else {
    gameState.status = 'paused'
  }
}

const handlePauseKey = (event: KeyboardEvent) => {
  if (event.key !== 'p' && event.key !== 'P') return
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
  togglePause()
}

const openCustomization = () => {
  window.dispatchEvent(new Event('open-game-settings'))
}

const startLocalCountdown = (sec = 3) => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  if (sec > 0 && gameState.status !== 'playing') gameState.status = 'starting'
  countdownToStart.value = sec
  gameState.countdown = countdownToStart.value
  countdownTimer = window.setInterval(() => {
    countdownToStart.value -= 1
    gameState.countdown = Math.max(countdownToStart.value, 0)
    if (countdownToStart.value <= 0 && countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
      gameState.status = 'playing'
      gameState.countdown = 0
    }
  }, 1000) as unknown as number
}

const startMatch = () => {
  if (gameStarted.value) return
  gameStarted.value = true
  gameState.gameOver = false
  gameState.winner = null
  gameState.status = 'starting'
  startLocalCountdown(3)
}

const resetGame = () => {
  gameState.score.player1 = 0
  gameState.score.player2 = 0
  gameState.gameOver = false
  gameState.winner = null
  gameState.status = 'starting'
  gameState.ball.x = CANVAS_WIDTH / 2
  gameState.ball.y = CANVAS_HEIGHT / 2
  const base = gameState.baseSpeed ?? resolveBallSpeed(settings.ballSpeed)
  gameState.ball.vx = Math.random() > 0.5 ? base : -base
  gameState.ball.vy = Math.random() > 0.5 ? base : -base
  startLocalCountdown(3)
}

watch(() => settings.ballSpeed, (val) => {
  const speed = resolveBallSpeed(val)
  gameState.baseSpeed = speed
  if (!gameStarted.value) {
    gameState.ball.vx = speed
    gameState.ball.vy = speed
  }
  if (gameState.settings) gameState.settings.ballSpeed = val
})

watch(() => settings.ballSize, (val) => {
  const radius = resolveBallRadius(val)
  gameState.ball.radius = radius
  if (gameState.settings) gameState.settings.ballSize = val
})

watch(() => settings.arena, (val) => {
  if (gameState.settings) gameState.settings.arena = val
})

watch(() => settings.powerUps, (val) => {
  gameState.powerUpsFrequency = val
  if (gameState.settings) gameState.settings.powerUps = val
})

watch(gameStarted, (to, from) => {
  if (to && !from) {
    gameState.status = 'starting'
    startLocalCountdown(3)
  }
})

onMounted(() => {
  window.addEventListener('keydown', handlePauseKey)
})

onBeforeUnmount(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  if (fsLatchTimer) {
    window.clearTimeout(fsLatchTimer)
    fsLatchTimer = null
  }
  gameState.countdown = 0
  window.removeEventListener('keydown', handlePauseKey)
})
</script>

<style scoped>
.local-game {
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
  background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03));
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.6rem;
  box-shadow: 0 18px 50px rgba(0,0,0,.25);
  max-width: 1800px;
  margin: 0 auto;
}

.local-game.arena-neon {
  background: radial-gradient(circle at top, rgba(79,172,254,0.25), transparent 55%),
              linear-gradient(200deg, rgba(19,23,45,0.92), rgba(8,12,28,0.95));
  border-color: rgba(79,172,254,0.35);
  box-shadow: 0 20px 55px rgba(79,172,254,0.25);
}

.local-game.arena-cosmic {
  background: radial-gradient(circle at 30% 20%, rgba(168,85,247,0.28), transparent 60%),
              radial-gradient(circle at 70% 80%, rgba(34,211,238,0.22), transparent 65%),
              linear-gradient(210deg, rgba(11,17,32,0.95), rgba(5,8,18,0.98));
  border-color: rgba(168,85,247,0.35);
  box-shadow: 0 25px 60px rgba(168,85,247,0.25);
}

.menu {
  color: var(--color-text);
  background: linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.04));
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.6rem;
  box-shadow: 0 12px 36px rgba(0,0,0,.25);
  max-width: 640px;
  margin: 0 auto;
  display: grid;
  gap: 1rem;
}

.menu.arena-neon {
  background: radial-gradient(circle at top, rgba(79,172,254,0.25), transparent 55%),
              linear-gradient(200deg, rgba(19,23,45,0.88), rgba(8,12,28,0.92));
  border-color: rgba(79,172,254,0.35);
  box-shadow: 0 18px 45px rgba(79,172,254,0.25);
}

.menu.arena-cosmic {
  background: radial-gradient(circle at 30% 20%, rgba(168,85,247,0.24), transparent 60%),
              radial-gradient(circle at 70% 80%, rgba(34,211,238,0.18), transparent 65%),
              linear-gradient(210deg, rgba(11,17,32,0.9), rgba(5,8,18,0.94));
  border-color: rgba(168,85,247,0.35);
  box-shadow: 0 20px 48px rgba(168,85,247,0.25);
}

.menu-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
  background: linear-gradient(90deg, #fff, #b8c6ff, #9fe7ff);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.menu-sub {
  margin: 0;
  color: var(--color-text);
  opacity: 0.75;
}

.settings-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.4rem;
}

.settings-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(0,0,0,.2);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 0.6rem 0.9rem;
}

.settings-list .label { opacity: 0.7; font-size: 0.9rem; }
.settings-list .value { font-weight: 700; }

.toggle-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--color-text);
  background: rgba(0,0,0,.2);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 0.6rem 1rem 0.6rem 0.6rem;
}

.toggle input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 44px;
  height: 26px;
  background: rgba(255,255,255,.15);
  border: 2px solid var(--color-border);
  border-radius: 999px;
  position: relative;
  cursor: pointer;
  transition: .18s ease;
}

.toggle input[type="checkbox"]::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: linear-gradient(180deg, #fff, #dfe6ff);
  box-shadow: 0 4px 10px rgba(0,0,0,.3);
  transition: transform .18s ease;
}

.toggle input[type="checkbox"]:checked {
  background: linear-gradient(90deg, #6a5cff, #25c6ff);
  border-color: transparent;
  box-shadow: 0 6px 16px rgba(89,102,255,.35);
}

.toggle input[type="checkbox"]:checked::after {
  transform: translateX(18px);
}

.toggle-text {
  font-weight: 600;
}

.menu-actions {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}

.btn {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 0.7rem 1.2rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform .15s ease, box-shadow .2s ease;
}

.btn.ghost {
  background: transparent;
  color: var(--color-text);
}

.btn.primary {
  background: var(--gradient-brand);
  color: #0b132b;
  border-color: transparent;
  box-shadow: 0 14px 28px rgba(79, 172, 254, 0.35);
}

.btn:hover { transform: translateY(-1px); }

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: .9rem 1rem;
  background: linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.03));
  border: 1px solid var(--color-border);
  border-radius: 7px;
  box-shadow: 0 8px 24px rgba(0,0,0,.18);
}

.mode-title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 800;
  background: linear-gradient(90deg, #b9c4ff, #9fe7ff);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.mode-description {
  color: var(--color-text);
  opacity: .8;
  margin: .15rem 0 0;
  font-size: .95rem;
}

.game-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.control-hint {
  display: flex;
  align-items: center;
  gap: .75rem;
  padding: .45rem .8rem;
  background: rgba(0,0,0,.25);
  border: 1px solid var(--color-border);
  border-radius: 999px;
}

.keys {
  background: linear-gradient(90deg, #6a5cff, #25c6ff);
  color: #fff;
  padding: .2rem .6rem;
  border-radius: 7px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-weight: 800;
  font-size: .82rem;
  letter-spacing: .015em;
  box-shadow: inset 0 -2px 0 rgba(255,255,255,.08);
}

.config-chip {
  background: rgba(255,255,255,.12);
  border: 1px solid rgba(255,255,255,.2);
  border-radius: 999px;
  padding: .35rem .9rem;
  font-size: .85rem;
  font-weight: 600;
  color: var(--color-text);
}

.vs { color: var(--color-text); opacity: .65; font-weight: 700; }

.game-canvas-container {
  position: relative;
  display: flex;
  justify-content: center;
  background:
    radial-gradient(500px 160px at 50% 0%, rgba(255,255,255,.06), transparent 70%),
    linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.03));
  border: 1px solid var(--color-border);
  border-radius: 7px;
  padding: 1rem;
  box-shadow: inset 0 2px 10px rgba(0,0,0,.12);
  overflow: hidden;
}

.game-canvas-container::before{
  content: "";
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient( to right, rgba(255,255,255,.04) 0, rgba(255,255,255,.04) 1px, transparent 1px, transparent 22px ),
    repeating-linear-gradient( to bottom, rgba(255,255,255,.03) 0, rgba(255,255,255,.03) 1px, transparent 1px, transparent 22px );
  pointer-events: none;
}

.game-overlay {
  position: absolute;
  inset: 0;
  background: rgba(4, 6, 14, 0.66);
  display: grid;
  place-items: center;
  border-radius: 7px;
  z-index: 10;
}

.overlay-title {
  font-size: clamp(1.4rem, 1.4rem + .5vw, 2rem);
  font-weight: 900;
  margin-bottom: .7rem;
  background: linear-gradient(90deg, #fff, #b8c6ff);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.overlay-message {
  font-size: 1.05rem;
  color: var(--color-text);
  opacity: .9;
  margin-bottom: 1.1rem;
}

.btn-restart {
  padding: .75rem 1.4rem;
  background: linear-gradient(180deg, #19c37d, #0ea86b);
  color: #0a1326;
  border: none;
  border-radius: 7px;
  font-weight: 900;
  cursor: pointer;
  transition: transform .15s ease, box-shadow .2s ease;
  box-shadow: 0 12px 24px rgba(25,195,125,.25);
}

.btn-restart:hover { transform: translateY(-1px); box-shadow: 0 18px 36px rgba(25,195,125,.35); }

.game-footer { display: flex; justify-content: center; }

.game-instructions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
}

.instruction-item {
  display: flex;
  align-items: center;
  gap: .5rem;
  padding: .65rem .9rem;
  background: linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.03));
  border: 1px solid var(--color-border);
  border-radius: 7px;
  font-size: .95rem;
}

.instruction-icon { font-size: 1.05rem; }
.instruction-text { color: var(--color-text); opacity: .9; }

@media (max-width: 820px){
  .local-game { padding: 1.1rem; gap: 1.1rem; }
  .game-header { flex-direction: column; gap: .8rem; text-align: center; }
  .menu { padding: 1.1rem; }
}

@media (max-width: 520px){
  .keys { font-size: .78rem; padding: .18rem .52rem; }
  .control-hint { flex-wrap: wrap; justify-content: center; }
  .instruction-item { font-size: .9rem; }
  .game-canvas-container { padding: 0.75rem; }
}
</style>
