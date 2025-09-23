<template>
  <div class="game-view">
    <!-- Animated background -->
    <div class="game-background">
      <div class="floating-shapes">
        <div class="shape shape-1"></div>
        <div class="shape shape-2"></div>
        <div class="shape shape-3"></div>
        <div class="shape shape-4"></div>
      </div>
    </div>

    <!-- Page header -->
    <div class="game-header">
      <!-- Current mode indicator -->
      <div class="mode-indicator">
        <div class="indicator-content">
          <span class="mode-emoji">{{ getModeEmoji() }}</span>
          <span class="mode-text">{{ getModeText() }}</span>
        </div>
        
        <!-- Back to lobby button (shown only if not in lobby) -->
        <button 
          v-if="mode !== 'lobby'" 
          @click="returnToLobby"
          class="btn btn-back"
          :title="t.backToLobby"
        >
          🏠 {{ t.lobby }}
        </button>
      </div>
    </div>

    <!-- Main content with transitions -->
    <div class="game-content">
      <Transition name="game-fade" mode="out-in">
        <!-- Lobby -->
        <div v-if="mode === 'lobby'" key="lobby" class="game-section lobby-section">
          <div class="lobby-wrapper">
            <Lobby
              @startLocal="() => setMode('local')"
              @startAI="() => setMode('ai')"
              @startRemote="onRemoteStart"
              @startTournament="onTournamentStart"
              :socket="socket"
            />
          </div>
        </div>

        <!-- Local Game -->
        <div v-else-if="mode === 'local'" key="local" class="game-section play-section">
          <div class="game-wrapper">
            <div ref="gameContainerRef" class="">
              <LocalGame />
            </div>
          </div>
        </div>

        <!-- AI Game -->
        <div v-else-if="mode === 'ai'" key="ai" class="game-section play-section">
          <div class="game-wrapper">
            <div ref="gameContainerRef" class="">
              <AIGame />
            </div>
          </div>
        </div>

        <!-- Online Game -->
        <div v-else-if="mode === 'remote'" key="remote" class="game-section play-section">
          <div class="game-wrapper">
            <div ref="gameContainerRef" class="">
              <RemoteGame
                :socket="socket"
                :roomId="roomId"
                :isSpectator="spectatorMode"
                @leaveGame="handleLeaveGame"
                @gameEnded="onRemoteGameEnded"
              />
            </div>
            <div v-if="postMatchCountdown > 0" class="postmatch-overlay">
              <div class="box">
                <h3>🎉 {{ t.matchEnded }}</h3>
                <p>{{ t.backToTournament }} <strong>{{ postMatchCountdown }}</strong>s…</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Tournament waiting screen -->
        <div v-else-if="mode === 'tournament'" key="tournament" class="game-section play-section">
          <div class="game-wrapper">
            <TournamentWaitingScreen
              :socket="socket"
              :tournament-id="tournamentId"
              @back="returnToLobby"
              @startRemote="onRemoteStart"
            />
          </div>
        </div>
      </Transition>
    </div>

    <!-- Footer with information -->
    <div class="game-footer">
      <div class="footer-content">
        <div class="stats-info">
          <div class="stat-item">
            <span class="stat-icon">👥</span>
            <span class="stat-text">{{ getPlayerCountText() }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">🎯</span>
            <span class="stat-text">{{ t.mode }}: {{ getModeText() }}</span>
          </div>
          <div class="stat-item" v-if="mode === 'remote' && roomId">
            <span class="stat-icon">🔗</span>
            <span class="stat-text">{{ t.room }}: {{ roomId }}</span>
          </div>
        </div>
        
        <div class="connection-status">
          <div class="status-indicator" :class="{ online: isSocketConnected }">
            <span class="status-dot"></span>
            <span>{{ isSocketConnected ? t.connected : t.disconnected }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <GameCustomizationModal :open="showCustomizationModal" @close="closeCustomization" />
</template>


<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted } from 'vue';
import { io, Socket } from 'socket.io-client';
import { API_BASE, SOCKET_URL } from '../config'
import Lobby from '../components/game/lobby/Lobby.vue';
import LocalGame from '../components/game/lobby/LocalGame.vue';
import AIGame from '../components/game/lobby/AIGame.vue';
import RemoteGame from '../components/game/lobby/RemoteGame.vue';
import TournamentWaitingScreen from '../components/game/tournament/TournamentWaitingScreen.vue';
import GameCustomizationModal from '../components/game/settings/GameCustomizationModal.vue';
import { useI18n } from '../composables/useI18n'

const { t } = useI18n()

export default defineComponent({
  components: { Lobby, LocalGame, AIGame, RemoteGame, TournamentWaitingScreen, GameCustomizationModal },
  setup() {
    const mode   = ref<'lobby'|'local'|'ai'|'remote'|'tournament'>('lobby');
    const roomId = ref<string>('');
    const spectatorMode = ref(false);
    const isSocketConnected = ref(false);

    // 👉 tournoi courant (sert pour revenir à l’attente après un match)
    const tournamentId = ref<string>('');

    // 👉 overlay/cooldown post-match
    const postMatchCountdown = ref<number>(0);
    let postMatchTimer: number | null = null;

    const showCustomizationModal = ref(false);
    const openCustomization = () => { showCustomizationModal.value = true }
    const closeCustomization = () => { showCustomizationModal.value = false }

    // ⚙️ URL backend

    // 🔌 Socket client
    const socket: Socket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true
    });

    // 🔑 identification
    const identify = () => {
      const me = localStorage.getItem('username') || 'anon';
      socket.emit('identify', me);
    };
    
    /** évite les doubles join + (re)join partout où il faut */
    const joinedOnce = ref(false);
    function ensureJoined() {
      if (!roomId.value) return;
      if (spectatorMode.value) {
        socket.emit('spectateMatch', { roomId: roomId.value });
        return;
      }
      if (joinedOnce.value) return;
      const me = localStorage.getItem('username') || 'anon';
      socket.emit('joinChallengeRoom', { roomId: roomId.value, username: me });
      joinedOnce.value = true;
    }

    /** handler partagé pour l’event window */
    function onWinChallengeStart(e: any) {
      const rid = e?.detail?.roomId;
      if (!rid) return;
      spectatorMode.value = false;
      roomId.value = rid;
      mode.value = 'remote';
      joinedOnce.value = false;
      ensureJoined();
    }

    onMounted(() => {
      document.addEventListener('fullscreenchange', onFsChange)
      document.addEventListener('webkitfullscreenchange', onFsChange as any)
      socket.on('connect', () => {
        isSocketConnected.value = true;
        console.log('✅ Socket connecté');
        identify();
      });
      // Associe le pseudo à ce socket côté serveur
      const me = localStorage.getItem('username') || 'anon';
      socket.emit('identify', me);

      // Quand un défi est accepté -> lance la RemoteGame ici
      socket.on('challengeStart', ({ roomId: rid }) => {
        spectatorMode.value = false;
        roomId.value = rid;
        mode.value = 'remote';
        joinedOnce.value = false;
        ensureJoined();
      });

      // Au montage si pendingRoomId existe
      const pending = localStorage.getItem('pendingRoomId');
      const pendingSpectator = localStorage.getItem('pendingRoomSpectator') === '1';
      if (pending) {
        localStorage.removeItem('pendingRoomId');
        localStorage.removeItem('pendingRoomSpectator');
        roomId.value = pending;
        mode.value = 'remote';
        spectatorMode.value = pendingSpectator;
        joinedOnce.value = pendingSpectator ? true : false;
        ensureJoined();
      }

      // challengeStart relayé par window
      window.addEventListener('challengeStart', onWinChallengeStart);
      window.addEventListener('open-game-settings', openCustomization);

      socket.io.on('reconnect', () => {
        identify();
        joinedOnce.value = false;
        ensureJoined();
      });

      socket.on('disconnect', () => { isSocketConnected.value = false; });

      // 📈 stats MAJ
      socket.on('playerStatsUpdated', (p: { username: string }) => {
        const me = localStorage.getItem('username') || 'anon';
        if (p?.username === me) {
          console.log('📈 Stats MAJ pour', me);
          window.dispatchEvent(new CustomEvent('playerStatsUpdated'));
        }
      });
    });

    onUnmounted(() => {
      window.removeEventListener('challengeStart', onWinChallengeStart);
      socket.off('connect');
      socket.off('disconnect');
      socket.off('playerStatsUpdated');
      // @ts-ignore
      socket.io?.off?.('reconnect');
      socket.disconnect();
    });

    // ————— UI / navigation —————
    // Plein écran
    const gameContainerRef = ref<HTMLDivElement | null>(null)
    const isFullscreen = ref(false)
    const isFsSim = ref(false)
    function onFsChange() {
      isFullscreen.value = !!document.fullscreenElement || (document as any).webkitFullscreenElement
      try {
        if (isFullscreen.value) document.body.classList.add('game-fs-on')
        else document.body.classList.remove('game-fs-on')
      } catch {}
    }
    async function toggleFullscreen() {
      const el = gameContainerRef.value
      if (!el) return
      try {
        if (!document.fullscreenElement && !(document as any).webkitFullscreenElement && !isFsSim.value) {
          if (el.requestFullscreen) await el.requestFullscreen()
          else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen()
          else enableSimFs()
          isFullscreen.value = true
        } else {
          if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
            if (document.exitFullscreen) await document.exitFullscreen()
            else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen()
            isFullscreen.value = false
          }
          if (isFsSim.value) disableSimFs()
        }
      } catch (e) { console.warn('Fullscreen toggle failed', e); if (!isFsSim.value) enableSimFs(); else disableSimFs(); }
    }
    function enableSimFs(){
      const el = gameContainerRef.value; if (!el) return
      isFsSim.value = true
      try { document.documentElement.style.overflow = 'hidden'; document.body.classList.add('game-fs-on') } catch {}
      el.classList.add('fs-sim')
      try { document.dispatchEvent(new Event('fullscreenchange')) } catch {}
    }
    function disableSimFs(){
      const el = gameContainerRef.value; if (!el) return
      isFsSim.value = false
      try { document.documentElement.style.overflow = ''; document.body.classList.remove('game-fs-on') } catch {}
      el.classList.remove('fs-sim')
      try { document.dispatchEvent(new Event('fullscreenchange')) } catch {}
    }
    function setMode(m: typeof mode.value) {
      mode.value = m;
      console.log(`🎮 Mode changé vers: ${m}`);
    }

    // démarrage d’un match online (depuis l’écran tournoi)
    const endedOnce = ref(false);
    function onRemoteStart({ mode: m, roomId: rid, tournamentId: tid, spectator }: {mode:string, roomId:string, tournamentId?: string, spectator?: boolean}) {
      roomId.value = rid;
      mode.value = 'remote';
      spectatorMode.value = !!spectator;
      // mémorise le tournoi
      if (tid) {
        tournamentId.value = tid;
      } else if (rid?.startsWith('tourn-')) {
        // fallback: extraire depuis le roomId: tourn-<TID>-rX-mY-...
        const m = rid.match(/^tourn-(.*?)-r\d+-m\d+-/);
        if (m && m[1]) tournamentId.value = m[1];
      }
      console.log(`🌐 Jeu en ligne démarré - Room: ${rid}`);
      const me = localStorage.getItem('username') || 'anon';
      if (spectatorMode.value) {
        socket.emit('spectateMatch', { roomId: rid });
        joinedOnce.value = true;
      } else {
        socket.emit('joinChallengeRoom', { roomId: rid, username: me });
        joinedOnce.value = false;
        ensureJoined();
      }
      endedOnce.value = false; // prêt pour une nouvelle fin de partie
    }

    function onTournamentStart({ mode: m, tournamentId: tid }: { mode: string, tournamentId: string }) {
      spectatorMode.value = false;
      tournamentId.value = tid;
      mode.value = 'tournament';
    }

    function handleLeaveGame() {
      console.log('🏠 Retour au lobby depuis RemoteGame');
      returnToLobby();
    }

    // cooldown 5s puis retour à l’écran d’attente du tournoi
    function onGameEnded(payload:any){
      console.log('🏁 Fin de partie (GameView):', payload);
      if (postMatchTimer) { clearInterval(postMatchTimer); postMatchTimer = null; }

      if (tournamentId.value) {
        postMatchCountdown.value = 5;
        postMatchTimer = window.setInterval(() => {
          postMatchCountdown.value -= 1;
          if (postMatchCountdown.value <= 0 && postMatchTimer) {
            clearInterval(postMatchTimer); postMatchTimer = null;
            mode.value = 'tournament'; // retour à l’attente
          }
        }, 1000) as unknown as number;
      } else {
        // hors tournoi : ton ancien flux éventuel (ex: retour lobby)
        // returnToLobby();
      }
    }

    // proxy depuis RemoteGame : met à jour les stats et applique le cooldown tournoi
    function onRemoteGameEnded(payload:any){
      if (endedOnce.value) return;
      endedOnce.value = true;
      console.log('🏁 Fin de partie (GameView):', payload);
      window.dispatchEvent(new CustomEvent('playerStatsUpdated'));
      onGameEnded(payload); // applique le cooldown + retour tournoi si applicable
    }

    function returnToLobby() {
      mode.value = 'lobby';
      roomId.value = '';
      spectatorMode.value = false;
      joinedOnce.value = false;
      console.log('🏠 Retour au lobby');
    }

    // ————— helpers d’affichage —————
    function getModeEmoji() {
      return ({ lobby:'🏛️', local:'🏠', ai:'🤖', remote:'🌐', tournament:'🏆' } as const)[mode.value];
    }
    function getModeText() {
      return ({ lobby:'Lobby', local:'Mode Local', ai:'Mode IA', remote:'Mode En ligne', tournament:'Tournoi' } as const)[mode.value];
    }
    function getPlayerCountText() {
      return ({ lobby:'En attente', local:'2 Joueurs', ai:'1 Joueur vs IA', remote:'Multijoueur', tournament:'Tournoi' } as const)[mode.value];
    }

    onUnmounted(() => {
      if (postMatchTimer) { clearInterval(postMatchTimer); postMatchTimer = null; }
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('webkitfullscreenchange', onFsChange as any)
      window.removeEventListener('open-game-settings', openCustomization)
    });

    return {
      // state
      mode, roomId, socket, isSocketConnected,
      tournamentId, postMatchCountdown,
      gameContainerRef, isFullscreen,
      showCustomizationModal,
      closeCustomization,
      // actions
      setMode, onRemoteStart, handleLeaveGame, onRemoteGameEnded, returnToLobby, toggleFullscreen,
      // display
      getModeEmoji, getModeText, getPlayerCountText
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
  overflow-x: hidden;
  border-radius: 7px;
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
  padding: 10px;
  text-align: center;
  
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 10;
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
  border-radius: 7px;
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
  color: #000;
  border: none;
  border-radius: 7px;
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
  max-width: 1800px;
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
  position: relative; /* pour l'overlay post-match */
}

.game-header-mini {
  text-align: center;
  padding: 1.5rem;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 7px;
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
  border-radius: 7px;
  font-family: 'Courier New', monospace;
  font-weight: bold;
}

/* Conteneur de jeu */
.game-container {
  width: 100%;
  max-width: 1800px;
  height: 900px;
  background: var(--color-background-soft);
  border: 2px solid var(--color-border);
  border-radius: 7px;
  box-shadow: var(--glow-primary);
  transition: all 0.3s ease;
  overflow: hidden;
  position: relative;
}

/* Fallback fullscreen container */
.game-container.fs-sim{
  position: fixed; inset: 0; z-index: 9999; display:grid; place-items:center;
  background: var(--color-background);
  touch-action: none;
}
.game-container.fs-sim .pong-canvas{
  /* Fallback chain: 100vh -> var(--vh) -> 100dvh (modern iOS) */
  height: 100vh;
  height: calc(var(--vh, 1vh) * 100);
  height: 100dvh;
  width: auto; max-width: 100vw;
  /* Max-height chain aligned as well */
  max-height: 100vh;
  max-height: calc(var(--vh, 1vh) * 100);
  max-height: 100dvh;
}

/* Limite l'effet hover aux devices avec vrai survol, et jamais en plein écran */
@media (hover:hover) and (pointer:fine) {
  html:not(.fs-active) .game-container:hover {
    transform: translateY(-5px);
    box-shadow: var(--glow-primary-strong);
  }
}
/* Désactive le déplacement en plein écran (simulé ou natif) */
html.fs-active .game-container:hover,
.game-container.fs-sim:hover,
.game-container:has(.fs-root.fs-sim):hover {
  transform: none;
  box-shadow: var(--glow-primary);
}

/* Fullscreen button */
.fs-btn{
  position:absolute; top:10px; right:10px;
  background: var(--color-overlay-bg);
  color: var(--color-text); border:1px solid var(--color-border);
  width: 36px; height: 36px; border-radius: 8px;
  display:grid; place-items:center; cursor:pointer;
  box-shadow: 0 6px 16px rgba(0,0,0,.25);
  z-index: 20;
}
.fs-btn:hover{ background: rgba(var(--color-background-rgb), .2) }

/* Overlay post-match */
.postmatch-overlay{
  position:absolute; inset:0;
  display:flex; align-items:center; justify-content:center;
  background: var(--color-overlay-bg); backdrop-filter: blur(2px);
}
.postmatch-overlay .box{
  background: var(--color-background);
  border:1px solid var(--color-border);
  border-radius: 7px;
  padding: 1rem 1.25rem;
  text-align:center;
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
  border-radius: 7px;
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
  border-radius: 7px;
  font-size: 0.9rem;
  font-weight: 500;
  background: var(--color-danger-soft);
  color: var(--color-danger);
  border: 1px solid var(--color-danger);
}

.status-indicator.online {
  background: var(--color-success-soft);
  color: var(--color-success);
  border: 1px solid var(--color-success);
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
