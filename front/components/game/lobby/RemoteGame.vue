<template>
  <div class="remote-game">
    <!-- Header -->
    <div class="game-header">
      <div class="game-mode-info">
        <h2 class="mode-title">🌐 Mode En ligne</h2>
        <p class="mode-description">Room: <code class="room-id">{{ roomId }}</code></p>
      </div>

      <div class="game-controls">
        <div class="control-hint">
          <span class="keys">W/S</span>
          <span class="vs">vs</span>
          <span class="keys">↑/↓</span>
        </div>
        <div class="actions">
          <button
            class="btn"
            @pointerdown.capture.prevent.stop="toggleFullscreen"
            @click.capture.prevent.stop
            title="Plein écran"
          >⤢</button>
          <button class="btn danger" @click="leaveGame" title="Quitter">↩</button>
        </div>
      </div>
    </div>

    <!-- Scoreboard -->
    <div class="score-board">
      <div class="player-score">
        <div class="player-info">
          <span class="player-icon">🎮</span>
          <span class="player-name">Vous</span>
        </div>
        <div class="score-value player1">{{ gameState.score.player1 }}</div>
      </div>

      <div class="score-separator">
        <span class="vs-text">VS</span>
      </div>

      <div class="player-score">
        <div class="player-info">
          <span class="player-name">Adversaire</span>
          <span class="player-icon">🎯</span>
        </div>
        <div class="score-value player2">{{ gameState.score.player2 }}</div>
      </div>
    </div>

    <!-- Canvas + overlays -->
    <div class="game-canvas-container">
      <PongCanvas ref="canvasRef" :state="gameState" :onMove="handleMove" controlledPlayer="p1" />

      <!-- Countdown overlay (conservé) -->
      <div v-if="countdownToStart > 0" class="start-overlay">
        <div class="start-box">
          <div class="label">Début dans</div>
          <div class="big">{{ countdownToStart }}</div>
        </div>
      </div>

      <!-- Overlay fin/attente selon status serveur -->
      <div v-if="gameState.gameOver || gameState.status === 'waiting'" class="game-overlay">
        <div class="overlay-content">
          <h3 v-if="gameState.status === 'waiting'" class="overlay-title">⏳ En attente...</h3>
          <h3 v-else class="overlay-title">🎉 Partie terminée !</h3>
          <p v-if="gameState.gameOver" class="overlay-message">{{ endMessage }}</p>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="game-footer">
      <div class="game-instructions">
        <div class="instruction-item">
          <span class="instruction-icon">⌨️</span>
          <span class="instruction-text">Contrôles: W/S et ↑/↓</span>
        </div>
        <div class="instruction-item">
          <span class="instruction-icon">🚪</span>
          <span class="instruction-text">Bouton ↩ pour quitter</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import type { Socket } from 'socket.io-client'
import PongCanvas from '../PongCanvas.vue'
import type { GameState } from '../ts/types'

const props = defineProps<{ 
  socket: Socket, 
  roomId: string 
}>()

const emit = defineEmits<{
  leaveGame: []
  gameEnded: [payload: any]
}>()

// --- état jeu (avec quelques champs init pour éviter les undefined)
const gameState = ref<GameState>({
  ball: { x: 300, y: 200, vx: 0, vy: 0, radius: 8 },
  paddles: {
    p1: { x: 10,  y: 150, width: 10, height: 100, vy: 0 },
    p2: { x: 580, y: 150, width: 10, height: 100, vy: 0 }
  },
  score: { player1: 0, player2: 0 },
  status: 'starting' as any,
  gameOver: false,
  winner: undefined,
  // players: { p1: null as any, p2: null as any },
  // usernames: { p1: undefined as any, p2: undefined as any }
})

// Compte à rebours: alimente via 'matchCountdown' (tournoi) ou fallback local si status==='starting'
const countdownToStart = ref<number>(0)
let localCdTimer: number | null = null

// --- mouvement depuis PongCanvas
const handleMove = (_player: 'p1' | 'p2', direction: 'up' | 'down' | 'stop') => {
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
  props.socket.emit('leaveGame', { gameId: props.roomId })
  emit('leaveGame')
}

// Texte fin de partie
const endMessage = computed(() => {
  if (!gameState.value.gameOver) return ''
  return gameState.value.winner ? `${gameState.value.winner} a gagné !` : 'Partie terminée.'
})

// FS via bouton (même logique que LocalGame)
const canvasRef = ref<InstanceType<typeof PongCanvas> | null>(null)
const fsLatch = ref(false)
let fsLatchTimer: number | null = null
function toggleFullscreen() {
  if (fsLatch.value) return
  fsLatch.value = true
  canvasRef.value?.toggleFs()
  if (fsLatchTimer) clearTimeout(fsLatchTimer)
  fsLatchTimer = window.setTimeout(() => { fsLatch.value = false; fsLatchTimer = null }, 400)
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
    // sécurité: on enlève l’écouteur d’erreur lié à cette tentative
    props.socket.off('challengeError', onErr)

    gameState.value = {
      ...gameState.value,
      ball: { ...newState.ball },
      paddles: { ...newState.paddles },
      score: { ...newState.score },
      players: newState.players ?? (gameState.value as any).players,
      usernames: newState.usernames ?? (gameState.value as any).usernames,
      status: newState.status,
      gameOver: newState.status === 'finished' || !!newState.gameOver,
      winner: newState.winner ?? gameState.value.winner
    }
  }

  const onErr = (e: any) => {
    const msg = e?.error || ''
    if (msg.includes('Room introuvable') && tries < 15) {
      // réessaie vite (150ms)
      retryTimer = window.setTimeout(() => tryJoin(username), 150)
    } else {
      console.warn('joinChallengeRoom error:', e)
    }
  }

  // `once` pour éviter d’empiler des listeners
  props.socket.once('gameState', onGameState)
  props.socket.once('challengeError', onErr)

  props.socket.emit('joinChallengeRoom', { roomId: props.roomId, username })
}

