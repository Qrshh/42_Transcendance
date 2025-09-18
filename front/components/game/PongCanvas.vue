<template>
  <div
    ref="wrapperEl"
    class="pong-wrapper"
    :class="[
      arenaClass,
      { 'fullscreen-active': isFullscreenNative, 'fullscreen-shim': isFullscreenShim }
    ]"
  >
    <div
      class="pong-stage"
      :class="{ fullscreen: isFullscreenActive }"
      :style="stageStyle"
    >
      <div  class="score-overlay">
        <div class="score-board" :class="{ classic: isClassicArena }">
          <div class="player-score">
            <div class="player-info">
              <span class="player-icon">{{ leftPlayer.icon }}</span>
              <span class="player-name">{{ leftPlayer.name }}</span>
            </div>
            <div class="score-value player1">{{ normalizedScore.player1 }}</div>
          </div>

          <div class="score-separator">
            <span class="vs-text">VS</span>
          </div>

          <div class="player-score">
            <div class="player-info">
              <span class="player-name">{{ rightPlayer.name }}</span>
              <span class="player-icon">{{ rightPlayer.icon }}</span>
            </div>
            <div class="score-value player2">{{ normalizedScore.player2 }}</div>
          </div>
        </div>
      <div v-if="targetScoreLabel && !isClassicArena" class="score-target">Objectif : {{ targetScoreLabel }}</div>
    </div>

    <div v-if="isClassicArena" class="classic-center-line" aria-hidden="true"></div>

    <div v-if="resultOverlayVisible" class="result-overlay">
      <div class="result-box">
        <h3 class="result-title">{{ finishTitle }}</h3>
        <p class="result-message">{{ winnerMessage }}</p>
        <button
          v-if="hasResultAction"
          type="button"
          class="result-button"
          @click="props.onResultAction?.()"
        >
          {{ props.resultActionLabel }}
        </button>
      </div>
    </div>

    <canvas
      ref="canvasEl"
      class="pong-canvas"
        :width="LOGICAL_WIDTH"
        :height="LOGICAL_HEIGHT"
        tabindex="0"
        aria-label="Surface de jeu Pong"
      />

      <button
        v-if="showFullscreenButtonComputed"
        class="fullscreen-btn"
        type="button"
        @click="toggleFullscreen"
        :aria-label="isFullscreenActive ? 'Quitter le plein écran' : 'Passer en plein écran'"
      >
        <span v-if="!isFullscreenActive">⤢</span>
        <span v-else>⤡</span>
      </button>

      <div v-if="countdownOverlayVisible" class="canvas-countdown">
        <div class="countdown-box">
          <div class="countdown-label">{{ props.countdownLabel }}</div>
          <div class="countdown-value">{{ countdownValue }}</div>
        </div>
      </div>

      <div v-if="showTouchControls" class="touch-controls" aria-hidden="true">
        <div
          v-if="controlsLeft"
          class="touch-area left"
          @pointerdown.prevent.stop="onTouchAreaDown('p1', $event)"
          @pointermove.prevent.stop="onTouchAreaMove('p1', $event)"
          @pointerup.prevent.stop="onTouchAreaUp('p1', $event)"
          @pointercancel.prevent.stop="onTouchAreaUp('p1', $event)"
          @pointerleave.prevent.stop="onTouchAreaUp('p1', $event)"
        ></div>
        <div
          v-if="controlsRight"
          class="touch-area right"
          @pointerdown.prevent.stop="onTouchAreaDown('p2', $event)"
          @pointermove.prevent.stop="onTouchAreaMove('p2', $event)"
          @pointerup.prevent.stop="onTouchAreaUp('p2', $event)"
          @pointercancel.prevent.stop="onTouchAreaUp('p2', $event)"
          @pointerleave.prevent.stop="onTouchAreaUp('p2', $event)"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, withDefaults } from 'vue'
import type { GameState } from './ts/types'
import { drawGameState } from './ts/drawing'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './ts/constants'

