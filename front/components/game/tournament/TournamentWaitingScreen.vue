<template>
  <div class="tw-wrap" v-if="t">
    <header class="tw-head">
      <div>
        <h2 class="tw-title">🏆 {{ t.name }}</h2>
        <div class="tw-meta">
          <span>👥 {{ t.participants.length }}/{{ t.maxPlayers }}</span>
          <span>👑 Hôte : <strong>{{ t.host }}</strong></span>
          <span v-if="t.status==='waiting'">⏳ Auto‑start dans <strong>{{ displayTimeLeft }}</strong></span>
          <span v-else-if="t.status==='running'">🎬 En cours</span>
          <span v-else>🏁 Terminé</span>
        </div>
      </div>
     <div class="tw-actions" v-if="isHost && t.status==='waiting'">
        <button class="btn" @click="openCustomization">⚙️ Options globales</button>
        <button class="btn" @click="forceFill">Remplir avec bots</button>
        <button class="btn primary" @click="startNow">Démarrer</button>
      </div>
    </header>

    <section class="tw-content">
      <div class="tw-left">
        <div class="panel">
          <h3>Participants</h3>
          <ul class="plist">
            <li v-for="p in t.participants" :key="p.username">
              <span :class="{ bot: p.isBot }">{{ p.username }}</span>
              <span v-if="p.eliminated" class="pill out">éliminé</span>
              <span v-else-if="p.isBot" class="pill bot">bot</span>
              <span v-else-if="p.username===t.host" class="pill host">hôte</span>
            </li>
          </ul>
        </div>

      
        <div class="panel warn" v-if="t.status==='waiting' && secondsLeft <= 15">
          ⛳ Le tournoi va démarrer. Des bots seront ajoutés si nécessaire.
        </div>
      </div>

      <div class="tw-right">
        <div class="panel">
          <h3>Actions</h3>
          <div class="stack">
            <button class="btn ghost" @click="$emit('back')">← Retour</button>
            <button class="btn danger" @click="leave">Quitter le tournoi</button>
          </div>
        </div>

        <div class="panel" v-if="runningMatches.length">
          <h3>Matchs en cours</h3>
          <ul class="rlist">
            <li v-for="match in runningMatches" :key="match.roomId">
              <div class="match-line">
                <span class="match-player">{{ match.p1 || '???' }}</span>
                <span class="match-versus">vs</span>
                <span class="match-player">{{ match.p2 || '???' }}</span>
                <span v-if="match.round" class="match-round">Round {{ match.round }}</span>
              </div>
              <button class="btn" @click="spectate(match.roomId)">👁️ Spectate</button>
            </li>
          </ul>
        </div>
        <div class="panel" v-if="t?.status!=='completed'">
          <h3>État du round</h3>
          <div class="cols">
            <div class="col">
              <h4>✅ Qualifiés</h4>
              <ul><li v-for="u in winnersNow" :key="u">{{ u }}</li><li v-if="!winnersNow.length" class="muted">—</li></ul>
            </div>
            <div class="col">
              <h4>❌ Éliminés</h4>
              <ul><li v-for="u in eliminatedNow" :key="u">{{ u }}</li><li v-if="!eliminatedNow.length" class="muted">—</li></ul>
            </div>
          </div>
          <p v-if="roundCooldownLeft>0" class="muted">Prochain round dans {{ roundCooldownLeft }}s…</p>
        </div>

        <div class="panel tip" v-if="!myRoomId && t.status!=='completed'">
          ⏱️ Vous êtes en attente pour le round suivant.
        </div>
      </div>
    </section>

    <section class="tw-play" v-if="myRoomId">
      <h3>🎮 C’est votre tour !</h3>
      <p>Room : <code>{{ myRoomId }}</code></p>
      <div class="countdown" v-if="matchCountdown > 0">
        <div class="cd-label">Début dans</div>
        <div class="cd-big">{{ matchCountdown }}</div>
      </div>
      <p v-else class="muted">Lancement imminent…</p>
    </section>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, onBeforeUnmount } from 'vue'
