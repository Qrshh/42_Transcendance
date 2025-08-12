<template>
  <div class="join-game-list">
    <!-- Header -->
    <div class="list-header">
      <div class="header-info">
        <h2 class="list-title">🔍 Parties disponibles</h2>
        <p class="list-subtitle">Trouve la partie parfaite pour toi !</p>
      </div>
      
      <div class="header-actions">
        <button @click="refreshGameList" :disabled="loading" class="btn-refresh">
          <span class="refresh-icon" :class="{ spinning: loading }">🔄</span>
          <span class="refresh-text">{{ loading ? 'Recherche...' : 'Actualiser' }}</span>
        </button>
      </div>
    </div>

    <!-- Stats de connexion -->
    <div class="connection-stats">
      <div class="stat-item">
        <span class="stat-icon">📡</span>
        <span class="stat-label">Ping moyen:</span>
        <span class="stat-value" :class="getPingClass(averagePing)">{{ averagePing }}ms</span>
      </div>
      <div class="stat-item">
        <span class="stat-icon">🎮</span>
        <span class="stat-label">Parties trouvées:</span>
        <span class="stat-value">{{ availableGames.length }}</span>
      </div>
    </div>

    <!-- Liste des parties -->
    <div class="games-container">
      <!-- État de chargement -->
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner">⏳</div>
        <h3 class="loading-title">Recherche de parties...</h3>
        <p class="loading-text">Analyse des serveurs disponibles</p>
      </div>

      <!-- Aucune partie disponible -->
      <div v-else-if="availableGames.length === 0" class="empty-state">
        <div class="empty-icon">🎯</div>
        <h3 class="empty-title">Aucune partie disponible</h3>
        <p class="empty-text">Sois le premier à créer une partie !</p>
        <button @click="$emit('back')" class="btn-create">
          ✨ Créer une partie
        </button>
      </div>

      <!-- Liste des parties -->
      <div v-else class="games-grid">
        <div 
          v-for="game in availableGames" 
          :key="game.id"
          class="game-card"
          :class="getGameCardClass(game)"
        >
          <!-- Header de la carte -->
          <div class="card-header">
            <div class="game-info">
              <h3 class="game-name">
                {{ game.name }}
                <span v-if="game.hasPassword" class="password-icon">🔒</span>
              </h3>
              <div class="game-status" :class="getStatusClass(game.status)">
                {{ getStatusText(game.status) }}
              </div>
            </div>
            
            <div class="game-ping">
              <div class="ping-indicator" :class="getPingClass(game.ping)">
                <span class="ping-dot"></span>
                <span class="ping-value">{{ game.ping || '?' }}ms</span>
              </div>
            </div>
          </div>

          <!-- Détails de la partie -->
          <div class="card-details">
            <div class="detail-item">
              <span class="detail-icon">👥</span>
              <span class="detail-text">{{ game.currentPlayers }}/{{ game.maxPlayers }} joueurs</span>
              <div class="players-bar">
                <div 
                  class="players-fill" 
                  :style="{ width: (game.currentPlayers / game.maxPlayers * 100) + '%' }"
                ></div>
              </div>
            </div>

            <div v-if="game.estimatedWaitTime" class="detail-item">
              <span class="detail-icon">⏱️</span>
              <span class="detail-text">Attente: ~{{ game.estimatedWaitTime }} min</span>
            </div>

            <div class="detail-item">
              <span class="detail-icon">🏆</span>
              <span class="detail-text">Mode: {{ getGameMode(game) }}</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="card-actions">
            <button 
              @click="joinGame(game.id, game.hasPassword)"
              :disabled="game.currentPlayers >= game.maxPlayers"
              class="btn-join"
              :class="{ 
                'btn-join-full': game.currentPlayers >= game.maxPlayers,
                'btn-join-password': game.hasPassword 
              }"
            >
              <span class="join-icon">
                {{ game.currentPlayers >= game.maxPlayers ? '🚫' : (game.hasPassword ? '🔑' : '🚀') }}
              </span>
              <span class="join-text">
                {{ getJoinButtonText(game) }}
              </span>
            </button>
          </div>

          <!-- Indicateur de popularité -->
          <div v-if="game.currentPlayers > 0" class="popularity-badge">
            🔥 {{ game.currentPlayers }} en ligne
          </div>
        </div>
      </div>
    </div>

    <!-- Bouton retour -->
    <div class="list-footer">
      <button @click="$emit('back')" class="btn-back">
        <span class="back-icon">←</span>
        <span class="back-text">Retour au lobby</span>
      </button>
    </div>

    <!-- Modal mot de passe -->
    <Transition name="modal">
      <div v-if="showPasswordModal" class="modal-overlay" @click.self="showPasswordModal = false">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">🔐 Partie protégée</h3>
            <button @click="showPasswordModal = false" class="modal-close">✕</button>
          </div>
          
          <div class="modal-body">
            <p class="password-prompt">Cette partie nécessite un mot de passe :</p>
            <input 
              v-model="passwordInput" 
              type="password" 
              placeholder="Mot de passe secret"
              class="password-input"
              @keyup.enter="confirmJoinWithPassword"
              ref="passwordInputRef"
            />
          </div>
          
          <div class="modal-actions">
            <button @click="showPasswordModal = false" class="btn-cancel">
              Annuler
            </button>
            <button @click="confirmJoinWithPassword" class="btn-confirm">
              <span class="confirm-icon">🚀</span>
              <span class="confirm-text">Rejoindre</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Message d'erreur -->
    <Transition name="fade">
      <div v-if="errorMessage" class="error-banner">
        <span class="error-icon">⚠️</span>
        <span class="error-text">{{ errorMessage }}</span>
        <button @click="errorMessage = null" class="error-close">✕</button>
      </div>
    </Transition>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted, nextTick } from 'vue';