const props = withDefaults(defineProps<{
  state: GameState,
  onMove: (player: 'p1' | 'p2', direction: 'up' | 'down' | 'stop' | 'dash') => void,
  controls?: 'auto' | 'both' | 'left' | 'right' | 'none',
  showFullscreenButton?: boolean,
  countdown?: number,
  countdownLabel?: string,
  showResultOverlay?: boolean,
  resultActionLabel?: string,
  onResultAction?: () => void
}>(), {
  controls: 'auto',
  showFullscreenButton: true,
  countdown: 0,
  countdownLabel: 'Début dans',
  showResultOverlay: true,
  resultActionLabel: undefined,
  onResultAction: undefined
})

const LOGICAL_WIDTH = CANVAS_WIDTH
const LOGICAL_HEIGHT = CANVAS_HEIGHT

const wrapperEl = ref<HTMLDivElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)

const isTouch = ref(false)
const isFullscreenNative = ref(false)
const isFullscreenShim = ref(false)
const supportsNativeFullscreen = ref(false)

const arenaTheme = computed(() => props.state?.settings?.arena ?? 'classic')
const arenaClass = computed(() => `arena-${arenaTheme.value}`)
const isClassicArena = computed(() => arenaTheme.value === 'classic')

const controlsMode = computed(() => props.controls || 'auto')
const controlsLeft = computed(() => {
  const mode = controlsMode.value
  if (mode === 'none') return false
  if (mode === 'left') return true
  if (mode === 'right') return false
  return true // auto & both
})
const controlsRight = computed(() => {
  const mode = controlsMode.value
  if (mode === 'none') return false
  if (mode === 'right') return true
  if (mode === 'left') return false
  return true
})

const isFullscreenActive = computed(() => isFullscreenNative.value || isFullscreenShim.value)

const stageStyle = computed(() => ({
  '--canvas-aspect': (LOGICAL_WIDTH / LOGICAL_HEIGHT).toString(),
  '--canvas-max-width': `${LOGICAL_WIDTH}px`
}))

const showFullscreenButtonComputed = computed(() => {
  if (isFullscreenActive.value) return true
  return props.showFullscreenButton && (supportsNativeFullscreen.value || isTouch.value)
})

const showTouchControls = computed(() =>
  isTouch.value && (controlsLeft.value || controlsRight.value)
)

const normalizeScoreValue = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number.parseInt(String(value ?? '').trim(), 10)
  return Number.isNaN(parsed) ? 0 : parsed
}

const normalizedScore = computed(() => {
  const raw = props.state?.score as (GameState['score'] & { l?: unknown; r?: unknown }) | undefined
  const left = raw?.player1 ?? (raw as { l?: unknown } | undefined)?.l ?? 0
  const right = raw?.player2 ?? (raw as { r?: unknown } | undefined)?.r ?? 0
  return {
    player1: normalizeScoreValue(left),
    player2: normalizeScoreValue(right)
  }
})

const leftPlayer = computed(() => ({
  name: props.state?.usernames?.p1 ?? 'Joueur 1',
  icon: props.state?.icons?.p1 ?? '🎮'
}))

const rightPlayer = computed(() => ({
  name: props.state?.usernames?.p2 ?? 'Joueur 2',
  icon: props.state?.icons?.p2 ?? '🎯'
}))

const targetScoreLabel = computed(() => props.state?.targetScore ?? null)

const scoreboardVisible = computed(() => Boolean(props.state))
const countdownValue = computed(() => Math.max(0, Math.ceil(props.countdown ?? (props.state?.countdown ?? 0))))
const countdownActive = computed(() => countdownValue.value > 0)
const countdownOverlayVisible = computed(() => countdownActive.value)

const showResultOverlay = computed(() => props.showResultOverlay !== false)
const isGameFinished = computed(() => Boolean(props.state?.gameOver || props.state?.status === 'finished'))
const finishTitle = computed(() => (isGameFinished.value ? '🎉 Partie terminée !' : ''))

