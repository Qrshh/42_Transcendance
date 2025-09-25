<template>
  <div class="panel">
    <!-- Header -->
    <header class="lobby-header">
      <div class="header-left">
        <h1 class="title-main">🏛️ {{ t.lobbyTitle }}</h1>
        <p class="subtitle">{{ t.lobbySubtitle }}</p>
      </div>

      <div class="header-right">
        <span class="conn-pill" :class="{ connected: isConnected }" role="status" aria-live="polite">
          <span class="dot" aria-hidden="true"></span>
          {{ isConnected ? t.online : t.offline }}
        </span>
      </div>
    </header>

    <!-- Body -->
    <main>
      <Transition name="slidefade" mode="out-in">
        <!-- Main screen -->
        <section v-if="currentScreen === 'main'" key="main" class="section">
          <div class="modes-grid">
            <!-- Local -->
            <button class="mode-card tone-blue" @click="$emit('startLocal')">
              <div class="ic card-title">🏠 {{ t.localGame }}</div>
              <p class="card-desc">{{ t.localDesc }}</p>
              <span class="chip">👥 {{ t.twoPlayers }}</span>
              <span class="arrow">→</span>
            </button>

            <!-- AI -->
            <button class="mode-card tone-green" @click="$emit('startAI')">
              <div class="ic card-title">🤖 {{ t.aiGame }}</div>
              <p class="card-desc">{{ t.aiDesc }}</p>
              <span class="chip">🎯 {{ t.soloVsAI }}</span>
              <span class="arrow">→</span>
            </button>

            <button class="mode-card tone-orange" @click="currentScreen = 'join-tourn-list'">
              <div class="ic card-title">🏆 {{ t.joinTournament }}</div>
              <p class="card-desc">{{ t.joinTournamentDesc }}</p>
              <span class="chip">🔎 {{ t.tournaments }}</span>
              <span class="arrow">→</span>
            </button>

            <!-- Create tournament -->
            <button class="mode-card tone-orange" @click="currentScreen = 'create-tourn'">
              <div class="ic card-title">🏆 {{ t.createTournament }}</div>
              <p class="card-desc">{{ t.createTournamentDesc }}</p>
              <span class="chip">🚀 {{ t.host }}</span>
              <span class="arrow">→</span>
            </button>
          </div>

          <!-- Stats -->
          <div class="stats-grid">
            <div class="stat-card">
              <div class="s-ic">👥</div>
              <div class="s-col">
                <div class="s-val">{{ onlinePlayersCount }}</div>
                <div class="s-lb">{{ t.onlinePlayers }}</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="s-ic">🎮</div>
              <div class="s-col">
                <div class="s-val">{{ activeGamesCount }}</div>
                <div class="s-lb">{{ t.activeGames }}</div>
              </div>
            </div>
          </div>
        </section>

        <!-- Join -->
        <section v-else-if="currentScreen === 'join-list'" key="join" class="section">
          <div class="sub-header">
            <button class="btn ghost" @click="currentScreen = 'main'">← {{ t.back }}</button>
            <h2 class="sub-title">🔍 {{ t.joinGame }}</h2>
          </div>
          <JoinGameList
            :socket="socket"
            @back="currentScreen = 'main'"
            @gameJoined="onGameJoined"
          />
        </section>

        <!-- Create game -->
        <section v-else-if="currentScreen === 'create-form'" key="create" class="section">
          <div class="sub-header">
            <button class="btn ghost" @click="currentScreen = 'main'">← {{ t.back }}</button>
            <h2 class="sub-title">✨ {{ t.createGame }}</h2>
          </div>
          <CreateGameForm
            :socket="socket"
            @back="currentScreen = 'main'"
            @gameCreated="onGameCreated"
          />
        </section>

        <!-- Create tournament -->
        <section v-else-if="currentScreen === 'create-tourn'" key="create-tourn" class="section">
          <div class="sub-header">
            <button class="btn ghost" @click="currentScreen = 'main'">← {{ t.back }}</button>
            <h2 class="sub-title">🏆 {{ t.createTournament }}</h2>
          </div>
          <CreateTournamentForm
            :socket="socket"
            @back="currentScreen = 'main'"
            @tournamentCreated="onTournamentCreated"
          />
        </section>

        <!-- Waiting / queue -->
        <section v-else-if="currentScreen === 'waiting-queue'" key="waiting-queue" class="section">
          <div class="sub-header">
            <button class="btn ghost" @click="onLeftQueue()">← {{ t.leave }}</button>
            <h2 class="sub-title">⏳ {{ t.waiting }}</h2>
          </div>
          <WaitingQueueScreen
            :socket="socket"
            :gameId="waitingGameId"
            :gameName="waitingGameName"
            @leftQueue="onLeftQueue"
            @gameStarted="onGameStarted"
          />
        </section>

        <!-- Join tournament list -->
        <section v-else-if="currentScreen === 'join-tourn-list'" key="join-tourn" class="section">
          <div class="sub-header">
            <button class="btn ghost" @click="currentScreen = 'main'">← {{ t.back }}</button>
            <h2 class="sub-title">🔎 {{ t.openTournaments }}</h2>
          </div>
          <JoinTournamentList
            :socket="socket"
            @back="currentScreen = 'main'"
            @joined="onTournamentJoined"
          />
        </section>

        <!-- Tournament waiting -->
        <section v-else-if="currentScreen === 'tourn-waiting'" key="t-wait" class="section">
          <div class="sub-header">
            <button class="btn ghost" @click="currentScreen = 'main'">← {{ t.lobby }}</button>
            <h2 class="sub-title">⏳ {{ t.waiting }} — {{ waitingTournName || t.tournament }}</h2>
          </div>
          <TournamentWaitingScreen
            v-if="waitingTournId"
            :socket="socket"
            :tournament-id="waitingTournId!"
            @back="currentScreen = 'main'"
            @startRemote="(payload) => $emit('startRemote', payload)"
          />
        </section>
      </Transition>
    </main>

    <!-- Footer -->
    <footer class="lobby-footer">
      <div class="tip-pill">
        <span class="tip-ic">💡</span>
        <span class="tip-text">{{ t.tip }}</span>
      </div>
    </footer>
  </div>
