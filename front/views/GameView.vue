<template>
  <div class="game-view">
    <!-- Background animé -->
    <div class="game-background">
      <div class="floating-shapes">
        <div class="shape shape-1"></div>
        <div class="shape shape-2"></div>
        <div class="shape shape-3"></div>
        <div class="shape shape-4"></div>
      </div>
    </div>

    <!-- Header de la page -->
    <div class="game-header">
      <div class="game-title">
        <h1 class="title-text">🎮 MasterPong Arena</h1>
        <p class="subtitle-text">Choisis ton mode de jeu et commence l'aventure !</p>
      </div>
      
      <!-- Indicateur de mode actuel -->
      <div class="mode-indicator">
        <div class="indicator-content">
          <span class="mode-emoji">{{ getModeEmoji() }}</span>
          <span class="mode-text">{{ getModeText() }}</span>
        </div>
        
        <!-- Bouton retour au lobby (affiché uniquement si on n'est pas dans le lobby) -->
        <button 
          v-if="mode !== 'lobby'" 
          @click="returnToLobby"
          class="btn btn-back"
          title="Retour au lobby"
        >
          🏠 Lobby
        </button>
      </div>
    </div>

    <!-- Contenu principal avec transitions -->
    <div class="game-content">
      <Transition name="game-fade" mode="out-in">
        <!-- Lobby -->
        <div v-if="mode === 'lobby'" key="lobby" class="game-section lobby-section">
          <div class="lobby-wrapper">
            <Lobby
              @startLocal="() => setMode('local')"
              @startAI="() => setMode('ai')"
              @startRemote="onRemoteStart"
              :socket="socket"
            />
          </div>
        </div>

        <!-- Jeu Local -->
        <div v-else-if="mode === 'local'" key="local" class="game-section play-section">
          <div class="game-wrapper">
            <div class="game-header-mini">
              <h2>🏠 Mode Local</h2>
              <p>Joue contre un ami sur le même appareil</p>
            </div>
            <LocalGame class="game-container" />
          </div>
        </div>

        <!-- Jeu IA -->
        <div v-else-if="mode === 'ai'" key="ai" class="game-section play-section">
          <div class="game-wrapper">
            <div class="game-header-mini">
              <h2>🤖 Mode IA</h2>
              <p>Défi l'intelligence artificielle</p>
            </div>
            <AIGame class="game-container" />
          </div>
        </div>

        <!-- Jeu en ligne -->
        <div v-else-if="mode === 'remote'" key="remote" class="game-section play-section">
          <div class="game-wrapper">
            <div class="game-header-mini">
              <h2>🌐 Mode En ligne</h2>
              <p>Room: <code class="room-id">{{ roomId }}</code></p>
            </div>
            <RemoteGame
              :socket="socket"
              :roomId="roomId"
              class="game-container"
              @leaveGame="handleLeaveGame"
            />
          </div>
        </div>
      </Transition>
    </div>

    <!-- Footer avec informations -->
    <div class="game-footer">
      <div class="footer-content">
        <div class="stats-info">
          <div class="stat-item">
            <span class="stat-icon">👥</span>
            <span class="stat-text">{{ getPlayerCountText() }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">🎯</span>
            <span class="stat-text">Mode: {{ getModeText() }}</span>
          </div>
          <div class="stat-item" v-if="mode === 'remote' && roomId">
            <span class="stat-icon">🔗</span>
            <span class="stat-text">Room: {{ roomId }}</span>
          </div>
        </div>
        
        <div class="connection-status">
          <div class="status-indicator" :class="{ online: isSocketConnected }">
            <span class="status-dot"></span>
            <span>{{ isSocketConnected ? 'Connecté' : 'Déconnecté' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, onUnmounted } from 'vue';
import { io, Socket } from 'socket.io-client';
import Lobby from '../components/game/lobby/Lobby.vue';
import LocalGame from '../components/game/lobby/LocalGame.vue';
import AIGame from '../components/game/lobby/AIGame.vue';
import RemoteGame from '../components/game/lobby/RemoteGame.vue';

export default defineComponent({
  components: { Lobby, LocalGame, AIGame, RemoteGame },
  setup() {
    const mode = ref<'lobby'|'local'|'ai'|'remote'>('lobby');
    const roomId = ref<string>('');
    const isSocketConnected = ref(false);
    
    // Initialiser socket
    const socket: Socket = io('http://localhost:3000');

    // États de connexion socket
    onMounted(() => {
      socket.on('connect', () => {
        isSocketConnected.value = true;
        console.log('✅ Socket connecté');
      });

      socket.on('disconnect', () => {
        isSocketConnected.value = false;
        console.log('❌ Socket déconnecté');
      });
    });

    onUnmounted(() => {
      socket.disconnect();
    });

    // Fonctions
    function setMode(m: typeof mode.value) {
      mode.value = m;
      console.log(`🎮 Mode changé vers: ${m}`);
    }

    function onRemoteStart({ mode: m, roomId: rid }: {mode:string, roomId:string}) {
      roomId.value = rid;
      mode.value = 'remote';
      console.log(`🌐 Jeu en ligne démarré - Room: ${rid}`);
    }

    function handleLeaveGame() {
      console.log('🏠 Retour au lobby depuis RemoteGame');
      returnToLobby();
    }

    function returnToLobby() {
      mode.value = 'lobby';
      roomId.value = '';
      console.log('🏠 Retour au lobby');
    }

    // Fonctions utilitaires pour l'affichage
    function getModeEmoji() {
      const emojis = {
        lobby: '🏛️',
        local: '🏠',
        ai: '🤖',
        remote: '🌐'
      };
      return emojis[mode.value];
    }

    function getModeText() {
      const texts = {
        lobby: 'Lobby',
        local: 'Mode Local',
        ai: 'Mode IA',
        remote: 'Mode En ligne'
      };
      return texts[mode.value];
    }

    function getPlayerCountText() {
      const counts = {
        lobby: 'En attente',
        local: '2 Joueurs',
        ai: '1 Joueur vs IA',
        remote: 'Multijoueur'
      };
      return counts[mode.value];
    }

    return { 
      mode, 
      roomId, 
      socket, 
      isSocketConnected,
      setMode, 
      onRemoteStart, 
      handleLeaveGame,
      returnToLobby,
      getModeEmoji,
      getModeText,
      getPlayerCountText
    };
  }
});
</script>

<style scoped>
.game-view {
  min-height: 100vh;
  position: relative;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #667eea0f 0%, #764ba200 100%);
  overflow-x: hidden;
}

/* Background animé */
.game-background {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: -1;
  background: linear-gradient(135deg, var(--color-background) 0%, var(--color-background-soft) 100%);
}

.floating-shapes {
  position: absolute;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.shape {
  position: absolute;
  border-radius: 50%;
  background: linear-gradient(45deg, var(--color-primary), var(--color-secondary));
  opacity: 0.1;
  animation: float 6s ease-in-out infinite;
}

.shape-1 {
  width: 80px;
  height: 80px;
  top: 20%;
  left: 10%;
  animation-delay: -2s;
}

.shape-2 {
  width: 120px;
  height: 120px;
  top: 60%;
  right: 15%;
  animation-delay: -4s;
}

.shape-3 {
  width: 100px;
  height: 100px;
  bottom: 20%;
  left: 20%;
  animation-delay: -1s;
}

.shape-4 {
  width: 60px;
  height: 60px;
  top: 10%;
  right: 30%;
  animation-delay: -3s;
}

@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(180deg); }
}

/* Header */
.game-header {
  padding: 2rem;
  text-align: center;
  background: rgba(var(--color-background-soft-rgb), 0.8);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 100;
}

.game-title {
  margin-bottom: 1.5rem;
}

.title-text {
  font-size: 3rem;
  background: var(--gradient-primary);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 0.5rem;
  font-weight: 800;
}

.subtitle-text {
  color: var(--color-text);
  opacity: 0.8;
  font-size: 1.1rem;
}

/* Indicateur de mode */
.mode-indicator {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 2rem;
}

.indicator-content {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 2rem;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 25px;
  box-shadow: var(--shadow-sm);
}

.mode-emoji {
  font-size: 1.5rem;
}

.mode-text {
  font-weight: 600;
  color: var(--color-text);
  font-size: 1.1rem;
}

.btn-back {
  padding: 0.75rem 1.5rem;
  background: var(--gradient-secondary);
  color: white;
  border: none;
  border-radius: 20px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: var(--shadow-md);
}

.btn-back:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

/* Contenu principal */
.game-content {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem;
  min-height: 600px;
}

.game-section {
  width: 100%;
  max-width: 1200px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.lobby-section {
  min-height: 500px;
}

.lobby-wrapper {
  width: 100%;
  max-width: 800px;
}

.play-section {
  flex-direction: column;
  gap: 2rem;
}

.game-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  width: 100%;
}

.game-header-mini {
  text-align: center;
  padding: 1.5rem;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  box-shadow: var(--shadow-md);
  max-width: 600px;
  width: 100%;
}

.game-header-mini h2 {
  font-size: 1.8rem;
  margin-bottom: 0.5rem;
  background: var(--gradient-primary);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.game-header-mini p {
  color: var(--color-text);
  opacity: 0.8;
  margin: 0;
}

.room-id {
  background: var(--color-primary);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 5px;
  font-family: 'Courier New', monospace;
  font-weight: bold;
}

/* Conteneur de jeu */
.game-container {
  width: 100%;
  max-width: 700px;
  height: 500px;
  background: var(--color-background-soft);
  border: 2px solid var(--color-border);
  border-radius: 25px;
  box-shadow: var(--glow-primary);
  transition: all 0.3s ease;
  overflow-y: scroll;
}

.game-container:hover {
  transform: translateY(-5px);
  box-shadow: var(--glow-primary-strong);
}

/* Footer */
.game-footer {
  padding: 1.5rem 2rem;
  background: rgba(var(--color-background-soft-rgb), 0.8);
  backdrop-filter: blur(10px);
  border-top: 1px solid var(--color-border);
}

.footer-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
}

.stats-info {
  display: flex;
  gap: 2rem;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 15px;
}

.stat-icon {
  font-size: 1.1rem;
}

.stat-text {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text);
  opacity: 0.8;
}

.connection-status {
  display: flex;
  align-items: center;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 15px;
  font-size: 0.9rem;
  font-weight: 500;
  background: rgba(255, 82, 82, 0.1);
  color: #ff5252;
  border: 1px solid #ff5252;
}

.status-indicator.online {
  background: rgba(76, 175, 80, 0.1);
  color: #4caf50;
  border: 1px solid #4caf50;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

/* Transitions */
.game-fade-enter-active, .game-fade-leave-active {
  transition: all 0.4s ease;
}

.game-fade-enter-from {
  opacity: 0;
  transform: translateY(30px) scale(0.95);
}

.game-fade-leave-to {
  opacity: 0;
  transform: translateY(-30px) scale(0.95);
}

/* Responsive */
@media (max-width: 768px) {
  .title-text {
    font-size: 2rem;
  }
  
  .mode-indicator {
    flex-direction: column;
    gap: 1rem;
  }
  
  .game-content {
    padding: 1rem;
  }
  
  .game-container {
    height: 400px;
    margin: 0 1rem;
  }
  
  .footer-content {
    flex-direction: column;
    gap: 1rem;
  }
  
  .stats-info {
    flex-wrap: wrap;
    justify-content: center;
    gap: 1rem;
  }
}

@media (max-width: 480px) {
  .game-header {
    padding: 1rem;
  }
  
  .title-text {
    font-size: 1.8rem;
  }
  
  .stats-info {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .stat-item {
    justify-content: center;
  }
}
</style>
