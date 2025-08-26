<template>
  <div class="remote-game-container">
    <PongCanvas 
      :state="gameState" 
      :onMove="handleMove"
    />
    
    <div class="text-white text-lg">
      <div class="score">{{ gameState.score.player1 }} – {{ gameState.score.player2 }}</div>
    </div>
    
    <div class="game-status">{{ getStatusText() }}</div>
    
    <div class="instructions">
      <p>Utilisez W/S ou ↑/↓ pour bouger votre paddle</p>
      <button @click="leaveGame" class="leave-btn">Quitter la partie</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
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
  // facultatif si présent dans ton type:
  // players: { p1: null as any, p2: null as any },
  // usernames: { p1: undefined as any, p2: undefined as any }
})

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

  // cleanup
  onBeforeUnmount(() => {
    if (retryTimer) clearTimeout(retryTimer)
    props.socket.off('gameState', onGameStateStream)
    props.socket.off('gameEnded', onGameEnded)
    props.socket.off('challengeError') // au cas où
  })
})
</script>

<style scoped>
.remote-game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 1px solid white;
  background-color: #1a1a1a;
  border-radius: 8px;
  padding: 20px;
}
.score { color: white; font-size: 1.5rem; margin: 10px 0; }
.game-status { color: #60a5fa; font-size: 16px; margin-bottom: 10px; }
.instructions { margin-top: 20px; text-align: center; }
.instructions p { color: white; margin-bottom: 10px; }
.leave-btn {
  margin-top: 10px; padding: 8px 16px; background-color: #ef4444;
  color: white; border: none; border-radius: 4px; cursor: pointer;
}
.leave-btn:hover { background-color: #dc2626; }
</style>