</template>



<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted } from 'vue'
import type { Socket } from 'socket.io-client'

import JoinGameList from './JoinGameList.vue'
import CreateGameForm from './CreateGameForm.vue'
import WaitingQueueScreen from './WaitingQueueScreen.vue'
import CreateTournamentForm from '../tournament/CreateTournamentForm.vue'
import JoinTournamentList from '../tournament/JoinTournamentList.vue'
import TournamentWaitingScreen from '../tournament/TournamentWaitingScreen.vue'
import { useI18n } from '../../../composables/useI18n'




type LobbyScreen = 'main' | 'join-list' | 'create-form' | 'create-tourn' | 'waiting-queue' | 'join-tourn-list' | 'tourn-waiting'

export default defineComponent({
  name: 'Lobby',
  components: { JoinGameList, CreateGameForm, WaitingQueueScreen, CreateTournamentForm, JoinTournamentList, TournamentWaitingScreen },
  props: {
    socket: { type: Object as () => Socket, required: true }
  },
  emits: ['startLocal', 'startAI', 'startRemote', 'startTournament'],
  setup(props, { emit }) {
    const { t } = useI18n()
    const currentScreen = ref<LobbyScreen>('main')
    const waitingGameId = ref<string | null>(null)
    const waitingGameName = ref<string | null>(null)
    const waitingTournId = ref<string | null>(null)
    const waitingTournName = ref<string | null>(null)
    const onlinePlayersCount = ref(0)
    const activeGamesCount = ref(0)
    const isConnected = ref(props.socket.connected)
    let statsInterval: number | null = null

    // ---- sockets: connectivité + stats lobby
    const onConnect = () => { isConnected.value = true }
    const onDisconnect = () => { isConnected.value = false }
    const onLobbyStats = (data: { online: number; active: number }) => {
      onlinePlayersCount.value = data.online
      activeGamesCount.value = data.active
    }

    onMounted(() => {
      props.socket.on('connect', onConnect)
      props.socket.on('disconnect', onDisconnect)
      props.socket.on('lobbyStats', onLobbyStats)

      // ping régulier des stats (si ton backend le supporte)
      statsInterval = window.setInterval(() => {
        props.socket.emit('getLobbyStats')
      }, 3000)
    })

    onUnmounted(() => {
      props.socket.off('connect', onConnect)
      props.socket.off('disconnect', onDisconnect)
      props.socket.off('lobbyStats', onLobbyStats)
      if (statsInterval) window.clearInterval(statsInterval)
    })

    // ---- callbacks d’écrans
    function onGameJoined(g: { id: string; name: string }) {
      waitingGameId.value = g.id
      waitingGameName.value = g.name
      currentScreen.value = 'waiting-queue'
    }

    function onGameCreated(g: { id: string; name: string }) {
      waitingGameId.value = g.id
      waitingGameName.value = g.name
      currentScreen.value = 'waiting-queue'
    }

    function onTournamentCreated(t: { id?: string; roomId?: string; name?: string }) {
      const tid = (t && (t.roomId || t.id)) ? (t.roomId || t.id)! : null;
      if (tid) {
        // Lance le mode tournoi côté GameView
        waitingTournId.value = tid
        waitingTournName.value = t?.name || 'Tournoi'
        currentScreen.value = 'tourn-waiting'
        emit('startTournament', { mode: 'tournament', tournamentId: tid })
      } else {
        currentScreen.value = 'main';
      }
    }

    function onTournamentJoined(p:{ id:string, name:string }) {
        waitingTournId.value = p.id
        waitingTournName.value = p.name
        currentScreen.value = 'tourn-waiting'
        emit('startTournament', { mode: 'tournament', tournamentId: p.id })
      }
    function onLeftQueue() {
      waitingGameId.value = null
      waitingGameName.value = null
      currentScreen.value = 'main'
    }

    function onGameStarted(roomId: string) {
      emit('startRemote', { mode: 'remote', roomId })
    }

    const openCustomization = () => {
      window.dispatchEvent(new Event('open-game-settings'))
    }

    return {
      currentScreen,
      waitingGameId,
      waitingGameName,
      onlinePlayersCount,
      activeGamesCount,
      isConnected,
      onGameJoined,
      onGameCreated,
      waitingTournId,
      waitingTournName,
      onTournamentCreated,
      onTournamentJoined,
      onLeftQueue,
      onGameStarted,
      openCustomization,
      t
    }
  }
})
</script>