import type { Socket } from 'socket.io-client'
import { useI18n } from '../../../composables/useI18n';

export default defineComponent({
  name: 'TournamentWaitingScreen',
  props: {
    socket: { type: Object as () => Socket, required: true },
    tournamentId: { type: String, required: true },
  },
  emits: ['startRemote', 'back'],
  setup(props, { emit }) {
    const { t: tt } = useI18n()
    const t = ref<any>(null)
    const runningRooms = ref<string[]>([])
    const runningMatches = computed(() => {
      const list = Array.isArray(runningRooms.value) ? runningRooms.value : []
      const rounds = t.value?.bracket?.rounds || []
      return list.map((rid) => {
        let info: any = null
        for (let rIndex = 0; rIndex < rounds.length; rIndex++) {
          const match = rounds[rIndex]?.find((m: any) => m?.roomId === rid)
          if (match) {
            info = {
              roomId: rid,
              round: rIndex + 1,
              p1: match.p1?.username || match.p1?.display || match.p1 || 'BYE',
              p2: match.p2?.username || match.p2?.display || match.p2 || 'BYE'
            }
            break
          }
        }
        return info || { roomId: rid, round: null, p1: null, p2: null }
      })
    })
    const myRoomId = ref<string>('')
    const matchCountdown = ref<number>(0)
    const secondsLeft = ref<number>(0)
    let countdownTimer: number | null = null
    let endAt = 0

    const me = localStorage.getItem('username') || 'anon'
    const isHost = computed(() => t.value && t.value.host === me)
    const displayTimeLeft = computed(() => {
      const s = Math.max(0, secondsLeft.value || 0)
      const m = Math.floor(s / 60), r = s % 60
      return m > 0 ? `${m}m${String(r).padStart(2,'0')}s` : `${r}s`
    })

   const winnersNow = computed<string[]>(() => {
     const tv = t.value
     if (!tv?.bracket) return []
     const rIdx = tv.currentRoundIndex ?? 0
     const round = tv.bracket.rounds?.[rIdx] || []
     return round
       .filter((m: any) => m.status === 'done' && m.winner)
       .map((m: any) => String(m.winner))
   })

   const eliminatedNow = computed<string[]>(() => {
     const tv = t.value
     if (!tv?.participants) return []
     return tv.participants
       .filter((p: any) => p.eliminated)
       .map((p: any) => p.username)
   })

   const roundCooldownLeft = ref(0)
   function onRoundComplete(p: any){
     if (!p || p.tournamentId !== props.tournamentId) return
     const total = Math.ceil((p.cooldownMs || 0) / 1000)
     roundCooldownLeft.value = total
     const int = window.setInterval(() => {
       roundCooldownLeft.value -= 1
       if (roundCooldownLeft.value <= 0) window.clearInterval(int)
     }, 1000)
   }

    function startLocalCountdown(serverSec:number){
      endAt = Date.now() + (serverSec*1000)
      secondsLeft.value = Math.max(0, Math.ceil((endAt - Date.now())/1000))
      if (countdownTimer) clearInterval(countdownTimer)
      countdownTimer = window.setInterval(() => {
        secondsLeft.value = Math.max(0, Math.ceil((endAt - Date.now())/1000))
        if (secondsLeft.value <= 0 && countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
      }, 1000) as unknown as number
    }

    function askJoin(){
      // Le serveur exige un alias pour rejoindre; on utilise le pseudo courant
      props.socket.emit('joinTournament', { tournamentId: props.tournamentId, alias: me })
    }
    function openCustomization(){ window.dispatchEvent(new Event('open-game-settings')) }
    function forceFill(){ props.socket.emit('forceFillWithBots', { tournamentId: props.tournamentId }) }
    function startNow(){ props.socket.emit('startTournament', { tournamentId: props.tournamentId }) }
    function leave(){
      props.socket.emit('leaveTournament', { tournamentId: props.tournamentId })
      emit('back')
    }
    function copyId(){
      navigator.clipboard?.writeText(props.tournamentId).catch(()=>{})
    }
    function spectate(roomId:string){
      if (!roomId) return
      try {
        localStorage.setItem('pendingRoomId', roomId)
        localStorage.setItem('pendingRoomSpectator', '1')
      } catch {}
      props.socket.emit('spectateMatch', { roomId })
      emit('startRemote', { mode: 'remote', roomId, tournamentId: props.tournamentId, spectator: true })
    }

    // sockets
    const onUpdate = (data:any) => {
      if (!data || data.id !== props.tournamentId) return
      t.value = data
      runningRooms.value = data.runningRooms || []
      if (data.status === 'waiting') startLocalCountdown(Number(data.timeLeftToFill || 0))
    }
    const onMatchStart = (p:any) => {
      if (!p || p.tournamentId !== props.tournamentId) return
      const meLc = String(me).toLowerCase()
      const isMine = String(p.p1||'').toLowerCase() === meLc || String(p.p2||'').toLowerCase() === meLc
      if (isMine) {
        myRoomId.value = p.roomId
        // rejoins la room maintenant
        props.socket.emit('joinChallengeRoom', { roomId: p.roomId, username: me })
        // bascule le parent en RemoteGame
        emit('startRemote', { mode: 'remote', roomId: p.roomId, tournamentId: props.tournamentId, spectator: false })
      }
    }
    const onMatchCountdown = (c:any) => {
      if (!c || !c.roomId) return
      if (myRoomId.value && c.roomId === myRoomId.value) {
        matchCountdown.value = Number(c.count) || 0
      }
    }
    const onFinished = (payload:any) => {
      myRoomId.value = ''
    }
    
    const onChallengeError = (e:any) => { console.warn('challengeError:', e) }
    onMounted(() => {
      props.socket.emit('identify', me)
      askJoin()
      props.socket.on('tournamentUpdate', onUpdate)
      props.socket.on('tournamentMatchStart', onMatchStart)
      props.socket.on('matchCountdown', onMatchCountdown)
      props.socket.on('tournamentFinished', onFinished)
      props.socket.on('tournamentRoundComplete', onRoundComplete)
      props.socket.on('challengeError', onChallengeError)
    })
    onBeforeUnmount(() => {
      if (countdownTimer) clearInterval(countdownTimer)
      props.socket.off('tournamentUpdate', onUpdate)
      props.socket.off('tournamentMatchStart', onMatchStart)
      props.socket.off('matchCountdown', onMatchCountdown)
      props.socket.off('tournamentFinished', onFinished)
      props.socket.off('tournamentRoundComplete', onRoundComplete)
      props.socket.off('challengeError', onChallengeError)
    })

    return { t, runningRooms, runningMatches, isHost, displayTimeLeft, secondsLeft, myRoomId, winnersNow, eliminatedNow, roundCooldownLeft, matchCountdown,
      openCustomization, forceFill, startNow, spectate, leave, copyId, tt }
  }
})
</script>

<style scoped>
.tw-wrap {
  display: grid;
  gap: 1.5rem;
  padding: 1.5rem 1.75rem;
  background: linear-gradient(160deg, var(--color-background-soft) 0%, var(--color-background) 100%);
  border: 1px solid var(--color-border);
  border-radius: 7px;
  box-shadow: var(--panel-shadow);
  backdrop-filter: blur(14px);
  opacity: 80%;
  transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}

.tw-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--panel-border, var(--color-border));
  border-radius: 7px;
  background: var(--panel-bg, var(--color-background-soft));
  box-shadow: var(--panel-shadow);
}

