<template>
  <div class="remote-game" :class="[arenaClass, { spectator: isSpectator }]">
    <!-- Header -->
    <div class="game-header">
      <div class="game-mode-info">
        <h2 class="mode-title">{{ t.remoteHeader }}</h2>
        <p class="mode-description">{{ t.roomLabel }}: <code class="room-id">{{ roomId }}</code></p>
      </div>

      <div class="game-controls">
        <div v-if="!isSpectator" class="control-hint">
          <span class="keys">W/S</span>
          <span class="vs">vs</span>
          <span class="keys">↑/↓</span>
        </div>
        <div v-else class="control-hint spectator">
          <span class="keys">👀</span>
          <span class="vs"> </span>
          <span class="keys">{{ t.spectatorMode }}</span>
        </div>
        
        <div class="actions">
          <button class="btn ghost" type="button" @click="openCustomization" :title="t.options">⚙️</button>
          <button
            class="btn"
            @pointerdown.capture.prevent.stop="toggleFullscreen"
            @click.capture.prevent.stop
            :title="t.fullscreen"
          >⤢</button>
          <button class="btn danger" @click="leaveGame" :title="t.leaveGame">↩</button>
        </div>
      </div>
    </div>

    <div class="game-canvas-container">
      <PongCanvas
        ref="canvasRef"
        :state="gameState"
        :onMove="handlePlayerMove"
        :controls="canvasControls"
        :showFullscreenButton="false"
        :countdown="countdownToStart"
      />
      <div
        v-if="gameState.status === 'waiting' && countdownToStart === 0 && !gameState.gameOver"
        class="game-overlay"
      >
        <div class="overlay-content">
          <h3 class="overlay-title">{{ t.waiting }}</h3>
        </div>
      </div>
    </div>

    <div class="config-chips">
      <span class="chip">{{ t.ballSize }}: {{ ballSizeLabel }}</span>
      <span class="chip">{{ t.powerUps }}: {{ powerUpsLabel }}</span>
      <span class="chip">{{ t.acceleratingBall }}: {{ accelLabel }}</span>
      <span class="chip">{{ t.dashPaddles }}: {{ dashLabel }}</span>
      <span class="chip">{{ arenaLabel }} • {{ ballSpeedLabel }}</span>
    </div>

    <!-- Footer -->
    <div class="game-footer">
      <div class="game-instructions">
        <div class="instruction-item" v-if="!isSpectator">
          <span class="instruction-icon">⌨️</span>
          <span class="instruction-text">{{ t.controlsHint }}</span>
        </div>
        <div class="instruction-item" v-else>
          <span class="instruction-icon">👀</span>
          <span class="instruction-text">{{ t.spectatorHint }}</span>
        </div>
        <div class="instruction-item">
          <span class="instruction-icon">🚪</span>
          <span class="instruction-text">{{ t.leaveInstruction }}</span>
        </div>
      </div>
    </div>
  </div>
</template>


<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import type { Socket } from 'socket.io-client'
import PongCanvas from '../PongCanvas.vue'
import type { GameState } from '../ts/types'
import { useGameSettings } from '../../../stores/gameSettings'
import { useI18n } from '../../../composables/useI18n'

const {t} = useI18n()

const props = defineProps<{ 
  socket: Socket, 
  roomId: string,
  isSpectator?: boolean
}>()

const emit = defineEmits<{
  leaveGame: []
  gameEnded: [payload: any]
}>()

// --- état jeu (avec quelques champs init pour éviter les undefined)
const { settings: globalSettings } = useGameSettings()

const gameState = ref<GameState>({
  ball: { x: 400, y: 200, vx: 0, vy: 0, radius: 8 },
  paddles: {
    p1: { x: 10, y: 150, width: 10, height: 100, vy: 0 },
    p2: { x: 780, y: 150, width: 10, height: 100, vy: 0 }
  },
  score: { player1: 0, player2: 0 },
  status: 'starting' as any,
  gameOver: false,
  winner: null,
  countdown: 0,
  settings: {
    arena: globalSettings.arena,
    ballSpeed: globalSettings.ballSpeed,
    ballSize: globalSettings.ballSize,
    accelBall: globalSettings.accelBall,
    paddleDash: globalSettings.paddleDash,
    powerUps: globalSettings.powerUps
  }
} as GameState)

