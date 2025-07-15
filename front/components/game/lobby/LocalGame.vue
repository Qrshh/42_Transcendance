<template>
  <div class="local-game ">
    <PongCanvas :state="gameState" :onMove="handlePlayerMove" />
    <div class="text-white text-lg">
      <div class="score">{{ gameState.score.player1 }} – {{ gameState.score.player2 }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
  /** 
  * Ici c'est le mode PvP, il y contient le canva du pong, 
  * et ses propriétés uniques comme ses touches
  */
  import { onMounted, onBeforeUnmount } from 'vue'
  import PongCanvas from '../PongCanvas.vue'
  import { createInitialState } from '../ts/state'
  import { updateGame } from '../ts/engine'
  import { movePaddle } from '../ts/controls'
  import { useGameLoop } from '../ts/gameloop'

  const gameState = createInitialState()

  // La boucle de jeu met à jour la physique
  useGameLoop(() => updateGame(gameState))
  
  // La fonction de mouvement utilise notre logique centralisée
  function handlePlayerMove(player: 'p1' | 'p2', direction: 'up' | 'down' | 'stop'): void {
    movePaddle(gameState, player, direction)
  }
</script>

<style scoped>
  .local-game {
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