onMounted(() => {
  const me = localStorage.getItem('username') || 'anon'
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
      status: newState.status,
      gameOver: newState.status === 'finished' || !!newState.gameOver,
      winner: newState.winner ?? gameState.value.winner
    }

    // Fallback local: si statut 'starting' et pas de compte à rebours serveur, affiche 2s
    if (newState.status === 'starting' && countdownToStart.value === 0) {
      if (localCdTimer) { clearInterval(localCdTimer); localCdTimer = null }
      countdownToStart.value = 2
      localCdTimer = window.setInterval(() => {
        countdownToStart.value -= 1
        if (countdownToStart.value <= 0 && localCdTimer) {
          clearInterval(localCdTimer); localCdTimer = null
        }
      }, 1000) as unknown as number
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
    emit('gameEnded', data)
    window.dispatchEvent(new CustomEvent('playerStatsUpdated'))
  }
  props.socket.on('gameEnded', onGameEnded)

  // lance le join (avec retry)
  tryJoin(me)

  // Tournoi: écoute le compte à rebours serveur
  const onMatchCountdown = (c: any) => {
    if (!c || c.roomId !== props.roomId) return
    countdownToStart.value = Number(c.count) || 0
  }
  props.socket.on('matchCountdown', onMatchCountdown)

  // cleanup
  onBeforeUnmount(() => {
    if (retryTimer) clearTimeout(retryTimer)
    props.socket.off('gameState', onGameStateStream)
    props.socket.off('gameEnded', onGameEnded)
    props.socket.off('challengeError') // au cas où
    props.socket.off('matchCountdown', onMatchCountdown)
    if (localCdTimer) { clearInterval(localCdTimer); localCdTimer = null }
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
  font-weight: 600;
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
.score-board {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 64px 1fr;
  align-items: center;
  gap: .75rem;
  background: linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.03));
  border: 1px solid var(--color-border);
  border-radius: 7px;
  padding: 1.2rem 1.4rem;
  box-shadow: 0 10px 30px rgba(0,0,0,.2);
}
.score-board::after{
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 7px;
  pointer-events: none;
  background: radial-gradient(400px 120px at 50% 50%, rgba(255,255,255,.06), transparent 60%);
}

.player-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: .4rem;
}
.player-info {
  display: flex;
  align-items: center;
  gap: .5rem;
  color: var(--color-text);
  opacity: .85;
  font-weight: 600;
  font-size: .95rem;
}
.player-icon { font-size: 1.1rem; }

.score-value {
  font-size: clamp(2.2rem, 4vw + .5rem, 3.4rem);
  line-height: 1;
  font-weight: 900;
  letter-spacing: .02em;
  text-shadow: 0 6px 18px rgba(0,0,0,.35);
  filter: drop-shadow(0 6px 20px rgba(0,0,0,.25));
}

.score-value.player1 {
  background: linear-gradient(135deg, #00BCD4, #2196F3);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.score-value.player2 {
  background: linear-gradient(135deg, #FF9800, #F44336);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}

/* Médaille VS */
.score-separator{
  display: grid;
  place-items: center;
  width: 64px; height: 64px;
  margin: 0 auto;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.25), rgba(255,255,255,.06));
  border: 2px solid var(--color-border);
  box-shadow: 0 8px 20px rgba(0,0,0,.25), inset 0 2px 6px rgba(255,255,255,.08);
}
.vs-text{
  font-weight: 900;
  font-size: .95rem;
  letter-spacing: .12em;
  background: linear-gradient(90deg, #b9c4ff, #9fe7ff);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}

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

/* Overlay de départ (countdown) */
.start-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-overlay-bg);
  border-radius: 7px;
  z-index: 12;
}
.start-box { text-align:center; padding: 12px 18px; border:1px solid var(--color-border, #333); background: var(--color-overlay-bg); border-radius: 7px; }
.start-box .label { color:#d1d5db; font-size: .9rem; margin-bottom:.25rem }
.start-box .big { font-size: 2.5rem; font-weight: 800; background: var(--gradient-primary); -webkit-background-clip:text; -webkit-text-fill-color:transparent }

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


/* Scoreboard (copie LocalGame) */
.score-board {
  display: grid;
  grid-template-columns: 1fr 64px 1fr;
  align-items: center;
  gap: 1rem;
  padding: 1.2rem;
  border: 1px solid var(--color-border);
  border-radius: 7px;
  background: linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02));
}
.vs-text{ font-weight:900; font-size:.95rem; letter-spacing:.12em; background: linear-gradient(90deg, #b9c4ff, #9fe7ff); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent }

/* Canvas container + overlays (comme LocalGame) */
.start-box{ text-align:center; padding:12px 18px; border:1px solid var(--color-border,#333); background: var(--color-overlay-bg); border-radius:7px }
.start-box .label{ color:#d1d5db; font-size:.9rem; margin-bottom:.25rem }
.start-box .big{ font-size:2.5rem; font-weight:800; background: var(--gradient-primary); -webkit-background-clip:text; -webkit-text-fill-color:transparent }


@media (max-width: 820px){
  .remote-game { padding: 1.1rem; gap: 1.1rem }
  .score-board{ grid-template-columns: 1fr 56px 1fr; padding: 1rem }
}
</style>