const winnerMessage = computed(() => {
  if (!isGameFinished.value) return ''
  const score = props.state?.score
  const usernames = props.state?.usernames ?? {}
  const icons = props.state?.icons ?? { p1: '🎮', p2: '🎯' }

  const winnerRaw = props.state?.winner
  if (typeof winnerRaw === 'string' && winnerRaw.trim().length) {
    const lower = winnerRaw.toLowerCase()
    if (lower.includes('1')) return `${icons.p1 ?? '🎮'} ${usernames.p1 ?? 'Joueur 1'} remporte la victoire !`
    if (lower.includes('2')) return `${icons.p2 ?? '🎯'} ${usernames.p2 ?? 'Joueur 2'} remporte la victoire !`
    return winnerRaw
  }

  const p1Score = Number(score?.player1 ?? 0)
  const p2Score = Number(score?.player2 ?? 0)
  if (p1Score === p2Score) return '🤝 Égalité parfaite !'

  const winnerSide: 'p1' | 'p2' = p1Score > p2Score ? 'p1' : 'p2'
  const fallbackName = winnerSide === 'p1' ? 'Joueur 1' : 'Joueur 2'
  const name = usernames[winnerSide] ?? fallbackName
  const icon = icons[winnerSide] ?? (winnerSide === 'p1' ? '🎮' : '🎯')
  return `${icon} ${name} remporte la victoire !`
})

const resultOverlayVisible = computed(() => showResultOverlay.value && isGameFinished.value)
const hasResultAction = computed(() => typeof props.resultActionLabel === 'string' && props.resultActionLabel.length > 0 && typeof props.onResultAction === 'function')

const activeDirections = new Map<'p1' | 'p2', 'up' | 'down'>()
const touchPointers = new Map<'p1' | 'p2', number>()
const lastTouchTap = new Map<'p1' | 'p2', { time: number; direction: 'up' | 'down' }>()
const DOUBLE_TAP_THRESHOLD_MS = 360
let rafId: number | null = null
let vhListener: (() => void) | null = null

const updateVh = () => {
  if (typeof window === 'undefined') return
  const vh = window.visualViewport ? window.visualViewport.height * 0.01 : window.innerHeight * 0.01
  document.documentElement.style.setProperty('--vh', `${vh}px`)
}

const press = (player: 'p1' | 'p2', direction: 'up' | 'down') => {
  if ((player === 'p1' && !controlsLeft.value) || (player === 'p2' && !controlsRight.value)) return
  if (direction === 'up' || direction === 'down') {
    const current = activeDirections.get(player)
    if (current === direction) return
    activeDirections.set(player, direction)
  }
  props.onMove(player, direction)
}

const release = (player: 'p1' | 'p2') => {
  if (!activeDirections.has(player)) return
  activeDirections.delete(player)
  props.onMove(player, 'stop')
}

const releaseAll = () => {
  release('p1')
  release('p2')
  touchPointers.clear()
  lastTouchTap.clear()
}

const updateTouchDirection = (player: 'p1' | 'p2', clientY: number, target?: EventTarget | null): 'up' | 'down' | null => {
  const el = target as HTMLElement | null
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (!rect.height) return null
  const midY = rect.top + rect.height / 2
  const direction = clientY < midY ? 'up' : 'down'
  press(player, direction)
  return direction
}

const registerTouchTap = (player: 'p1' | 'p2', direction: 'up' | 'down' | null, stamp: number | undefined) => {
  if (!direction) return
  let time = typeof stamp === 'number' && Number.isFinite(stamp) ? stamp : undefined
  if (time === undefined) {
    time = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now()
  }
  const last = lastTouchTap.get(player)
  if (last && time - last.time <= DOUBLE_TAP_THRESHOLD_MS && last.direction === direction) {
    props.onMove(player, 'dash')
    lastTouchTap.delete(player)
    return
  }
  lastTouchTap.set(player, { time, direction })
}

