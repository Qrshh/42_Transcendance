<template>
  <div class="lobby-container">
    <!-- Header du lobby -->
    <div class="lobby-header">
      <div class="lobby-title">
        <h1 class="title-main">🏛️ Transcendence Lobby</h1>
        <p class="title-subtitle">Choisis ton mode de jeu et lance la partie !</p>
      </div>
      
      <!-- Indicateur de connexion -->
      <div class="connection-indicator">
        <div class="connection-status" :class="{ connected: socket.connected }">
          <span class="status-dot"></span>
          <span class="status-text">{{ socket.connected ? 'En ligne' : 'Hors ligne' }}</span>
        </div>
      </div>
    </div>

    <!-- Contenu principal avec transitions -->
    <div class="lobby-content">
      <Transition name="lobby-screen" mode="out-in">
        <!-- Écran principal du lobby -->
        <div v-if="currentScreen === 'main'" key="main" class="screen main-screen">
          <div class="game-modes-grid">
            <div class="game-mode-card local-card" @click="$emit('startLocal')">
              <div class="card-icon">🏠</div>
              <h3 class="card-title">Partie Locale</h3>
              <p class="card-description">Joue avec un ami sur le même écran</p>
              <div class="card-players">👥 2 Joueurs</div>
            </div>

            <div class="game-mode-card ai-card" @click="$emit('startAI')">
              <div class="card-icon">🤖</div>
              <h3 class="card-title">Contre l'IA</h3>
              <p class="card-description">Défi l'intelligence artificielle</p>
              <div class="card-players">🎯 Solo vs IA</div>
            </div>

            <div class="game-mode-card online-card" @click="currentScreen = 'join-list'">
              <div class="card-icon">🌐</div>
              <h3 class="card-title">Rejoindre</h3>
              <p class="card-description">Rejoins une partie en cours</p>
              <div class="card-players">🔍 Multijoueur</div>
            </div>

            <div class="game-mode-card create-card" @click="currentScreen = 'create-form'">
              <div class="card-icon">✨</div>
              <h3 class="card-title">Créer</h3>
              <p class="card-description">Lance ta propre partie</p>
              <div class="card-players">🚀 Host</div>
            </div>
          </div>

          <!-- Statistiques du lobby -->
          <div class="lobby-stats">
            <div class="stat-item">
              <span class="stat-icon">👥</span>
              <span class="stat-text">Joueurs connectés</span>
              <span class="stat-value">{{ onlinePlayersCount }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-icon">🎮</span>
              <span class="stat-text">Parties actives</span>
              <span class="stat-value">{{ activeGamesCount }}</span>
            </div>
          </div>
        </div>

        <!-- Composant pour la liste des parties -->
        <div v-else-if="currentScreen === 'join-list'" key="join-list" class="screen sub-screen">
          <div class="screen-header">
            <button @click="currentScreen = 'main'" class="btn-back">
              ← Retour
            </button>
            <h2 class="screen-title">🔍 Rejoindre une partie</h2>
          </div>
          <JoinGameList
            :socket="socket"
            @back="currentScreen = 'main'"
            @gameJoined="onGameJoined"
          />
        </div>

        <!-- Composant pour le formulaire de création de partie -->
        <div v-else-if="currentScreen === 'create-form'" key="create-form" class="screen sub-screen">
          <div class="screen-header">
            <button @click="currentScreen = 'main'" class="btn-back">
              ← Retour
            </button>
            <h2 class="screen-title">✨ Créer une partie</h2>
          </div>
          <CreateGameForm
            :socket="socket"
            @back="currentScreen = 'main'"
            @gameCreated="onGameCreated"
          />
        </div>

        <!-- Composant pour l'écran d'attente -->
        <div v-else-if="currentScreen === 'waiting-queue'" key="waiting-queue" class="screen sub-screen">
          <div class="screen-header">
            <h2 class="screen-title">⏳ En attente...</h2>
          </div>
          <WaitingQueueScreen
            :socket="socket"
            :gameId="waitingGameId"
            :gameName="waitingGameName"
            @leftQueue="onLeftQueue"
            @gameStarted="onGameStarted"
          />
        </div>
      </Transition>
    </div>

    <!-- Footer du lobby -->
    <div class="lobby-footer">
      <div class="footer-tips">
        <div class="tip-item">
          <span class="tip-icon">💡</span>
          <span class="tip-text">Astuce : Utilise les flèches pour jouer en mode local</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted } from 'vue';
