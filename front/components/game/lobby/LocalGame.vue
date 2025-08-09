<template>
  <div class="local-game">
    <!-- Header du jeu -->
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
      </div>
    </div>

    <!-- Score moderne -->
    <div class="score-board">
      <div class="player-score">
        <div class="player-info">
          <span class="player-icon">🎮</span>
          <span class="player-name">Joueur 1</span>
        </div>
        <div class="score-value player1">{{ gameState.score.player1 }}</div>
      </div>
      
      <div class="score-separator">
        <span class="vs-text">VS</span>
      </div>
      
      <div class="player-score">
        <div class="player-info">
          <span class="player-name">Joueur 2</span>
          <span class="player-icon">🎯</span>
        </div>
        <div class="score-value player2">{{ gameState.score.player2 }}</div>
      </div>
    </div>

    <!-- Canvas de jeu -->
    <div class="game-canvas-container">
      <PongCanvas :state="gameState" :onMove="handlePlayerMove" />
      
      <!-- Overlay pour les messages de jeu -->
      <div v-if="gameState.status !== 'playing'" class="game-overlay">
        <div class="overlay-content">
          <h3 v-if="gameState.status === 'waiting'" class="overlay-title">
            ⏳ En attente...
          </h3>
          <h3 v-else-if="gameState.status === 'finished'" class="overlay-title">
            🎉 Partie terminée !
          </h3>
          <p v-if="gameState.status === 'finished'" class="overlay-message">
            {{ getWinnerMessage() }}
          </p>
          <button v-if="gameState.status === 'finished'" @click="resetGame" class="btn-restart">
            🔄 Nouvelle partie
          </button>
        </div>
      </div>
    </div>

    <!-- Instructions et stats -->
    <div class="game-footer">
      <div class="game-instructions">
        <div class="instruction-item">
          <span class="instruction-icon">⚡</span>
          <span class="instruction-text">Première à 5 points gagne</span>
        </div>
        <div class="instruction-item">
          <span class="instruction-icon">🎯</span>
          <span class="instruction-text">Angle de frappe selon la position</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, computed } from 'vue'
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

// Messages de victoire
const getWinnerMessage = () => {
  if (gameState.score.player1 > gameState.score.player2) {
    return '🎮 Joueur 1 remporte la victoire !'
  } else {
    return '🎯 Joueur 2 remporte la victoire !'
  }
}

// Redémarrer le jeu
const resetGame = () => {
  gameState.score.player1 = 0
  gameState.score.player2 = 0
  gameState.status = 'playing'
  gameState.ball.x = 300
  gameState.ball.y = 200
  gameState.ball.vx = Math.random() > 0.5 ? 5 : -5
  gameState.ball.vy = Math.random() * 4 - 2
}
</script>

<style scoped>
.local-game {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  background: var(--color-background-soft);
  border: 2px solid var(--color-border);
  border-radius: 25px;
  padding: 2rem;
  box-shadow: var(--glow-primary);
  max-width: 800px;
  margin: 0 auto;
}

/* Header */
.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 15px;
}

.game-mode-info {
  text-align: left;
}

.mode-title {
  font-size: 1.5rem;
  font-weight: 700;
  background: var(--gradient-primary);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0;
}

.mode-description {
  color: var(--color-text);
  opacity: 0.8;
  margin: 0;
  font-size: 0.9rem;
}

.game-controls {
  display: flex;
  align-items: center;
}

.control-hint {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 20px;
}

.keys {
  background: var(--gradient-primary);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  font-weight: bold;
  font-size: 0.8rem;
}

.vs {
  color: var(--color-text);
  opacity: 0.6;
  font-weight: 600;
}

/* Score Board */
.score-board {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  padding: 1.5rem;
  position: relative;
}

.player-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.player-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-text);
  opacity: 0.8;
  font-size: 0.9rem;
  font-weight: 500;
}

.player-icon {
  font-size: 1.1rem;
}

.score-value {
  font-size: 3rem;
  font-weight: 800;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.score-value.player1 {
  background: linear-gradient(135deg, #00BCD4, #2196F3);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.score-value.player2 {
  background: linear-gradient(135deg, #FF9800, #F44336);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.score-separator {
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-background-soft);
  border: 2px solid var(--color-border);
  border-radius: 50%;
  width: 60px;
  height: 60px;
}

.vs-text {
  font-weight: 800;
  font-size: 1.1rem;
  background: var(--gradient-primary);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Canvas Container */
.game-canvas-container {
  position: relative;
  display: flex;
  justify-content: center;
  background: var(--color-background);
  border: 2px solid var(--color-border);
  border-radius: 20px;
  padding: 1rem;
  box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.1);
}

.game-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  z-index: 10;
}

.overlay-content {
  text-align: center;
  color: white;
  padding: 2rem;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  box-shadow: var(--shadow-lg);
}

.overlay-title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 1rem;
  background: var(--gradient-primary);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.overlay-message {
  font-size: 1.2rem;
  color: var(--color-text);
  margin-bottom: 1.5rem;
}

.btn-restart {
  padding: 0.75rem 2rem;
  background: var(--gradient-primary);
  color: white;
  border: none;
  border-radius: 15px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: var(--shadow-md);
}

.btn-restart:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

/* Footer */
.game-footer {
  display: flex;
  justify-content: center;
}

.game-instructions {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
  justify-content: center;
}

.instruction-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 15px;
  font-size: 0.9rem;
}

.instruction-icon {
  font-size: 1.1rem;
}

.instruction-text {
  color: var(--color-text);
  opacity: 0.8;
}

/* Responsive */
@media (max-width: 768px) {
  .local-game {
    padding: 1rem;
    gap: 1rem;
  }
  
  .game-header {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }
  
  .score-board {
    padding: 1rem;
  }
  
  .score-value {
    font-size: 2rem;
  }
  
  .game-instructions {
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>