const onTouchAreaDown = (player: 'p1' | 'p2', event: PointerEvent) => {
  if ((player === 'p1' && !controlsLeft.value) || (player === 'p2' && !controlsRight.value)) return

  touchPointers.set(player, event.pointerId)
  const target = event.currentTarget as HTMLElement | null
  target?.setPointerCapture?.(event.pointerId)
  const direction = updateTouchDirection(player, event.clientY, target)

  if (isTouch.value) {
    const pointerType = (event.pointerType || '').toLowerCase()
    const isTouchLike = pointerType === '' || pointerType === 'touch' || pointerType === 'pen'
    if (isTouchLike) registerTouchTap(player, direction, event.timeStamp)
  }
}

const onTouchAreaMove = (player: 'p1' | 'p2', event: PointerEvent) => {
  const pointerId = touchPointers.get(player)
  if (pointerId === undefined || pointerId !== event.pointerId) return
  updateTouchDirection(player, event.clientY, event.currentTarget)
}

const onTouchAreaUp = (player: 'p1' | 'p2', event: PointerEvent) => {
  const pointerId = touchPointers.get(player)
  if (pointerId === undefined || pointerId !== event.pointerId) return
  const target = event.currentTarget as HTMLElement | null
  target?.releasePointerCapture?.(event.pointerId)
  touchPointers.delete(player)
  release(player)
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (['ArrowUp', 'ArrowDown', 'w', 'W', 's', 'S', ' ', 'Spacebar', 'Enter'].includes(e.key)) e.preventDefault()
  if (controlsLeft.value && (e.key === 'w' || e.key === 'W')) props.onMove('p1', 'up')
  if (controlsLeft.value && (e.key === 's' || e.key === 'S')) props.onMove('p1', 'down')
  if (controlsRight.value && e.key === 'ArrowUp') props.onMove('p2', 'up')
  if (controlsRight.value && e.key === 'ArrowDown') props.onMove('p2', 'down')
  if (controlsLeft.value && e.code === 'Space') props.onMove('p1', 'dash')
  if (controlsRight.value && e.code === 'Enter') props.onMove('p2', 'dash')
}

const handleKeyUp = (e: KeyboardEvent) => {
  if (controlsLeft.value && ['w', 'W', 's', 'S'].includes(e.key)) props.onMove('p1', 'stop')
  if (controlsRight.value && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) props.onMove('p2', 'stop')
}

const drawFrame = () => {
  const canvas = canvasEl.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  drawGameState(ctx, props.state)
  rafId = requestAnimationFrame(drawFrame)
}

const enterFullscreen = async () => {
  const wrapper = wrapperEl.value
  if (!wrapper) return
  if (supportsNativeFullscreen.value && wrapper.requestFullscreen) {
    try {
      if (typeof wrapper.focus === 'function') wrapper.focus()
      await wrapper.requestFullscreen()
      return
    } catch (err) {
      console.warn('[PongCanvas] Native fullscreen failed', err)
      isFullscreenShim.value = true
      document.body.classList.add('no-scroll')
      updateVh()
      return
    }
  }
  isFullscreenShim.value = true
  document.body.classList.add('no-scroll')
  updateVh()
}

const exitFullscreen = async () => {
  if (isFullscreenShim.value) {
    isFullscreenShim.value = false
    document.body.classList.remove('no-scroll')
    return
  }
  if (document.fullscreenElement && document.exitFullscreen) {
    try {
      await document.exitFullscreen()
    } catch (err) {
      console.warn('[PongCanvas] Exit fullscreen failed', err)
    }
  }
}

const toggleFullscreen = () => {
  if (isFullscreenActive.value) exitFullscreen()
  else enterFullscreen()
}

const onFullscreenChange = () => {
  const wrapper = wrapperEl.value
  isFullscreenNative.value = !!wrapper && document.fullscreenElement === wrapper
  if (!isFullscreenNative.value) {
    document.body.classList.remove('no-scroll')
    isFullscreenShim.value = false
    releaseAll()
  }
  updateVh()
}