<style scoped>
/* ========= Palette pensée pour fond sombre façon GameView ========= */
.lobby-page { max-width: 1000px; margin: 0 auto; padding: 1.6rem }
.lobby-header {
  display:flex; align-items:center; justify-content:space-between;
  background: #31313100;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 7px;
  padding: 1rem 1.25rem;
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 30px rgba(0,0,0,.25);
  margin-bottom: 1rem;
  z-index:10;
}
.title-main {
  margin:0; font-weight: 800; font-size: 1.9rem;
  background: white; -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color: transparent;
}
.subtitle { margin:.25rem 0 0; color: rgba(255,255,255,.8) }

.conn-pill {
  display:inline-flex; align-items:center; gap:.5rem;
  padding:.55rem .9rem; border-radius: 999px; font-weight: 700; font-size:.9rem;
  color:#ef5350; border:1px solid #ef5350; background: rgba(239,83,80,.12);
}
.header-right {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.header-right .btn {
  border-radius: 10px;
  padding: 0.45rem 0.9rem;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  transition: transform .2s ease, box-shadow .2s ease;
}

.header-right .btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
.conn-pill.connected { color:#43c169; border-color:#43c169; background: rgba(67,193,105,.14) }
.conn-pill .dot { width:8px; height:8px; border-radius:50%; background: currentColor; animation:pulse 2s infinite }



/* Cartes modes : surface plus claire que panel (meilleur contraste) */
.modes-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: .9rem; margin-bottom: 1rem }
.mode-card{
  position:relative; text-align:left; overflow:hidden; cursor:pointer;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 7px;
  padding: 1rem;
  transition: transform .18s ease, box-shadow .25s ease, border-color .25s ease, background .25s ease;
  will-change: transform, box-shadow;
}
.mode-card .ic{ font-size:1.2rem; margin-bottom:.4rem }
.card-title{ margin:0 0 .5rem 0.6rem; font-weight:800; font-size:1.05rem; color:#fff }
.card-desc{ margin:0 0 .6rem 0; color: rgba(255,255,255,.78) }
.chip{
  display:inline-block; padding:.25rem .55rem; border-radius:7px;
  font-size:.8rem; font-weight:700; color:#fff;
  box-shadow: 0 4px 16px rgba(0,0,0,.25);
}

/* reflets au hover (sheen) + élévation */
.mode-card::before{
  content:""; position:absolute; inset:-30% -60%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.12), transparent);
  transform: translateX(-60%) rotate(12deg);
  transition: transform .6s ease;
  pointer-events:none;
}
.mode-card:hover{
  transform: translateY(-6px);
  box-shadow: 0 16px 40px rgba(0,0,0,.35);
  border-color: rgba(255,255,255,.16);
  background: rgba(255,255,255,.055);
}
.mode-card:hover::before{ transform: translateX(60%) rotate(12deg) }
.mode-card:active{ transform: translateY(-2px) scale(.995) }
.mode-card:focus-visible{ outline:3px solid rgba(99,102,241,.55); outline-offset:2px }

