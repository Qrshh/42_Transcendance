<template>
  <div class="local-game ">
    <PongCanvas :state="gameState" :onMove="handlePlayerMove" />
    <div class="text-white text-lg">
      <div class="score">{{ gameState.score.player1 }} – {{ gameState.score.player2 }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, onBeforeUnmount } from 'vue'
  import PongCanvas from '../PongCanvas.vue'
  import { createInitialState } from '../ts/state'
  import { updateGame } from '../ts/engine'
  import { updateAIPaddle } from '../ts/ai'
  import { movePaddle } from '../ts/controls'
  import { useGameLoop } from '../ts/gameloop'

  /** 
  * Ici c'est le mode P. vs AI, il y contient le canva du pong
  */
  
  const gameState = createInitialState()
  
  // La boucle de jeu met à jour l'ia et la physique
  useGameLoop(() => {
    updateAIPaddle(gameState)
    updateGame(gameState)
  })
  
  // La fonction de mouvement n'affecte que le joueur 1
  function handlePlayerMove(player: 'p1' | 'p2', direction: 'up' | 'down' | 'stop'): void {
    if (player === 'p1') {
      movePaddle(gameState, 'p1', direction)
    }
  }
</script>

<style scoped>
  .game-container { 
    display: flex;
    flex-direction: column;
    align-items: center;
    border: 1px solid white;
    background-color: #1a1a1a;
    border-radius: 8px;
  }
  .score {
    color: white;
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }
</style>