const handleGlobalPointerEnd = () => releaseAll()

onMounted(() => {
  supportsNativeFullscreen.value = typeof document !== 'undefined' && !!document.fullscreenEnabled
  try {
    isTouch.value =
      ('ontouchstart' in window) ||
      (window.matchMedia && window.matchMedia('(hover: none)').matches) ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
  } catch {
    isTouch.value = false
  }

  updateVh()
  vhListener = () => updateVh()
  window.addEventListener('resize', vhListener)
  window.visualViewport?.addEventListener('resize', vhListener)

  canvasEl.value?.focus()

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('pointerup', handleGlobalPointerEnd)
  window.addEventListener('pointercancel', handleGlobalPointerEnd)
  window.addEventListener('touchend', handleGlobalPointerEnd)
  window.addEventListener('touchcancel', handleGlobalPointerEnd)
  window.addEventListener('blur', releaseAll)
  document.addEventListener('fullscreenchange', onFullscreenChange)

  rafId = requestAnimationFrame(drawFrame)
})

onUnmounted(() => {
  if (vhListener) {
    window.removeEventListener('resize', vhListener)
    window.visualViewport?.removeEventListener?.('resize', vhListener)
  }

  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  window.removeEventListener('pointerup', handleGlobalPointerEnd)
  window.removeEventListener('pointercancel', handleGlobalPointerEnd)
  window.removeEventListener('touchend', handleGlobalPointerEnd)
  window.removeEventListener('touchcancel', handleGlobalPointerEnd)
  window.removeEventListener('blur', releaseAll)
  document.removeEventListener('fullscreenchange', onFullscreenChange)

  if (rafId) cancelAnimationFrame(rafId)
  releaseAll()
  document.body.classList.remove('no-scroll')
})

defineExpose({
  toggleFs: toggleFullscreen,
  enterFs: enterFullscreen,
  exitFs: exitFullscreen
})
</script>

<style scoped>
.pong-wrapper {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
}

.pong-wrapper.fullscreen-active,
.pong-wrapper.fullscreen-shim {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: #000;
  padding-top: env(safe-area-inset-top);
  padding-right: env(safe-area-inset-right);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
}