const meName = ref(localStorage.getItem('username') || 'anon')
const socketId = ref(props.socket.id)
const isSpectator = computed(() => !!props.isSpectator)

const usernames = computed(() => ((gameState.value as any).usernames) || {})
const players = computed(() => ((gameState.value as any).players) || {})

const controllingSide = computed<'p1' | 'p2' | null>(() => {
  if (isSpectator.value) return null
  if (usernames.value?.p1 && usernames.value.p1 === meName.value) return 'p1'
  if (usernames.value?.p2 && usernames.value.p2 === meName.value) return 'p2'
  if (players.value?.p1 && players.value.p1 === socketId.value) return 'p1'
  if (players.value?.p2 && players.value.p2 === socketId.value) return 'p2'
  return null
})

const canvasControls = computed(() => {
  if (isSpectator.value) return 'none'
  if (controllingSide.value === 'p1') return 'left'
  if (controllingSide.value === 'p2') return 'right'
  return 'auto'
})

const playerLabel = (side: 'p1' | 'p2') => {
  const name = usernames.value?.[side]
  if (!name) return side === 'p1' ? 'Joueur 1' : 'Joueur 2'
  if (!isSpectator.value && name === meName.value) return 'Vous'
  return name
}

const p1Label = computed(() => playerLabel('p1'))
const p2Label = computed(() => playerLabel('p2'))
const headerTitle = computed(() => (isSpectator.value ? '👀 Mode Spectateur' : '🌐 Mode En ligne'))
const controlLabel = computed(() => (isSpectator.value ? 'Mode spectateur — aucune interaction' : 'Contrôles: W/S et ↑/↓'))
const resolvedArena = computed(() => gameState.value.settings?.arena ?? globalSettings.arena)
const resolvedBallSpeed = computed(() => gameState.value.settings?.ballSpeed ?? globalSettings.ballSpeed)
const resolvedBallSize = computed(() => gameState.value.settings?.ballSize ?? globalSettings.ballSize)
const resolvedPowerUps = computed(() => gameState.value.settings?.powerUps ?? globalSettings.powerUps)

const arenaClass = computed(() => `arena-${resolvedArena.value || 'classic'}`)

const arenaLabel = computed(() => {
  switch (resolvedArena.value) {
    case 'neon': return 'Neon futuriste'
    case 'cosmic': return 'Cosmos'
    default: return 'Classique'
  }
})

const ballSpeedLabel = computed(() => {
  switch (resolvedBallSpeed.value) {
    case 'fast': return 'Rapide'
    case 'extreme': return 'Extrême'
    default: return 'Normale'
  }
})

const ballSizeLabel = computed(() => resolvedBallSize.value === 'large' ? 'Balle large' : 'Balle standard')

const powerUpsLabel = computed(() => {
  switch (resolvedPowerUps.value) {
    case 'rare': return 'Power-ups occasionnels'
    case 'frequent': return 'Power-ups fréquents'
    default: return 'Power-ups désactivés'
  }
})

const accelLabel = computed(() => (gameState.value.settings?.accelBall ?? globalSettings.accelBall) ? '⚡ Accélération activée' : '⚡ Accélération désactivée')
const dashLabel = computed(() => (gameState.value.settings?.paddleDash ?? globalSettings.paddleDash) ? '🚀 Dash activé' : '🚀 Dash désactivé')
const dashEnabled = computed(() => gameState.value.settings?.paddleDash ?? globalSettings.paddleDash)

// Compte à rebours: alimente via 'matchCountdown' (tournoi) ou fallback local si status==='starting'
const countdownToStart = ref<number>(0)
let localCdTimer: number | null = null

const canvasRef = ref<InstanceType<typeof PongCanvas> | null>(null)

const handlePlayerMove = (player: 'p1' | 'p2', direction: 'up' | 'down' | 'stop' | 'dash') => {
  if (isSpectator.value) return
  const side = controllingSide.value
  if (side && player !== side) return
  if (direction === 'dash' && !dashEnabled.value) return
  props.socket.emit('movePaddle', { roomId: props.roomId, direction })
}

const getStatusText = () => {
  if (gameState.value.gameOver) {
    return `Partie terminée - ${gameState.value.winner ?? '???'} a gagné !`
  }
  switch (gameState.value.status) {
    case 'waiting':  return 'En attente de joueurs...'
    case 'starting': return 'La partie va commencer !'
    case 'playing':  return 'Partie en cours'
    case 'finished': return 'Partie terminée'
    default:         return 'En attente...'
  }
}