.tw-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--color-heading);
  text-shadow: 0 0 18px rgba(79, 172, 254, 0.35);
}

.tw-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
  margin-top: 0.35rem;
  font-size: 0.95rem;
  color: var(--color-text);
  opacity: 0.75;
}

.tw-meta strong {
  color: var(--color-text);
}

.tw-actions {
  display: flex;
  gap: 0.6rem;
}

.tw-content {
  display: grid;
  grid-template-columns: 1.7fr 1fr;
  gap: 1.25rem;
}

.panel {
  border-radius: 7px;
  padding: 1.1rem 1.25rem;
  border: 1px solid var(--panel-border, var(--color-border));
  background: var(--panel-bg, rgba(255, 255, 255, 0.72));
  box-shadow: var(--panel-shadow);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  margin-bottom: 10px;
}
.panel:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.panel.tip {
  border-color: var(--color-info-soft);
  background: var(--color-info-soft);
  color: var(--color-info-contrast);
}

.panel.warn {
  border-color: var(--color-warning);
  background: var(--color-warning-soft);
  color: var(--color-warning-contrast);
  font-weight: 600;
}

.plist {
  list-style: none;
  padding: 0;
  margin: 0;
}

.plist li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.35rem 0;
  font-weight: 500;
  color: var(--color-text);
}