.pong-stage {
  position: relative;
  width: 100%;
  max-width: var(--canvas-max-width, 960px);
  aspect-ratio: var(--canvas-aspect, 2);
  border-radius: 12px;
  overflow: hidden;
  --score-left-gradient: linear-gradient(135deg, #00bcd4, #2196f3);
  --score-right-gradient: linear-gradient(135deg, #ff9800, #f44336);
  --score-vs-bg: rgba(15, 23, 42, 0.35);
  --score-vs-border: rgba(255, 255, 255, 0.25);
  --score-vs-shadow: inset 0 6px 16px rgba(15, 23, 42, 0.35), 0 6px 15px rgba(0, 0, 0, 0.3);
  --score-text-shadow: 0 1px 6px rgba(0, 0, 0, 0.3);
  --score-value-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  --score-target-color: rgba(248, 250, 252, 0.72);
  --score-value-color: rgba(248, 250, 252, 0.94);
  --score-left-color: rgba(56, 189, 248, 0.95);
  --score-right-color: rgba(248, 113, 113, 0.95);
  --score-panel-bg: rgba(15, 23, 42, 0.72);
  --score-panel-border: rgba(148, 163, 184, 0.4);
  --score-panel-shadow: 0 18px 36px rgba(15, 23, 42, 0.45);
  --score-panel-blur: 18px;
}

.pong-stage.fullscreen {
  max-width: 100%;
  height: 100%;
  border-radius: 0;
}

.pong-canvas {
  width: 100%;
  height: 100%;
  display: block;
  border: 3px solid var(--color-border);
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%);
  cursor: crosshair;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

.pong-stage.fullscreen .pong-canvas {
  border-radius: 0;
  border-width: 0;
  box-shadow: none;
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

.score-overlay {
  position: absolute;
  top: clamp(16px, 4vw, 32px);
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  pointer-events: none;
  z-index: 5;
  padding-inline: clamp(12px, 4vw, 28px);
}

.result-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  padding: clamp(12px, 4vw, 32px);
  z-index: 6;
}

.result-box {
  background: rgba(4, 6, 14, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.45);
  border-radius: 14px;
  padding: 1.3rem 1.6rem;
  text-align: center;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.35);
  max-width: min(400px, 80%);
  pointer-events: auto;
}

.result-title {
  margin: 0 0 0.6rem;
  font-size: clamp(1.2rem, 1.8rem, 2rem);
  font-weight: 800;
  background: linear-gradient(90deg, #fff, #b8c6ff);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.result-message {
  margin: 0;
  color: rgba(226, 232, 240, 0.95);
  font-size: clamp(0.95rem, 1.1rem, 1.3rem);
  font-weight: 600;
}

.result-button {
  margin-top: 1rem;
  border: none;
  border-radius: 10px;
  padding: 0.65rem 1.35rem;
  font-weight: 700;
  cursor: pointer;
  background: linear-gradient(135deg, #38bdf8, #6366f1);
  color: #0b1326;
  box-shadow: 0 14px 30px rgba(56, 189, 248, 0.35);
  transition: transform 0.18s ease, box-shadow 0.2s ease;
}

.result-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 18px 36px rgba(56, 189, 248, 0.45);
}

.score-board {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: clamp(0.5rem, 2.5vw, 1.75rem);
  width: min(100%, 760px);
  color: #f8fafc;
  text-transform: none;
}

.player-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  text-align: center;
}

.player-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: clamp(0.8rem, 1.2vw, 0.95rem);
  font-weight: 600;
  letter-spacing: 0.01em;
  color: rgba(248, 250, 252, 0.82);
  text-shadow: var(--score-text-shadow);
}

.player-icon {
  font-size: clamp(1rem, 2vw, 1.2rem);
}

.score-value {
  font-size: clamp(2rem, 4vw, 3.5rem);
  line-height: 1;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-shadow: var(--score-value-shadow);
  color: var(--score-value-color);
}

.score-value.player1 {
  color: var(--score-left-color, var(--score-value-color));
}

.score-value.player2 {
  color: var(--score-right-color, var(--score-value-color));
}

.score-separator {
  display: grid;
  place-items: center;
  width: clamp(48px, 6vw, 64px);
  height: clamp(48px, 6vw, 64px);
  border-radius: 50%;
  border: 2px solid var(--score-vs-border);
  background: var(--score-vs-bg);
  box-shadow: var(--score-vs-shadow);
}

.vs-text {
  font-weight: 800;
  font-size: clamp(0.75rem, 1.3vw, 1rem);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #f1f5f9;
  text-shadow: 0 1px 6px rgba(15, 23, 42, 0.65);
}

.score-target {
  font-size: clamp(0.65rem, 1.1vw, 0.8rem);
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--score-target-color);
  text-transform: uppercase;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}

.score-board.classic {
  display: flex !important;
  justify-content: space-between;
  align-items: flex-start;
  gap: clamp(1rem, 6vw, 4rem);
  width: min(100%, 820px);
  padding-inline: clamp(12px, 6vw, 32px);
  font-family: 'Press Start 2P', 'VT323', 'Share Tech Mono', 'Courier New', monospace;
  text-transform: uppercase;
  text-shadow: none;
}

.score-board.classic .player-score {
  flex-direction: column;
  gap: 0;
  align-items: center;
}

.score-board.classic .player-info,
.score-board.classic .score-separator {
  display: none;
}

.score-board.classic .score-value {
  font-size: clamp(2.6rem, 7vw, 4.6rem);
  font-weight: 700;
  letter-spacing: 0.3em;
  font-variant-numeric: tabular-nums;
  color: #f8fafc;
  text-shadow: 0 0 16px rgba(248, 250, 252, 0.42);
  background: none;
  -webkit-text-fill-color: currentColor;
}

