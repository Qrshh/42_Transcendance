<template>
  <div class="remote-game-container">
    <!-- Utilise ton composant PongCanvas existant -->
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
import PongCanvas from '../PongCanvas.vue' // ✅ Import de ton composant
import type { GameState } from './ts/types' // ✅ Import de tes types

const props = defineProps<{ 
  socket: Socket, 
  roomId: string 
}>()

// ✅ Ajouter l'emit pour communiquer avec le parent
const emit = defineEmits<{
  leaveGame: []
}>()

// ✅ Utilise ton type GameState au lieu d'un objet générique
const gameState = ref<GameState>({
  ball: { x: 300, y: 200, vx: 0, vy: 0, radius: 8 },
  paddles: {
    p1: { x: 10, y: 150, width: 10, height: 100, vy: 0 },
    p2: { x: 580, y: 150, width: 10, height: 100, vy: 0 }
  },
  score: { player1: 0, player2: 0 },
  gameOver: false,
  winner: undefined
})

// ✅ Fonction pour gérer les mouvements depuis PongCanvas
const handleMove = (player: 'p1' | 'p2', direction: 'up' | 'down' | 'stop') => {
  console.log(`🎮 Mouvement depuis PongCanvas: ${player} -> ${direction}`)
  
  // Convertir le format pour le serveur
  let serverDirection = direction
  
  // Envoyer au serveur
  props.socket.emit('movePaddle', { 
    roomId: props.roomId, 
    direction: serverDirection 
  })
}

const getStatusText = () => {
  if (gameState.value.gameOver) {
    return `Partie terminée - ${gameState.value.winner} a gagné !`
  }
  
  switch (gameState.value.status) {
    case 'waiting': return 'En attente de joueurs...'
    case 'starting': return 'La partie va commencer !'
    case 'playing': return 'Partie en cours'
    case 'finished': return 'Partie terminée'
    default: return 'En attente...'
  }
}

const leaveGame = () => {
  console.log(`🚪 Quitter la partie: ${props.roomId}`)
  props.socket.emit('leaveGame', { gameId: props.roomId })
  emit('leaveGame') // ✅ Émettre vers le parent
}

onMounted(() => {
  console.log(`🎮 RemoteGame monté pour room: ${props.roomId}`)
  
  // Écouter les mises à jour du jeu
  props.socket.on('gameState', (newState) => {
    console.log('🎮 État du jeu reçu:', newState)
    
    // ✅ Adapter les données du serveur à ton format GameState
    gameState.value = {
      ball: { ...newState.ball },
      paddles: { ...newState.paddles },
      score: { ...newState.score },
      gameOver: newState.status === 'finished' || newState.gameOver || false,
      winner: newState.winner,
      status: newState.status
    }
  })

  // Écouter la fin de partie
  props.socket.on('gameEnded', (data) => {
    console.log('🏁 Partie terminée:', data)
    gameState.value.gameOver = true
    gameState.value.winner = data.winner
    alert('Partie terminée: ' + data.message)
  })
})

onBeforeUnmount(() => {
  console.log('🎮 RemoteGame démonté')
  props.socket.off('gameState')
  props.socket.off('gameEnded')
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

.score {
  color: white;
  font-size: 1.5rem;
  margin: 10px 0;
}

.game-status {
  color: #60a5fa;
  font-size: 16px;
  margin-bottom: 10px;
}

.instructions {
  margin-top: 20px;
  text-align: center;
}

.instructions p {
  color: white;
  margin-bottom: 10px;
}

.leave-btn {
  margin-top: 10px;
  padding: 8px 16px;
  background-color: #ef4444;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.leave-btn:hover {
  background-color: #dc2626;
}
</style>