const leaveGame = () => {
  if (isSpectator.value) {
    props.socket.emit('leaveSpectate', { roomId: props.roomId })
    emit('leaveGame')
    return
  }
  props.socket.emit('leaveGame', { gameId: props.roomId })
  emit('leaveGame')
}

// Texte fin de partie
// FS via bouton (même logique que LocalGame)
const fsLatch = ref(false)
let fsLatchTimer: number | null = null

const onSocketConnect = () => {
  socketId.value = props.socket.id
}

const startLocalCountdown = (seconds = 3) => {
  if (localCdTimer) {
    clearInterval(localCdTimer)
    localCdTimer = null
  }
  if (seconds > 0 && gameState.value.status !== 'starting' && gameState.value.status !== 'playing') {
    gameState.value.status = 'starting'
  }
  countdownToStart.value = seconds
  gameState.value.countdown = countdownToStart.value
  if (seconds <= 0) {
    if (gameState.value.status === 'starting') gameState.value.status = 'playing'
    gameState.value.countdown = 0
    return
  }
  localCdTimer = window.setInterval(() => {
    countdownToStart.value -= 1
    gameState.value.countdown = Math.max(countdownToStart.value, 0)
    if (countdownToStart.value <= 0 && localCdTimer) {
      clearInterval(localCdTimer)
      localCdTimer = null
      if (gameState.value.status === 'starting') gameState.value.status = 'playing'
      gameState.value.countdown = 0
    }
  }, 1000) as unknown as number
}

watch(p1Label, (val) => {
  if (!gameState.value.usernames) gameState.value.usernames = {}
  gameState.value.usernames.p1 = val
})

watch(p2Label, (val) => {
  if (!gameState.value.usernames) gameState.value.usernames = {}
  gameState.value.usernames.p2 = val
})

const ensureSettings = () => {
  if (!gameState.value.settings) {
    gameState.value.settings = {
      arena: globalSettings.arena,
      ballSpeed: globalSettings.ballSpeed,
      ballSize: globalSettings.ballSize,
      accelBall: globalSettings.accelBall,
      paddleDash: globalSettings.paddleDash,
      powerUps: globalSettings.powerUps
    }
  }
  return gameState.value.settings!
}

watch(() => globalSettings.arena, (val) => {
  const settings = ensureSettings()
  if (!joined) settings.arena = val
})

watch(() => globalSettings.ballSpeed, (val) => {
  const settings = ensureSettings()
  if (!joined) settings.ballSpeed = val
})

watch(() => globalSettings.ballSize, (val) => {
  const settings = ensureSettings()
  if (!joined) settings.ballSize = val
})

watch(() => globalSettings.powerUps, (val) => {
  const settings = ensureSettings()
  if (!joined) settings.powerUps = val
})

watch(() => globalSettings.accelBall, (val) => {
  const settings = ensureSettings()
  if (!joined) settings.accelBall = val
})

watch(() => globalSettings.paddleDash, (val) => {
  const settings = ensureSettings()
  if (!joined) settings.paddleDash = val
})
function toggleFullscreen() {
  if (fsLatch.value) return
  fsLatch.value = true
  canvasRef.value?.toggleFs()
  if (fsLatchTimer) clearTimeout(fsLatchTimer)
  fsLatchTimer = window.setTimeout(() => { fsLatch.value = false; fsLatchTimer = null }, 400)
}

const openCustomization = () => {
  window.dispatchEvent(new Event('open-game-settings'))
}

// ====== JOIN AVEC RETRY ======
let tries = 0
let joined = false
let retryTimer: number | null = null