.score-board.classic .score-value.player1,
.score-board.classic .score-value.player2 {
  background: none;
}

.classic-center-line {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 4px;
  transform: translateX(-50%);
  background-image: repeating-linear-gradient(
    to bottom,
    rgba(248, 250, 252, 0.85) 0px,
    rgba(248, 250, 252, 0.85) 12px,
    rgba(248, 250, 252, 0) 12px,
    rgba(248, 250, 252, 0) 24px
  );
  opacity: 0.7;
  pointer-events: none;
  z-index: 3;
}


.fullscreen-btn {
  position: absolute;
  top: max(env(safe-area-inset-top), 12px);
  right: max(env(safe-area-inset-right), 12px);
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(15, 23, 42, 0.6);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 1rem;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease;
  z-index: 55;
}

.fullscreen-btn:hover {
  transform: translateY(-1px);
  background: rgba(59, 130, 246, 0.85);
}

.touch-controls {
  position: absolute;
  inset: 0;
  display: flex;
  pointer-events: none;
  z-index: 15;
}

.touch-area {
  flex: 1;
  pointer-events: auto;
  touch-action: none;
}

.canvas-countdown {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(4, 6, 14, 0.55);
  z-index: 18;
}

.countdown-box {
  text-align: center;
  padding: 12px 18px;
  border: 1px solid rgba(148, 163, 184, 0.5);
  background: rgba(4, 6, 14, 0.68);
  border-radius: 7px;
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.35);
}

.countdown-label {
  color: #d1d5db;
  font-size: 0.9rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 0.25rem;
}

