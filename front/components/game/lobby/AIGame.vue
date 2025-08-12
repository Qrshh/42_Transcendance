<template>
  <div class="ai-game">
    <!-- Header du jeu IA -->
    <div class="game-header">
      <div class="game-mode-info">
        <h2 class="mode-title">🤖 Mode Intelligence Artificielle</h2>
        <p class="mode-description">Vous vs IA • Niveau: {{ aiDifficulty }}</p>
      </div>
      
      <div class="ai-controls">
        <select v-model="aiDifficulty" @change="adjustAIDifficulty" class="difficulty-selector">
          <option value="Facile">🟢 Facile</option>
          <option value="Normal">🟡 Normal</option>
          <option value="Difficile">🔴 Difficile</option>
        </select>
      </div>
    </div>

    <!-- Score avec indicateurs IA -->
    <div class="score-board">
      <div class="player-score human">
        <div class="player-info">
          <span class="player-icon">👤</span>
          <span class="player-name">Vous</span>
        </div>
        <div class="score-value player1">{{ gameState.score.player1 }}</div>
        <div class="player-status">
          <span class="status-text">Humain</span>
        </div>
      </div>
      
      <div class="score-separator">
        <span class="vs-text">VS</span>
        <div class="ai-indicator">
          <span class="ai-pulse"></span>
        </div>
      </div>
      
      <div class="player-score ai">
        <div class="player-info">
          <span class="player-name">IA</span>
          <span class="player-icon">🤖</span>
        </div>
        <div class="score-value player2">{{ gameState.score.player2 }}</div>
        <div class="player-status">
          <span class="status-text ai-status">{{ getAIStatus() }}</span>
        </div>
      </div>
    </div>

    <!-- Canvas de jeu -->
    <div class="game-canvas-container">
      <PongCanvas :state="gameState" :onMove="handlePlayerMove" />
      
      <!-- Indicateurs de performance IA -->
      <div class="ai-performance">
        <div class="performance-item">
          <span class="perf-label">Précision IA:</span>
          <div class="perf-bar">
            <div class="perf-fill" :style="{ width: aiAccuracy + '%' }"></div>
          </div>
          <span class="perf-value">{{ aiAccuracy }}%</span>
        </div>
      </div>
      
      <!-- Overlay pour les messages de jeu -->
      <div v-if="gameState.status !== 'playing'" class="game-overlay">
        <div class="overlay-content">
          <h3 v-if="gameState.status === 'waiting'" class="overlay-title">
            🤖 IA en cours d'initialisation...
          </h3>
          <h3 v-else-if="gameState.status === 'finished'" class="overlay-title">
            {{ getGameResult() }}
          </h3>
          <p v-if="gameState.status === 'finished'" class="overlay-message">
            {{ getResultMessage() }}
          </p>
          <button v-if="gameState.status === 'finished'" @click="resetGame" class="btn-restart">
            🔄 Revanche contre l'IA
          </button>
        </div>
      </div>
    </div>

    <!-- Statistiques et conseils -->
    <div class="game-footer">
      <div class="game-stats">
        <div class="stat-item">
          <span class="stat-icon">🎯</span>
          <span class="stat-label">Frappes réussies:</span>
          <span class="stat-value">{{ playerHits }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-icon">⚡</span>
          <span class="stat-label">Vitesse max:</span>
          <span class="stat-value">{{ Math.abs(gameState.ball.vx).toFixed(1) }}px/s</span>
        </div>
        <div class="stat-item">
          <span class="stat-icon">🧠</span>
          <span class="stat-label">Décisions IA:</span>
          <span class="stat-value">{{ aiDecisions }}</span>
        </div>
      </div>
      
      <div class="game-tips">
        <div class="tip-item">
          <span class="tip-icon">💡</span>
          <span class="tip-text">Utilisez W/S pour déplacer votre paddle</span>
        </div>
        <div class="tip-item">
          <span class="tip-icon">🎯</span>
          <span class="tip-text">Frappez avec les bords pour des angles surprenants</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import PongCanvas from '../PongCanvas.vue'
import { createInitialState } from '../ts/state'
import { updateGame } from '../ts/engine'
import { updateAIPaddle } from '../ts/ai'
import { movePaddle } from '../ts/controls'
import { useGameLoop } from '../ts/gameloop'

const gameState = createInitialState()
const aiDifficulty = ref('Normal')
const aiAccuracy = ref(75)
const playerHits = ref(0)
const aiDecisions = ref(0)

// La boucle de jeu met à jour l'IA et la physique
useGameLoop(() => {
  updateAIPaddle(gameState)
  updateGame(gameState)
  
  // Mettre à jour les statistiques
  aiDecisions.value++
  if (Math.random() < 0.1) { // 10% de chance de changer la précision
    aiAccuracy.value = Math.max(50, Math.min(95, aiAccuracy.value + (Math.random() - 0.5) * 10))
  }
})

// La fonction de mouvement n'affecte que le joueur 1
function handlePlayerMove(player: 'p1' | 'p2', direction: 'up' | 'down' | 'stop'): void {
  if (player === 'p1') {
    movePaddle(gameState, 'p1', direction)
    if (direction !== 'stop') {
      playerHits.value++
    }
  }
}

// Ajuster la difficulté de l'IA
const adjustAIDifficulty = () => {
  switch (aiDifficulty.value) {
    case 'Facile':
      aiAccuracy.value = 60
      break
    case 'Normal':
      aiAccuracy.value = 75
      break
    case 'Difficile':
      aiAccuracy.value = 90
      break
  }
}

// Status de l'IA
const getAIStatus = () => {
  if (aiAccuracy.value > 85) return 'Concentrée'
  if (aiAccuracy.value > 70) return 'Attentive'
  return 'Calculant...'
}

// Résultat de la partie
const getGameResult = () => {
  if (gameState.score.player1 > gameState.score.player2) {
    return '🎉 Victoire Humaine !'
  } else {
    return '🤖 Victoire de l\'IA'
  }
}

const getResultMessage = () => {
  if (gameState.score.player1 > gameState.score.player2) {
    return 'Félicitations ! Vous avez battu l\'intelligence artificielle !'
  } else {
    return 'L\'IA vous a surpassé cette fois. Tentez votre revanche !'
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
  playerHits.value = 0
  aiDecisions.value = 0
}
</script>

<style scoped>
.ai-game {
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

/* Header spécifique IA */
.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: linear-gradient(135deg, var(--color-background) 0%, rgba(76, 175, 80, 0.1) 100%);
  border: 1px solid var(--color-border);
  border-radius: 15px;
}

.ai-controls {
  display: flex;
  align-items: center;
}

.difficulty-selector {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 0.5rem 1rem;
  color: var(--color-text);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.difficulty-selector:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

/* Score Board avec indicateurs IA */
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

.player-score.human {
  border-left: 4px solid #2196F3;
  padding-left: 1rem;
}

.player-score.ai {
  border-right: 4px solid #4CAF50;
  padding-right: 1rem;
}

.player-status {
  margin-top: 0.5rem;
}

.status-text {
  font-size: 0.8rem;
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-weight: 500;
}

.status-text:not(.ai-status) {
  background: rgba(33, 150, 243, 0.1);
  color: #2196F3;
  border: 1px solid #2196F3;
}

.ai-status {
  background: rgba(76, 175, 80, 0.1);
  color: #4CAF50;
  border: 1px solid #4CAF50;
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
  background: #4CAF50;
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
  background: rgba(0, 0, 0, 0.8);
  padding: 0.75rem;
  border-radius: 10px;
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
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  overflow: hidden;
}

.perf-fill {
  height: 100%;
  background: linear-gradient(90deg, #FF5252, #4CAF50);
  transition: width 0.5s ease;
}

.perf-value {
  font-weight: 600;
  color: #4CAF50;
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
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 15px;
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
  border-radius: 15px;
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