.pill {
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-background);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.pill.out {
  border-color: var(--color-danger);
  color: white;
  background: var(--color-danger-soft);
}

.pill.bot {
  border-color: rgba(148, 163, 184, 0.45);
  color: white;
  background: rgba(148, 163, 184, 0.15);
}

.pill.host {
  border-color: var(--color-success);
  color: white;
  background: var(--color-success-soft);
}

.tw-right .stack {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.btn {
  padding: 0.5rem 0.85rem;
  border-radius: 7px;
  border: 1px solid white;
  background: var(--color-background-mute);
  color: var(--color-text);
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.btn:hover {
  transform: translateY(-2px);
  border-color: white;
  box-shadow: var(--shadow-md);
}

.btn.primary {
  color: #0b132b;
  background: var(--gradient-brand);
  border-color: transparent;
  box-shadow: var(--glow-primary);
}

.btn.primary:hover {
  transform: translateY(-3px);
  box-shadow: var(--glow-primary), var(--shadow-lg);
}

.btn.ghost {
  background: transparent;
  border-style: dashed;
  opacity: 0.9;
}

.btn.danger {
  border-color: var(--color-danger);
  color: var(--color-danger);
  background: transparent;
}

.btn.danger:hover {
  background: var(--color-danger-soft);
}

.tw-play {
  border-top: 1px dashed var(--color-border);
  padding: 1.5rem 1.25rem 0 1.25rem;
  background: rgba(79, 172, 254, 0.08);
  border-radius: 7px;
}

.countdown {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 0.75rem;
}

.cd-label {
  color: rgba(148, 163, 184, 0.95);
  font-weight: 600;
}

.cd-big {
  font-size: 2.75rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.muted {
  color: rgba(148, 163, 184, 0.72);
}

.cols {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.cols .col h4 {
  margin-bottom: 0.35rem;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-heading);
}

.cols ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.25rem;
}

.cols li {
  padding: 0.35rem 0.5rem;
  border-radius: 7px;
  background: rgba(148, 163, 184, 0.12);
}

.rlist {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.5rem;
}

.rlist li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.match-line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  font-weight: 600;
  color: var(--color-text);
}

.match-player {
  font-size: 0.95rem;
}

.match-versus {
  font-size: 0.85rem;
  opacity: 0.6;
}

.match-round {
  font-size: 0.8rem;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: rgba(79, 172, 254, 0.15);
  color: var(--color-primary);
}

.rlist code,
.tw-play code {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.85rem;
  padding: 0.2rem 0.45rem;
  border-radius: 6px;
  background: var(--color-background-mute);
}

@media (max-width: 1024px) {
  .tw-content {
    grid-template-columns: 1fr;
  }

  .tw-actions {
    width: 100%;
    justify-content: flex-end;
  }
}

@media (max-width: 768px) {
  .tw-wrap {
    padding: 1.1rem;
  }

  .tw-head {
    flex-direction: column;
  }

  .tw-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .tw-meta {
    gap: 0.5rem;
  }
}
</style>