function tryJoin(username: string) {
  if (joined) return
  tries++

  const onGameState = (newState: any) => {
    joined = true
    if (isSpectator.value) props.socket.off('tournamentError', onErr)
    else props.socket.off('challengeError', onErr)

    gameState.value = {
      ...gameState.value,
      ball: { ...newState.ball },
      paddles: { ...newState.paddles },
      score: { ...newState.score },
      players: newState.players ?? (gameState.value as any).players,
      usernames: newState.usernames ?? (gameState.value as any).usernames,
      settings: newState.settings ?? gameState.value.settings,
      status: countdownToStart.value > 0 ? 'starting' : newState.status,
      gameOver: newState.status === 'finished' || !!newState.gameOver,
      winner: newState.winner ?? gameState.value.winner,
      countdown: typeof newState.countdown === 'number' ? newState.countdown : countdownToStart.value
    }
  }

  const onErr = (e: any) => {
    const msg = e?.error || ''
    if (msg.includes('Room introuvable') && tries < 15) {
      retryTimer = window.setTimeout(() => tryJoin(username), 150)
    } else {
      console.warn('join room error:', e)
    }
  }

  props.socket.once('gameState', onGameState)
  if (isSpectator.value) props.socket.once('tournamentError', onErr)
  else props.socket.once('challengeError', onErr)

  if (isSpectator.value) props.socket.emit('spectateMatch', { roomId: props.roomId })
  else props.socket.emit('joinChallengeRoom', { roomId: props.roomId, username })
}

onMounted(() => {
  const me = localStorage.getItem('username') || 'anon'
  meName.value = me
  socketId.value = props.socket.id
  props.socket.emit('identify', me)

  // écouter les mises à jour de jeu (stream continu)
  const onGameStateStream = (newState: any) => {
    // si on n’a pas encore joint officiellement, ce handler servira aussi de validation
    if (!joined) joined = true

    gameState.value = {
      ...gameState.value,
      ball: { ...newState.ball },
      paddles: { ...newState.paddles },
      score: { ...newState.score },
      players: newState.players ?? (gameState.value as any).players,
      usernames: newState.usernames ?? (gameState.value as any).usernames,
      settings: newState.settings ?? gameState.value.settings,
      status: newState.status,
      gameOver: newState.status === 'finished' || !!newState.gameOver,
      winner: newState.winner ?? gameState.value.winner
    }

    // Fallback local: si statut 'starting' et pas de compte à rebours serveur, affiche 3s
    if (newState.status === 'starting' && countdownToStart.value === 0) {
      startLocalCountdown(3)
    }
  }
  props.socket.on('gameState', onGameStateStream)

  // fin de partie
  const onGameEnded = (data: any) => {
    const nameFromServer =
      data.winnerUsername ??
      (data.winner === 'Player 1' ? (gameState.value as any).usernames?.p1 :
       data.winner === 'Player 2' ? (gameState.value as any).usernames?.p2 : undefined)

    if (nameFromServer) gameState.value.winner = nameFromServer
    gameState.value.gameOver = true
    gameState.value.countdown = 0
    emit('gameEnded', data)
    window.dispatchEvent(new CustomEvent('playerStatsUpdated'))
  }
  props.socket.on('gameEnded', onGameEnded)
  props.socket.on('connect', onSocketConnect)

  tryJoin(me)

  const onMatchCountdown = (c: any) => {
    if (!c || c.roomId !== props.roomId) return
    const count = Number(c.count) || 0
    startLocalCountdown(count)
  }
  props.socket.on('matchCountdown', onMatchCountdown)

  // cleanup
  onBeforeUnmount(() => {
    if (retryTimer) clearTimeout(retryTimer)
    props.socket.off('gameState', onGameStateStream)
    props.socket.off('gameEnded', onGameEnded)
    props.socket.off('challengeError') // au cas où
    props.socket.off('tournamentError')
    props.socket.off('matchCountdown', onMatchCountdown)
    props.socket.off('connect', onSocketConnect)
    if (localCdTimer) { clearInterval(localCdTimer); localCdTimer = null }
    gameState.value.countdown = 0
  })
})
</script>

<style scoped>

/* ====== Menu avant-partie (carte verre) ====== */
.menu {
  color: var(--color-text);
  background: linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.04));
  border: 1px solid var(--color-border);
  border-radius: 7px;
  padding: 1.4rem;
  box-shadow: 0 12px 36px rgba(0,0,0,.25);
  max-width: 640px;
  margin: 0 auto;
}