.arrow{
  position:absolute; right:.8rem; bottom:.7rem; opacity:.35; font-weight:800;
  transition: transform .18s ease, opacity .18s ease;
}
.mode-card:hover .arrow{ transform: translateX(4px); opacity:.6 }

/* teintes d’ombre légère lors du hover (sans peindre la carte entière) */
.tone-blue:hover   { box-shadow: 0 12px 30px rgba(33,150,243,.22) }
.tone-green:hover  { box-shadow: 0 12px 30px rgba(76,175,80,.22) }
.tone-purple:hover { box-shadow: 0 12px 30px rgba(156,39,176,.22) }
.tone-orange:hover { box-shadow: 0 12px 30px rgba(255,152,0,.22) }

/* Stats : même surface que cartes */
.stats-grid{ display:grid; grid-template-columns: repeat(auto-fit, minmax(240px,1fr)); gap:.9rem }
.stat-card{
  display:flex; align-items:center; gap:.8rem;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 7px; padding:.9rem;
  transition: transform .18s ease, box-shadow .25s ease;
}
.stat-card:hover{ transform: translateY(-3px); box-shadow: 0 10px 24px rgba(0,0,0,.28) }
.s-ic{ font-size:1.5rem }
.s-col{ display:grid }
.s-val{
  font-size:1.4rem; font-weight:800;
  background: var(--gradient-primary);
  -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color: transparent;
}
.s-lb{ color: rgba(255,255,255,.78) }

/* Sous-écrans */
.section{ animation: soft-in .22s ease }
.sub-header{ display:flex; align-items:center; justify-content:space-between; margin-bottom:.9rem }
.sub-title{ margin:0; font-weight:800; color:#fff }

/* Boutons */
.btn{ display:inline-flex; align-items:center; gap:.5rem; padding:.72rem 1.1rem; border-radius:7px; border:none; cursor:pointer; font-weight:700; transition: transform .16s ease, box-shadow .2s ease }
.btn.ghost{
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.08);
  color:#fff;
}
.btn:hover{ transform: translateY(-2px); box-shadow: 0 8px 18px rgba(0,0,0,.22) }

/* Footer */
.lobby-footer{ display:flex; justify-content:center; margin-top:1rem }
.tip-pill{
  display:inline-flex; align-items:center; gap:.5rem;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 999px;
  padding:.6rem .95rem; color:#fff;
}
.tip-ic{ opacity:.9 }

/* Motion/Transitions */
.slidefade-enter-active, .slidefade-leave-active{ transition: all .28s ease }
.slidefade-enter-from{ opacity:0; transform: translateY(8px) scale(.98) }
.slidefade-leave-to  { opacity:0; transform: translateY(-8px) scale(.98) }
@keyframes pulse{ 0%{opacity:1} 50%{opacity:.5} 100%{opacity:1} }
@keyframes soft-in{ from{opacity:0; transform:translateY(8px)} to{opacity:1; transform:translateY(0)} }

@media (prefers-reduced-motion: reduce){
  .mode-card, .stat-card, .btn, .slidefade-enter-active, .slidefade-leave-active{ transition:none !important }
  .conn-pill .dot{ animation:none }
}

/* Responsive */
@media (max-width: 768px){
  .lobby-page{ padding: 1rem }
  .lobby-header{ flex-direction:column; gap:.6rem; text-align:center }
  .modes-grid, .stats-grid{ grid-template-columns: 1fr }
}
</style>