import { Socket } from 'socket.io-client';

interface GameLobby {
  id: string;
  name: string;
  currentPlayers: number;
  maxPlayers: number;
  estimatedWaitTime: number | null;
  hasPassword: boolean;
  status: string;
  ping?: number;
  gameMode?: string;
}

export default defineComponent({
  name: 'JoinGameList',
  props: {
    socket: {
      type: Object as () => Socket,
      required: true,
    },
  },
  emits: ['back', 'gameJoined'],
  
  setup(props, { emit }) {
    const availableGames = ref<GameLobby[]>([]);
    const loading = ref(true);
    const errorMessage = ref<string | null>(null);
    const averagePing = ref(0);
    const showPasswordModal = ref(false);
    const passwordInput = ref('');
    const selectedGameId = ref<string | null>(null);
    const passwordInputRef = ref<HTMLInputElement | null>(null);

    // Calculs et utilitaires
    const updateAveragePing = () => {
      const pings = availableGames.value.filter(g => g.ping).map(g => g.ping!);
      averagePing.value = pings.length > 0 
        ? Math.round(pings.reduce((a, b) => a + b, 0) / pings.length) 
        : 0;
    };

    const measurePing = async (gameId: string): Promise<number> => {
      const start = Date.now();
      return new Promise((resolve) => {
        props.socket.emit('ping', gameId);
        const timeout = setTimeout(() => resolve(999), 3000);
        
        const onPong = () => {
          clearTimeout(timeout);
          props.socket.off('pong', onPong);
          resolve(Date.now() - start);
        };
        
        props.socket.on('pong', onPong);
      });
    };

    // Classes CSS dynamiques
    const getPingClass = (ping?: number) => {
      if (!ping) return 'ping-unknown';
      if (ping < 50) return 'ping-excellent';
      if (ping < 100) return 'ping-good';
      if (ping < 200) return 'ping-average';
      return 'ping-poor';
    };

    const getStatusClass = (status: string) => {
      switch (status) {
        case 'waiting': return 'status-waiting';
        case 'playing': return 'status-playing';
        case 'full': return 'status-full';
        default: return 'status-unknown';
      }
    };

    const getGameCardClass = (game: GameLobby) => {
      const classes = [];
      if (game.currentPlayers >= game.maxPlayers) classes.push('card-full');
      if (game.hasPassword) classes.push('card-password');
      if (game.currentPlayers > 0) classes.push('card-active');
      return classes;
    };

    // Textes dynamiques
    const getStatusText = (status: string) => {
      const statusMap: Record<string, string> = {
        'waiting': '⏳ En attente',
        'playing': '🎮 En jeu',
        'full': '🚫 Complète',
      };
      return statusMap[status] || '❓ Inconnu';
    };

    const getGameMode = (game: GameLobby) => {
      return game.gameMode || 'Classique';
    };

    const getJoinButtonText = (game: GameLobby) => {
      if (game.currentPlayers >= game.maxPlayers) return 'Complète';
      if (game.hasPassword) return 'Mot de passe';
      return 'Rejoindre';
    };

    // Actions
    const handleGameListUpdate = async (games: GameLobby[]) => {
      availableGames.value = games;
      
      // Mesurer le ping pour chaque partie
      const pingPromises = availableGames.value.map(async (game) => {
        game.ping = await measurePing(game.id);
        return game;
      });
      
      await Promise.all(pingPromises);
      updateAveragePing();
      loading.value = false;
    };

    const refreshGameList = () => {
      loading.value = true;
      errorMessage.value = null;
      props.socket.emit('requestGameList');
    };

    const joinGame = (gameId: string, hasPassword: boolean) => {
      if (hasPassword) {
        selectedGameId.value = gameId;
        showPasswordModal.value = true;
        passwordInput.value = '';
        
        nextTick(() => {
          passwordInputRef.value?.focus();
        });
      } else {
        confirmJoinGame(gameId, '');
      }
    };

    const confirmJoinWithPassword = () => {
      if (selectedGameId.value) {
        confirmJoinGame(selectedGameId.value, passwordInput.value);
        showPasswordModal.value = false;
      }
    };

    const confirmJoinGame = (gameId: string, password: string) => {
      errorMessage.value = null;
      props.socket.emit('joinGame', { gameId, password });
      
      const gameToJoin = availableGames.value.find(g => g.id === gameId);
      if (gameToJoin) {
        emit('gameJoined', { id: gameToJoin.id, name: gameToJoin.name });
      }
    };

    const handleGameJoinError = (data: { message: string }) => {
      errorMessage.value = data.message;
      showPasswordModal.value = false;
    };

    // Lifecycle
    onMounted(() => {
      props.socket.on('gameListUpdate', handleGameListUpdate);
      props.socket.on('gameJoinError', handleGameJoinError);
      refreshGameList();
      
      // Actualiser périodiquement
      const refreshInterval = setInterval(refreshGameList, 10000);
      
      onUnmounted(() => {
        clearInterval(refreshInterval);
        props.socket.off('gameListUpdate', handleGameListUpdate);
        props.socket.off('gameJoinError', handleGameJoinError);
        props.socket.off('pong');
      });
    });

    return {
      availableGames,
      loading,
      errorMessage,
      averagePing,
      showPasswordModal,
      passwordInput,
      passwordInputRef,
      joinGame,
      refreshGameList,
      confirmJoinWithPassword,
      getPingClass,
      getStatusClass,
      getGameCardClass,
      getStatusText,
      getGameMode,
      getJoinButtonText,
    };
  },
});
</script>