import { Socket } from 'socket.io-client';
import JoinGameList from './JoinGameList.vue';
import CreateGameForm from './CreateGameForm.vue';
import WaitingQueueScreen from './WaitingQueueScreen.vue';

export default defineComponent({
  name: 'Lobby',
  components: {
    JoinGameList,
    CreateGameForm,
    WaitingQueueScreen,
  },
  props: {
    socket: {
      type: Object as () => Socket,
      required: true,
    },
  },
  emits: ['startLocal', 'startAI', 'startRemote'],
  
  setup(props, { emit }) {
    type LobbyScreen = 'main' | 'join-list' | 'create-form' | 'waiting-queue';
    
    const currentScreen = ref<LobbyScreen>('main');
    const waitingGameId = ref<string | null>(null);
    const waitingGameName = ref<string | null>(null);
    const onlinePlayersCount = ref(0);
    const activeGamesCount = ref(0);

    // Événements socket
    const setupSocketListeners = () => {
      props.socket.on('connect', () => {
        console.log('✅ Lobby: Socket connecté avec succès !');
        // Demander les stats du lobby
        props.socket.emit('requestLobbyStats');
      });
      
      props.socket.on('disconnect', () => {
        console.log('❌ Lobby: Socket déconnecté');
      });

      // Écouter les stats du lobby
      props.socket.on('lobbyStats', (stats: { players: number; games: number }) => {
        onlinePlayersCount.value = stats.players;
        activeGamesCount.value = stats.games;
      });
    };

    const cleanupSocketListeners = () => {
      props.socket.off('connect');
      props.socket.off('disconnect');
      props.socket.off('lobbyStats');
    };

    const onGameJoined = (game: { id: string; name: string }) => {
      waitingGameId.value = game.id;
      waitingGameName.value = game.name;
      currentScreen.value = 'waiting-queue';
    };

    const onGameCreated = (game: { id: string; name: string }) => {
      console.log('🎮 LOBBY: Partie créée reçue:', game);
      waitingGameId.value = game.id;
      waitingGameName.value = game.name;
      currentScreen.value = 'waiting-queue';
    };

    const onLeftQueue = () => {
      waitingGameId.value = null;
      waitingGameName.value = null;
      currentScreen.value = 'main';
    };

    const onGameStarted = (roomId: string) => {
      emit('startRemote', { mode: 'remote', roomId: roomId });
    };

    onMounted(() => {
      setupSocketListeners();
      
      // Demander les stats périodiquement
      const statsInterval = setInterval(() => {
        if (props.socket.connected) {
          props.socket.emit('requestLobbyStats');
        }
      }, 5000); // Toutes les 5 secondes

      // Nettoyer à la destruction
      onUnmounted(() => {
        cleanupSocketListeners();
        clearInterval(statsInterval);
      });
    });

    return {
      currentScreen,
      waitingGameId,
      waitingGameName,
      onlinePlayersCount,
      activeGamesCount,
      onGameJoined,
      onGameCreated,
      onLeftQueue,
      onGameStarted,
    };
  },
});
</script>

<style scoped>
.lobby-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
  min-height: 600px;
  display: flex;
  flex-direction: column;
}

/* Header */
.lobby-header {
  text-align: center;
  margin-bottom: 3rem;
  position: relative;
}

.lobby-title {
  margin-bottom: 2rem;
}

.title-main {
  font-size: 3rem;
  font-weight: 800;
  background: var(--gradient-primary);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 1rem;
}

.title-subtitle {
  font-size: 1.2rem;
  color: var(--color-text);
  opacity: 0.8;
  margin: 0;
}