.countdown-value {
  font-size: clamp(2.2rem, 5vw, 3.4rem);
  font-weight: 900;
  background: var(--gradient-primary, linear-gradient(135deg, #4facfe, #00f2fe));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 12px 32px rgba(30, 64, 175, 0.45);
}

.pong-wrapper :global(.no-scroll) {
  touch-action: none;
  overflow: hidden;
}

.pong-wrapper.arena-classic .pong-stage {
  background: linear-gradient(160deg, rgba(34,34,34,0.95), rgba(6,6,6,0.92));
  --score-left-gradient: linear-gradient(135deg, #0ea5e9, #2563eb);
  --score-right-gradient: linear-gradient(135deg, #f59e0b, #dc2626);
  --score-vs-bg: rgba(15, 23, 42, 0.45);
  --score-vs-border: rgba(148, 163, 184, 0.6);
  --score-vs-shadow: inset 0 6px 16px rgba(15, 23, 42, 0.45), 0 10px 26px rgba(0, 0, 0, 0.34);
  --score-text-shadow: 0 1px 6px rgba(0, 0, 0, 0.45);
  --score-value-shadow: 0 12px 30px rgba(15, 23, 42, 0.55);
  --score-value-color: #f8fafc;
  --score-left-color: #f8fafc;
  --score-right-color: #f8fafc;
  --score-panel-bg: rgba(15, 23, 42, 0.82);
  --score-panel-border: rgba(148, 163, 184, 0.55);
  --score-panel-shadow: 0 22px 42px rgba(15, 23, 42, 0.55);
}

.pong-wrapper.arena-neon .pong-stage {
  background: radial-gradient(circle at top, rgba(79,172,254,0.25), transparent 60%),
    linear-gradient(200deg, rgba(19,25,48,0.95), rgba(6,11,24,0.96));
  border: 1px solid rgba(79,172,254,0.35);
  box-shadow: 0 20px 55px rgba(79,172,254,0.25);
  --score-left-gradient: linear-gradient(135deg, #38bdf8, #60a5fa);
  --score-right-gradient: linear-gradient(135deg, #fbbf24, #f97316);
  --score-vs-bg: rgba(59, 130, 246, 0.32);
  --score-vs-border: rgba(56, 189, 248, 0.65);
  --score-vs-shadow: inset 0 8px 18px rgba(56, 189, 248, 0.32), 0 14px 30px rgba(79, 172, 254, 0.38);
  --score-text-shadow: 0 1px 10px rgba(59, 130, 246, 0.55);
  --score-value-shadow: 0 16px 34px rgba(14, 116, 144, 0.55);
  --score-target-color: rgba(191, 219, 254, 0.92);
  --score-value-color: rgba(219, 234, 254, 0.95);
  --score-left-color: rgba(96, 165, 250, 1);
  --score-right-color: rgba(251, 191, 36, 1);
  --score-panel-bg: rgba(17, 24, 39, 0.68);
  --score-panel-border: rgba(56, 189, 248, 0.55);
  --score-panel-shadow: 0 24px 54px rgba(56, 189, 248, 0.28);
}

.pong-wrapper.arena-cosmic .pong-stage {
  background: radial-gradient(circle at 30% 20%, rgba(168,85,247,0.28), transparent 60%),
    radial-gradient(circle at 70% 80%, rgba(34,211,238,0.22), transparent 65%),
    linear-gradient(210deg, rgba(11,17,32,0.95), rgba(5,8,18,0.98));
  border: 1px solid rgba(168,85,247,0.35);
  box-shadow: 0 25px 60px rgba(168,85,247,0.25);
  --score-left-gradient: linear-gradient(135deg, #a855f7, #22d3ee);
  --score-right-gradient: linear-gradient(135deg, #facc15, #ef4444);
  --score-vs-bg: rgba(168, 85, 247, 0.28);
  --score-vs-border: rgba(168, 85, 247, 0.6);
  --score-vs-shadow: inset 0 10px 24px rgba(147, 51, 234, 0.38), 0 18px 38px rgba(91, 33, 182, 0.38);
  --score-text-shadow: 0 1px 12px rgba(124, 58, 237, 0.6);
  --score-value-shadow: 0 18px 38px rgba(124, 58, 237, 0.6);
  --score-target-color: rgba(233, 213, 255, 0.88);
  --score-value-color: rgba(237, 233, 254, 0.95);
  --score-left-color: rgba(168, 85, 247, 1);
  --score-right-color: rgba(250, 204, 21, 1);
  --score-panel-bg: rgba(17, 24, 39, 0.7);
  --score-panel-border: rgba(168, 85, 247, 0.55);
  --score-panel-shadow: 0 26px 58px rgba(124, 58, 237, 0.35);
}

@media (max-width: 640px) {
  .fullscreen-btn {
    width: 36px;
    height: 36px;
  }
}

@media (hover: hover) and (min-width: 768px) {
  .pong-stage.fullscreen .score-overlay {
    padding-inline: clamp(24px, 6vw, 64px);
  }

  .pong-stage.fullscreen .score-board:not(.classic) {
    width: min(100%, 900px);
    padding: clamp(14px, 2vw, 20px) clamp(20px, 4vw, 40px);
    border-radius: 18px;
    background: var(--score-panel-bg);
    border: 1px solid var(--score-panel-border);
    box-shadow: var(--score-panel-shadow);
    backdrop-filter: blur(var(--score-panel-blur));
  }

  .pong-stage.fullscreen .score-board:not(.classic) .player-info {
    font-size: clamp(0.85rem, 1vw, 1rem);
  }

  .pong-stage.fullscreen .score-board:not(.classic) .score-value {
    font-size: clamp(2.6rem, 3.6vw, 4rem);
    background: none;
    -webkit-background-clip: initial;
    background-clip: initial;
    -webkit-text-fill-color: var(--score-value-color);
    color: var(--score-value-color);
  }

  .pong-stage.fullscreen .score-board:not(.classic) .score-separator {
    width: clamp(52px, 4.8vw, 72px);
    height: clamp(52px, 4.8vw, 72px);
  }

  .pong-stage.fullscreen .score-board:not(.classic) .score-target {
    font-size: clamp(0.75rem, 0.95vw, 0.95rem);
    letter-spacing: 0.12em;
  }
}
</style>