<style scoped>
.join-game-list {
  max-width: 800px;
  margin: 0 auto;
  padding: 1.5rem;
}

/* Header */
.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border);
}

.header-info {
  flex: 1;
}

.list-title {
  font-size: 2rem;
  font-weight: 800;
  background: var(--gradient-primary);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 0.5rem;
}

.list-subtitle {
  color: var(--color-text);
  opacity: 0.8;
  margin: 0;
}

.btn-refresh {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--color-background);
  border: 2px solid var(--color-border);
  border-radius: 12px;
  padding: 0.75rem 1.25rem;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-refresh:hover:not(:disabled) {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.refresh-icon {
  font-size: 1rem;
  transition: transform 0.3s ease;
}

.refresh-icon.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Stats de connexion */
.connection-stats {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  justify-content: center;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 15px;
  padding: 0.75rem 1.25rem;
  font-size: 0.9rem;
}

.stat-icon {
  font-size: 1rem;
}

.stat-label {
  color: var(--color-text);
  opacity: 0.8;
}

.stat-value {
  font-weight: 700;
  color: var(--color-primary);
}

.stat-value.ping-excellent { color: #4CAF50; }
.stat-value.ping-good { color: #8BC34A; }
.stat-value.ping-average { color: #FF9800; }
.stat-value.ping-poor { color: #F44336; }

/* Container des parties */
.games-container {
  min-height: 300px;
  margin-bottom: 2rem;
}

/* États */
.loading-state, .empty-state {
  text-align: center;
  padding: 3rem 1rem;
}

.loading-spinner, .empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  animation: pulse 2s infinite;
}

.loading-title, .empty-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 0.5rem;
}

.loading-text, .empty-text {
  color: var(--color-text);
  opacity: 0.7;
  margin-bottom: 1.5rem;
}

.btn-create {
  background: var(--gradient-primary);
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-create:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

/* Grille des parties */
.games-grid {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
}

/* Cartes de partie */
.game-card {
  background: var(--color-background-soft);
  border: 2px solid var(--color-border);
  border-radius: 20px;
  padding: 1.5rem;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.game-card:hover {
  transform: translateY(-5px);
  box-shadow: var(--shadow-lg);
}

.game-card.card-active {
  border-color: var(--color-primary);
}

.game-card.card-password {
  background: linear-gradient(135deg, var(--color-background-soft), rgba(255, 193, 7, 0.05));
}

.game-card.card-full {
  opacity: 0.7;
  filter: grayscale(0.3);
}

/* Header de carte */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.game-info {
  flex: 1;
}

.game-name {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.password-icon {
  font-size: 1rem;
  color: #FFC107;
}

.game-status {
  font-size: 0.85rem;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-weight: 500;
  display: inline-block;
}

.status-waiting {
  background: rgba(255, 193, 7, 0.1);
  color: #FFC107;
  border: 1px solid #FFC107;
}

.status-playing {
  background: rgba(76, 175, 80, 0.1);
  color: #4CAF50;
  border: 1px solid #4CAF50;
}

.status-full {
  background: rgba(244, 67, 54, 0.1);
  color: #F44336;
  border: 1px solid #F44336;
}

/* Indicateur de ping */
.game-ping {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.ping-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  font-weight: 500;
}

.ping-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.ping-excellent { color: #4CAF50; }
.ping-good { color: #8BC34A; }
.ping-average { color: #FF9800; }
.ping-poor { color: #F44336; }
.ping-unknown { color: #9E9E9E; }

/* Détails de la carte */
.card-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.detail-icon {
  font-size: 1rem;
}

.detail-text {
  color: var(--color-text);
  opacity: 0.8;
}

.players-bar {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  margin-left: auto;
  margin-right: 1rem;
  overflow: hidden;
  min-width: 60px;
}

.players-fill {
  height: 100%;
  background: var(--gradient-primary);
  transition: width 0.3s ease;
}

/* Actions de carte */
.card-actions {
  display: flex;
  gap: 0.75rem;
}

.btn-join {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: var(--gradient-primary);
  color: white;
  border: none;
  border-radius: 12px;
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  flex: 1;
}

.btn-join:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.btn-join.btn-join-full {
  background: #9E9E9E;
  cursor: not-allowed;
}

.btn-join.btn-join-password {
  background: linear-gradient(135deg, #FF9800, #F57C00);
}

.btn-join:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Badge de popularité */
.popularity-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  background: var(--gradient-primary);
  color: white;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  box-shadow: var(--shadow-sm);
  animation: bounce 2s infinite;
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-3px); }
  60% { transform: translateY(-2px); }
}

/* Footer */
.list-footer {
  display: flex;
  justify-content: center;
}

.btn-back {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--color-background);
  border: 2px solid var(--color-border);
  border-radius: 15px;
  padding: 0.875rem 2rem;
  color: var(--color-text);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-back:hover {
  border-color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: var(--color-background);
  border: 2px solid var(--color-border);
  border-radius: 20px;
  padding: 2rem;
  max-width: 400px;
  width: 100%;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.modal-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--color-text);
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.3s ease;
}

.modal-close:hover {
  opacity: 1;
}

.modal-body {
  margin-bottom: 1.5rem;
}

.password-prompt {
  color: var(--color-text);
  margin-bottom: 1rem;
  opacity: 0.8;
}

.password-input {
  width: 100%;
  background: var(--color-background-soft);
  border: 2px solid var(--color-border);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  color: var(--color-text);
  font-size: 1rem;
  outline: none;
  transition: border-color 0.3s ease;
}

.password-input:focus {
  border-color: var(--color-primary);
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.btn-cancel {
  background: var(--color-background-soft);
  border: 2px solid var(--color-border);
  border-radius: 12px;
  padding: 0.75rem 1.5rem;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-cancel:hover {
  border-color: var(--color-primary);
}

.btn-confirm {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--gradient-primary);
  color: white;
  border: none;
  border-radius: 12px;
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-confirm:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

/* Message d'erreur */
.error-banner {
  position: fixed;
  top: 2rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(244, 67, 54, 0.1);
  border: 1px solid #F44336;
  color: #F44336;
  padding: 1rem 1.5rem;
  border-radius: 15px;
  box-shadow: var(--shadow-lg);
  z-index: 1001;
  max-width: 500px;
  backdrop-filter: blur(10px);
}

.error-close {
  background: none;
  border: none;
  color: currentColor;
  cursor: pointer;
  font-size: 1.2rem;
  opacity: 0.7;
  transition: opacity 0.3s ease;
}

.error-close:hover {
  opacity: 1;
}

/* Transitions */
.modal-enter-active, .modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from, .modal-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.fade-enter-active, .fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Responsive */
@media (max-width: 768px) {
  .join-game-list {
    padding: 1rem;
  }
  
  .list-header {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }
  
  .connection-stats {
    flex-direction: column;
    align-items: center;
  }
  
  .games-grid {
    grid-template-columns: 1fr;
  }
  
  .game-card {
    padding: 1rem;
  }
  
  .modal-content {
    margin: 1rem;
    padding: 1.5rem;
  }
}
</style>