.connection-indicator {
  display: flex;
  justify-content: center;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: rgba(255, 82, 82, 0.1);
  border: 1px solid #ff5252;
  color: #ff5252;
  border-radius: 25px;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.3s ease;
}

.connection-status.connected {
  background: rgba(76, 175, 80, 0.1);
  border-color: #4caf50;
  color: #4caf50;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 2s infinite;
}

/* Contenu principal */
.lobby-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.screen {
  width: 100%;
}

.main-screen {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.sub-screen {
  min-height: 400px;
}

.screen-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border);
}

.btn-back {
  padding: 0.75rem 1.5rem;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 15px;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 500;
}

.btn-back:hover {
  background: var(--color-primary);
  color: white;
  transform: translateY(-2px);
}

.screen-title {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

/* Grille des modes de jeu */
.game-modes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.game-mode-card {
  background: var(--color-background-soft);
  border: 2px solid var(--color-border);
  border-radius: 20px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.game-mode-card:hover {
  transform: translateY(-8px);
  box-shadow: var(--shadow-lg);
}

.game-mode-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  transition: left 0.5s ease;
}

.game-mode-card:hover::before {
  left: 100%;
}

.local-card:hover {
  border-color: #2196f3;
  box-shadow: 0 10px 30px rgba(33, 150, 243, 0.3);
}

.ai-card:hover {
  border-color: #4caf50;
  box-shadow: 0 10px 30px rgba(76, 175, 80, 0.3);
}

.online-card:hover {
  border-color: #9c27b0;
  box-shadow: 0 10px 30px rgba(156, 39, 176, 0.3);
}

.create-card:hover {
  border-color: #ff9800;
  box-shadow: 0 10px 30px rgba(255, 152, 0, 0.3);
}

.card-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  display: block;
}

.card-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: var(--color-text);
}

.card-description {
  font-size: 1rem;
  color: var(--color-text);
  opacity: 0.8;
  margin-bottom: 1rem;
}

.card-players {
  padding: 0.5rem 1rem;
  background: var(--gradient-primary);
  color: white;
  border-radius: 15px;
  font-size: 0.9rem;
  font-weight: 600;
  display: inline-block;
}

/* Statistiques du lobby */
.lobby-stats {
  display: flex;
  justify-content: center;
  gap: 2rem;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  transition: all 0.3s ease;
}

.stat-item:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-md);
}

.stat-icon {
  font-size: 1.2rem;
}

.stat-text {
  font-size: 0.9rem;
  color: var(--color-text);
  opacity: 0.8;
}

.stat-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-primary);
  background: var(--gradient-primary);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Footer */
.lobby-footer {
  margin-top: 2rem;
  text-align: center;
}

.footer-tips {
  display: flex;
  justify-content: center;
}

.tip-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: rgba(var(--color-primary-rgb), 0.1);
  border: 1px solid var(--color-primary);
  border-radius: 20px;
  color: var(--color-text);
  font-size: 0.9rem;
}

.tip-icon {
  font-size: 1.1rem;
}

/* Transitions */
.lobby-screen-enter-active, .lobby-screen-leave-active {
  transition: all 0.4s ease;
}

.lobby-screen-enter-from {
  opacity: 0;
  transform: translateX(30px) scale(0.95);
}

.lobby-screen-leave-to {
  opacity: 0;
  transform: translateX(-30px) scale(0.95);
}

/* Animations */
@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

/* Responsive */
@media (max-width: 768px) {
  .lobby-container {
    padding: 1rem;
  }
  
  .title-main {
    font-size: 2rem;
  }
  
  .game-modes-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .lobby-stats {
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
  
  .screen-header {
    flex-direction: column;
    text-align: center;
    gap: 1rem;
  }
}

@media (max-width: 480px) {
  .game-mode-card {
    padding: 1.5rem;
  }
  
  .card-icon {
    font-size: 2.5rem;
  }
  
  .card-title {
    font-size: 1.3rem;
  }
}
</style>