.menu h2 {
  font-weight: 800;
  margin-bottom: 1rem;
  font-size: 1.4rem;
  letter-spacing: .2px;
  background: linear-gradient(90deg, #fff, #b8c6ff, #9fe7ff);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Switch custom sans changer le HTML */
.menu label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .75rem;
  color: var(--color-text);
  background: rgba(0,0,0,.2);
  border: 1px solid var(--color-border);
  border-radius: 7px;
  padding: .7rem 1rem;
}

.menu input[type="checkbox"]{
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
  outline: none;
}
.menu input[type="checkbox"]::after{
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
.menu input[type="checkbox"]:checked{
  background: linear-gradient(90deg, #6a5cff, #25c6ff);
  border-color: transparent;
  box-shadow: 0 6px 16px rgba(89, 102, 255, .35);
}
.menu input[type="checkbox"]:checked::after{
  transform: translateX(18px);
}

/* Bouton démarrer */
.menu button {
  width: 100%;
  margin-top: .25rem;
  border: 0;
  border-radius: 7px;
  background: linear-gradient(180deg, #7c4dff, #5a3bff);
  color: #fff;
  font-weight: 800;
  padding: .9rem 1rem;
  box-shadow: 0 14px 28px rgba(95, 69, 255, .35);
  transition: transform .15s ease, box-shadow .2s ease, opacity .2s ease;
}
.menu button:hover { transform: translateY(-1px); box-shadow: 0 22px 38px rgba(95, 69, 255, .45); }
.menu button:active { transform: translateY(0); }

/* ====== Header ====== */
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

.game-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.config-chip {
  background: rgba(255,255,255,.14);
  border: 1px solid rgba(255,255,255,.22);
  border-radius: 999px;
  padding: 0.35rem 0.85rem;
  font-size: 0.85rem;
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

/* ====== Scoreboard ====== */
/* ====== Canvas Container ====== */
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
.game-canvas-container::before{
  /* fines lignes pour un effet “arena” discret */
  content: "";
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient( to right, rgba(255,255,255,.04) 0, rgba(255,255,255,.04) 1px, transparent 1px, transparent 22px ),
    repeating-linear-gradient( to bottom, rgba(255,255,255,.03) 0, rgba(255,255,255,.03) 1px, transparent 1px, transparent 22px );
  pointer-events: none;
}

/* Overlay (pause/fin) */
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
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
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

/* ====== Footer / Tips ====== */
.game-footer { display: flex; justify-content: center; }
.game-instructions {
  display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center;
}
.instruction-item {
  display: flex; align-items: center; gap: .5rem;
  padding: .65rem .9rem;
  background: linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.03));
  border: 1px solid var(--color-border);
  border-radius: 7px;
  font-size: .95rem;
}
.instruction-icon { font-size: 1.05rem; }
.instruction-text { color: var(--color-text); opacity: .9; }

/* Reprend le style "carte" du LocalGame */
.remote-game {
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
  background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03));
  border: 1px solid var(--color-border);
  border-radius: 7px;
  padding: 1.6rem;
  box-shadow: 0 18px 50px rgba(0,0,0,.25);
  max-width: 1800px;
  margin: 0 auto;
}

.remote-game.arena-neon {
  background: radial-gradient(circle at top, rgba(79,172,254,0.25), transparent 55%),
              linear-gradient(200deg, rgba(19,23,45,0.92), rgba(8,12,28,0.95));
  border-color: rgba(79,172,254,0.35);
  box-shadow: 0 20px 55px rgba(79,172,254,0.25);
}

.remote-game.arena-cosmic {
  background: radial-gradient(circle at 30% 20%, rgba(168,85,247,0.28), transparent 60%),
              radial-gradient(circle at 70% 80%, rgba(34,211,238,0.22), transparent 65%),
              linear-gradient(210deg, rgba(11,17,32,0.95), rgba(5,8,18,0.98));
  border-color: rgba(168,85,247,0.35);
  box-shadow: 0 25px 60px rgba(168,85,247,0.25);
}

.btn {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 0.5rem 0.9rem;
  background: transparent;
  color: var(--color-text);
  font-weight: 600;
  cursor: pointer;
  transition: transform .15s ease, box-shadow .2s ease;
}

.btn.ghost {
  border-style: dashed;
}

.btn.danger {
  border-color: rgba(244,67,54,.6);
  color: #f87171;
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(0,0,0,.18);
}


@media (max-width: 820px){
  .remote-game { padding: 1.1rem; gap: 1.1rem }
  .game-header { flex-direction: column; gap: .8rem; text-align: center; }
  .game-canvas-container { padding: 0.75rem; }
}

@media (max-width: 520px){
  .keys { font-size: .78rem; padding: .18rem .52rem; }
  .control-hint { flex-wrap: wrap; justify-content: center; }
  .game-canvas-container { padding: 0.55rem; border-radius: 6px; }
}
</style>
