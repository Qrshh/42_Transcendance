<template>
  <div class="ai-game" :class="arenaClass">
    <div v-if="!gameStarted" class="menu">
      <h2 class="menu-title">{{ t.prepareMatch }}</h2>
      <p class="menu-sub">{{ t.adjustSettings }}</p>

      <ul class="settings-list">
        <li>
          <span class="label">{{ t.arenaTheme }}</span>
          <span class="value">{{ arenaLabel }}</span>
        </li>
        <li>
          <span class="label">{{ t.ballSpeed }}</span>
          <span class="value">{{ ballSpeedLabel }}</span>
        </li>
        <li>
          <span class="label">{{ t.ballSize }}</span>
          <span class="value">{{ ballSizeLabel }}</span>
        </li>
        <li>
          <span class="label">{{ t.powerUps }}</span>
          <span class="value">{{ powerUpLabel }}</span>
        </li>
      </ul>

      <div class="difficulty-row">
        <label for="ai-difficulty">{{ t.aiDifficulty }}</label>
        <select id="ai-difficulty" v-model="aiDifficulty" @change="adjustAIDifficulty" class="difficulty-selector">
          <option value="Facile">{{ t.easy }}</option>
          <option value="Normal">{{ t.normal }}</option>
          <option value="Difficile">{{ t.hard }}</option>
        </select>
      </div>

      <div class="menu-actions">
        <button class="btn ghost" type="button" @click="openCustomization">{{ t.customize }}</button>
        <button class="btn primary" type="button" @click="startGame">{{ t.startGame }}</button>
      </div>
    </div>

    <div v-else>
      <!-- Header du jeu IA -->
      <div class="game-header">
        <div class="game-mode-info">
          <h2 class="mode-title">{{ t.aiMode }}</h2>
          <p class="mode-description">{{ t.youVsAI }}</p>
        </div>
        
        <div class="ai-controls">
          <button class="btn ghost" type="button" @click="openCustomization">{{ t.optionsBtn }}</button>
          <div class="control-hint">
            <span class="keys">W/S</span>
            <span class="vs">vs</span>
            <span class="keys">↑/↓</span>
          </div>
          <div class="config-chip">{{ arenaLabel }} • {{ ballSpeedLabel }}</div>
          <button
            class="config-chip"
            type="button"
            title="{{ t.pause }}"
            @click="togglePause"
            :disabled="!canTogglePause"
          >P</button>
          <button
            class="config-chip"
            type="button"
            title="{{ t.fullscreen }}"
            @pointerdown.capture.prevent.stop="toggleFullscreen"
            @click.capture.prevent.stop
          >⤢</button>
        </div>
      </div>

      <!-- Canvas de jeu -->
      <div class="game-canvas-container">
        <PongCanvas
          ref="canvasRef"
          :state="gameState"
          :onMove="handlePlayerMove"
          controls="left"
          :showFullscreenButton="false"
          :countdown="countdownToStart"
          :showResultOverlay="gameStarted"
          :resultActionLabel="gameState.gameOver ? '🔄 ' + t.startGame : ''"
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

        <!-- Indicateurs de performance IA -->
        <div class="ai-performance">
          <div class="performance-item">
            <span class="perf-label">{{ t.aiAccuracy }}</span>
            <div class="perf-bar">
              <div class="perf-fill" :style="{ width: aiAccuracy + '%' }"></div>
            </div>
            <span class="perf-value">{{ aiAccuracy }}%</span>
          </div>
        </div>
      </div>

      <div class="ai-summary">
        <span class="chip">{{ arenaLabel }}</span>
        <span class="chip">{{ ballSpeedLabel }}</span>
        <span class="chip">{{ ballSizeLabel }}</span>
        <span class="chip">PU: {{ powerUpLabel }}</span>
        <span class="chip">{{ acceleratingBall ? t.accelerationOn : t.accelerationOff }}</span>
        <span class="chip">{{ dashEnabled ? t.dashOn : t.dashOff }}</span>
      </div>

      <!-- Statistiques et conseils -->
      <div class="game-footer">
        <div class="game-stats">
          <div class="stat-item">
            <span class="stat-icon">🎯</span>
            <span class="stat-label">{{ t.hits }}</span>
            <span class="stat-value">{{ playerHits }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">🏁</span>
            <span class="stat-label">{{ t.maxScore }}</span>
            <span class="stat-value">{{ targetScore }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">⚡</span>
            <span class="stat-label">{{ t.maxSpeed }}</span>
            <span class="stat-value">{{ Math.abs(gameState.ball.vx).toFixed(1) }}px/s</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">🧠</span>
            <span class="stat-label">{{ t.aiDecisions }}</span>
            <span class="stat-value">{{ aiDecisions }}</span>
          </div>
        </div>

        <div class="game-tips">
          <div class="tip-item">
            <span class="tip-icon">💡</span>
            <span class="tip-text">{{ t.movePaddle }}</span>
          </div>
          <div class="tip-item">
            <span class="tip-icon">🎯</span>
            <span class="tip-text">{{ t.hitEdges }}</span>
          </div>
          <div class="tip-item">
            <span class="tip-icon">⚡</span>
            <span class="tip-text">{{ t.ballSpeedStatus }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>


<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue'
import PongCanvas from '../PongCanvas.vue'
import { createInitialState } from '../ts/state'
import { updateGame } from '../ts/engine'
import { updateAIPaddle } from '../ts/ai'
import { movePaddle } from '../ts/controls'
import { useGameLoop } from '../ts/gameloop'
import { useGameSettings, resolveBallRadius, resolveBallSpeed } from '../../../stores/gameSettings'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../ts/constants'
import { useI18n } from '../../../composables/useI18n'


const {t} = useI18n()

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

const canvasRef = ref<InstanceType<typeof PongCanvas> | null>(null)
const aiDifficulty = ref('Normal')
const aiAccuracy = ref(75)
const playerHits = ref(0)
const aiDecisions = ref(0)
const countdownToStart = ref(0)
let countdownTimer: number | null = null

const fsLatch = ref(false)
let fsLatchTimer: number | null = null
const gameStarted = ref(false)

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

const dashEnabled = computed({
  get: () => settings.paddleDash,
  set: (val: boolean) => {
    markCustom()
    settings.paddleDash = val
    if (gameState.settings) gameState.settings.paddleDash = val
  }
})
const isPaused = computed(() => gameState.status === 'paused')
const canTogglePause = computed(() =>
  gameStarted.value &&
  countdownToStart.value === 0 &&
  !gameState.gameOver &&
  gameState.status !== 'starting'
)
const overlayTitle = computed(() => (isPaused.value ? '⏸ Pause' : '⏳ Préparation…'))
const overlayMessage = computed(() => (isPaused.value ? 'Appuyez sur P pour reprendre' : undefined))

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

useGameLoop(() => {
  if (!gameStarted.value) return
  if (gameState.gameOver) return
  if (countdownToStart.value > 0) return
  if (gameState.status === 'paused') return
  if (gameState.status === 'starting') gameState.status = 'playing'
  if (gameState.status !== 'playing') return
  updateAIPaddle(gameState)
  updateGame(gameState, { accelerating: acceleratingBall.value })
  aiDecisions.value++
  if (Math.random() < 0.1) {
    aiAccuracy.value = Math.max(50, Math.min(95, aiAccuracy.value + (Math.random() - 0.5) * 10))
  }
})

const handlePlayerMove = (player: 'p1' | 'p2', direction: 'up' | 'down' | 'stop' | 'dash') => {
  if (player !== 'p1') return
  if (direction === 'dash' && !dashEnabled.value) return
  movePaddle(gameState, 'p1', direction)
  if (direction !== 'stop') playerHits.value++
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

const adjustAIDifficulty = () => {
  switch (aiDifficulty.value) {
    case 'Facile':
      aiAccuracy.value = 50
      break
    case 'Normal':
      aiAccuracy.value = 65
      break
    case 'Difficile':
      aiAccuracy.value = 80
      break
  }
}

const togglePause = () => {
  if (!canTogglePause.value) return
  gameState.status = isPaused.value ? 'playing' : 'paused'
}

const handlePauseKey = (event: KeyboardEvent) => {
  if (event.key !== 'p' && event.key !== 'P') return
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
  togglePause()
}

const startCountdown = (seconds = 3) => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  if (seconds > 0 && gameState.status !== 'playing') gameState.status = 'starting'
  countdownToStart.value = seconds
  gameState.countdown = countdownToStart.value
  if (seconds <= 0) {
    gameState.status = 'playing'
    gameState.countdown = 0
    return
  }
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

const prepareMatch = (seconds = 3) => {
  gameState.score.player1 = 0
  gameState.score.player2 = 0
  gameState.gameOver = false
  gameState.winner = null
  gameState.ball.x = CANVAS_WIDTH / 2
  gameState.ball.y = CANVAS_HEIGHT / 2
  const base = gameState.baseSpeed ?? resolveBallSpeed(settings.ballSpeed)
  gameState.ball.vx = Math.random() > 0.5 ? base : -base
  gameState.ball.vy = Math.random() > 0.5 ? base : -base
  playerHits.value = 0
  aiDecisions.value = 0
  gameState.status = 'starting'
  startCountdown(seconds)
}

const startGame = () => {
  if (gameStarted.value) return
  gameStarted.value = true
  prepareMatch(3)
}

const resetGame = () => {
  prepareMatch(3)
}

const openCustomization = () => {
  window.dispatchEvent(new Event('open-game-settings'))
}

watch(() => settings.ballSpeed, (val) => {
  const speed = resolveBallSpeed(val)
  gameState.baseSpeed = speed
  if (!gameState.gameOver) {
    gameState.ball.vx = Math.sign(gameState.ball.vx || 1) * speed
    gameState.ball.vy = Math.sign(gameState.ball.vy || 1) * speed
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

watch(() => settings.accelBall, (val) => {
  if (gameState.settings) gameState.settings.accelBall = val
})

watch(() => settings.paddleDash, (val) => {
  if (gameState.settings) gameState.settings.paddleDash = val
})

onMounted(() => {
  window.addEventListener('keydown', handlePauseKey)
})

onBeforeUnmount(() => {
  if (fsLatchTimer) {
    window.clearTimeout(fsLatchTimer)
    fsLatchTimer = null
  }
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  gameState.countdown = 0
  window.removeEventListener('keydown', handlePauseKey)
})
</script>

<style scoped>
.ai-game {
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.6rem;
  box-shadow: 0 18px 50px rgba(0,0,0,.25);
  max-width: 1800px;
  margin: 0 auto;
}

.ai-game.arena-neon {
  background: radial-gradient(circle at top, rgba(79,172,254,0.25), transparent 55%),
              linear-gradient(200deg, rgba(19,23,45,0.92), rgba(8,12,28,0.95));
  border-color: rgba(79,172,254,0.35);
  box-shadow: 0 20px 55px rgba(79,172,254,0.25);
}

.ai-game.arena-cosmic {
  background: radial-gradient(circle at 30% 20%, rgba(168,85,247,0.28), transparent 60%),
              radial-gradient(circle at 70% 80%, rgba(34,211,238,0.22), transparent 65%),
              linear-gradient(210deg, rgba(11,17,32,0.95), rgba(5,8,18,0.98));
  border-color: rgba(168,85,247,0.35);
  box-shadow: 0 25px 60px rgba(168,85,247,0.25);
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

.config-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.chip {
  background: rgba(255,255,255,.12);
  border: 1px solid rgba(255,255,255,.2);
  border-radius: 999px;
  padding: 0.28rem 0.7rem;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
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
.vs { color: var(--color-text); opacity: .65; font-weight: 700; }



/* Header spécifique IA */
.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  margin-bottom:10px;
  background: linear-gradient(135deg, #fff0 0%, var(--color-success-soft) 100%);
  border: 1px solid var(--color-border);
  border-radius: 7px;
}

.ai-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.btn {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 0.5rem 0.85rem;
  background: transparent;
  color: var(--color-text);
  font-weight: 600;
  cursor: pointer;
  transition: transform .15s ease, box-shadow .2s ease;
}

.btn.ghost:hover,
.btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(0,0,0,.18);
}

.difficulty-selector {
  border: 1px solid var(--color-border);
  border-radius: 7px;
  padding: 0.5rem 1rem;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.3s ease;
  background: #1113;
}

.difficulty-selector:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

.btn {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 0.55rem 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform .15s ease, box-shadow .2s ease;
}

.btn.ghost {
  background: transparent;
  color: var(--color-text);
}

.btn:hover { transform: translateY(-1px); }

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


.menu-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
  background: linear-gradient(90deg, #fff, #ffffff, #ffffff);
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
  gap: 0.45rem;
}

.settings-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(51, 51, 51, 0.18);
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 12px;
  padding: 0.65rem 0.95rem;
  color: var(--color-text);
}

.settings-list .label {
  opacity: 0.75;
  font-size: 0.9rem;
}

.settings-list .value {
  font-weight: 700;
}

.difficulty-row {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  background: rgba(51, 51, 51, 0.18);
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 7px;
  padding: 0.75rem 1rem;
}

.difficulty-row label {
  font-weight: 600;
  color: var(--color-text);
  opacity: 0.8;
}

.menu-actions {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.menu-actions .btn {
  flex: 1;
  min-width: 160px;
}

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
  background: rgba(15, 23, 42, 0.22);
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 999px;
  padding: 0.6rem 1rem 0.6rem 0.6rem;
  color: var(--color-text);
}

.toggle input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 44px;
  height: 26px;
  background: rgba(255,255,255,0.16);
  border: 2px solid rgba(148, 163, 184, 0.5);
  border-radius: 999px;
  position: relative;
  cursor: pointer;
  transition: 0.2s ease;
}

.toggle input[type="checkbox"]::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: linear-gradient(180deg, #fff, #e2e8f0);
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.3);
  transition: transform 0.2s ease;
}

.toggle input[type="checkbox"]:checked {
  background: linear-gradient(120deg, #38bdf8, #6366f1);
  border-color: transparent;
  box-shadow: 0 6px 18px rgba(14, 165, 233, 0.35);
}

.toggle input[type="checkbox"]:checked::after {
  transform: translateX(18px);
}

.toggle-text {
  font-weight: 600;
}

.ai-summary {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 10px;
}

.chip {
  background: rgba(255,255,255,.12);
  border: 1px solid rgba(255,255,255,.2);
  border-radius: 999px;
  padding: .35rem .8rem;
  font-size: .8rem;
  font-weight: 600;
  color: var(--color-text);
}

.game-canvas-container {
  position: relative;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 7px;
  padding: 1rem;
  box-shadow: inset 0 2px 10px rgba(0,0,0,0.12);
  overflow: hidden;
  margin-bottom: 10px;
}

.game-canvas-container::before {
  content: "";
  position: absolute;
  inset: 0;
  margin-bottom: 10px;
  pointer-events: none;
  background:
    repeating-linear-gradient(to right, rgba(255,255,255,.04) 0, rgba(255,255,255,.04) 1px, transparent 1px, transparent 24px),
    repeating-linear-gradient(to bottom, rgba(255,255,255,.04) 0, rgba(255,255,255,.04) 1px, transparent 1px, transparent 24px);
}

.game-canvas-container :deep(.pong-wrapper) {
  width: 100%;
  justify-content: center;
}

.game-canvas-container :deep(.pong-stage) {
  width: 100%;
  max-width: 960px;
}

.game-canvas-container :deep(.pong-stage.fullscreen) {
  max-width: 100%;
  height: 100%;
}

.game-canvas-container :deep(.pong-canvas) {
  width: 100%;
  height: 100%;
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
  margin-bottom: 0.7rem;
  background: linear-gradient(90deg, #fff, #b8c6ff);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.overlay-message {
  font-size: 1.05rem;
  color: var(--color-text);
  opacity: 0.9;
  margin-bottom: 1.1rem;
}

.btn-restart {
  padding: 0.75rem 1.4rem;
  background: linear-gradient(180deg, #19c37d, #0ea86b);
  color: #0a1326;
  border: none;
  border-radius: 7px;
  font-weight: 900;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.2s ease;
  box-shadow: 0 12px 24px rgba(25,195,125,.25);
}

.btn-restart:hover {
  transform: translateY(-1px);
  box-shadow: 0 18px 36px rgba(25,195,125,.35);
}

.status-text {
  font-size: 0.8rem;
  padding: 0.25rem 0.75rem;
  border-radius: 7px;
  font-weight: 500;
}

.status-text:not(.ai-status) {
  background: var(--color-info-soft);
  color: var(--color-info);
  border: 1px solid var(--color-info);
}

.ai-status {
  background: var(--color-success-soft);
  color: var(--color-success);
  border: 1px solid var(--color-success);
}

.ai-indicator {
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
}

.ai-pulse {
  display: block;
  width: 10px;
  height: 10px;
  background: var(--color-success);
  border-radius: 50%;
  animation: ai-pulse 2s infinite;
}

@keyframes ai-pulse {
  0% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
  100% { opacity: 1; transform: scale(1); }
}

/* Performance de l'IA */
.ai-performance {
  position: absolute;
  top: 10px;
  right: 10px;
  background: var(--color-overlay-bg);
  padding: 0.75rem;
  border-radius: 7px;
  color: white;
  font-size: 0.8rem;
}

.performance-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.perf-label {
  font-weight: 500;
}

.perf-bar {
  width: 60px;
  height: 6px;
  background: rgba(var(--color-background-rgb), .2);
  border-radius: 7px;
  overflow: hidden;
}

.perf-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-danger), var(--color-success));
  transition: width 0.5s ease;
}

.perf-value {
  color: var(--color-success);
}

/* Statistiques */
.game-stats {
  display: flex;
  gap: 1.5rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 7px;
  font-size: 0.9rem;
}

.stat-icon {
  font-size: 1.1rem;
}

.stat-label {
  color: var(--color-text);
  opacity: 0.8;
}

.stat-value {
  font-weight: 700;
  color: var(--color-primary);
}

.game-tips {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.tip-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(var(--color-primary-rgb), 0.1);
  border: 1px solid var(--color-primary);
  border-radius: 7px;
  font-size: 0.85rem;
}

.tip-icon {
  font-size: 1rem;
}

.tip-text {
  color: var(--color-text);
  opacity: 0.8;
}

/* Responsive */
@media (max-width: 768px) {
  .ai-game {
    padding: 1rem;
    gap: 1rem;
  }
  .menu-actions {
    flex-direction: column;
  }
  
  
  .game-header {
    flex-direction: column;
    gap: 1rem;
  }
  
  .game-stats {
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
  
  .game-tips {
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
}
</style>
