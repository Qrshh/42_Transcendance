<!-- src/components/TournamentWaitingScreen.vue -->
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

        <div class="panel tip" v-if="t.status==='waiting'">
          <p>Partage l’ID du tournoi pour que tes amis rejoignent : <code>{{ t.id }}</code></p>
          <button class="btn" @click="copyId">Copier l’ID</button>
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

        <div class="panel" v-if="runningRooms.length">
          <h3>Matchs en cours</h3>
          <ul class="rlist">
            <li v-for="rid in runningRooms" :key="rid">
              <code>{{ rid }}</code>
              <button class="btn" @click="spectate(rid)">👁️ Spectate</button>
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

export default defineComponent({
  name: 'TournamentWaitingScreen',
  props: {
    socket: { type: Object as () => Socket, required: true },
    tournamentId: { type: String, required: true },
  },
  emits: ['startRemote', 'back'],
  setup(props, { emit }) {
    const t = ref<any>(null)
    const runningRooms = ref<string[]>([])
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

   // ✅ AJOUT : listes qualifiés/éliminés (toujours des tableaux, jamais undefined)
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

   // ✅ AJOUT : compteur “prochain round”
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

    function askJoin(){ props.socket.emit('joinTournament', { tournamentId: props.tournamentId }) }
    function forceFill(){ props.socket.emit('forceFillWithBots', { tournamentId: props.tournamentId }) }
    function startNow(){ props.socket.emit('startTournament', { tournamentId: props.tournamentId }) }
    function leave(){
      props.socket.emit('leaveTournament', { tournamentId: props.tournamentId })
      emit('back')
    }
    function copyId(){
      navigator.clipboard?.writeText(props.tournamentId).catch(()=>{})
    }
    function spectate(roomId:string){ props.socket.emit('spectateMatch', { roomId }) }

    // sockets
    const onUpdate = (data:any) => {
      if (!data || data.id !== props.tournamentId) return
      t.value = data
      runningRooms.value = data.runningRooms || []
      if (data.status === 'waiting') startLocalCountdown(Number(data.timeLeftToFill || 0))
    }
    const onMatchStart = (p:any) => {
      if (!p || p.tournamentId !== props.tournamentId) return
      if (p.p1 === me || p.p2 === me) {
        myRoomId.value = p.roomId
        // rejoins la room maintenant
        props.socket.emit('joinChallengeRoom', { roomId: p.roomId, username: me })
        // bascule le parent en RemoteGame
        emit('startRemote', { mode: 'remote', roomId: p.roomId, tournamentId: props.tournamentId })
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
    
    onMounted(() => {
      props.socket.emit('identify', me)
      askJoin()
      props.socket.on('tournamentUpdate', onUpdate)
      props.socket.on('tournamentMatchStart', onMatchStart)
      props.socket.on('matchCountdown', onMatchCountdown)
      props.socket.on('tournamentFinished', onFinished)
      props.socket.on('tournamentRoundComplete', onRoundComplete)
    })
    onBeforeUnmount(() => {
      if (countdownTimer) clearInterval(countdownTimer)
      props.socket.off('tournamentUpdate', onUpdate)
      props.socket.off('tournamentMatchStart', onMatchStart)
      props.socket.off('matchCountdown', onMatchCountdown)
      props.socket.off('tournamentFinished', onFinished)
      props.socket.off('tournamentRoundComplete', onRoundComplete)
    })

    return { t, runningRooms, isHost, displayTimeLeft, secondsLeft, myRoomId, winnersNow, eliminatedNow, roundCooldownLeft, matchCountdown,
      forceFill, startNow, spectate, leave, copyId }
  }
})
</script>

<style scoped>
.tw-wrap{ display:grid; gap:1rem }
.tw-head{ display:flex; align-items:flex-start; justify-content:space-between }
.tw-title{ margin:0; font-size:1.25rem }
.tw-meta{ display:flex; gap:1rem; color:#6B7280 }
.tw-actions .btn{ margin-left:.5rem }
.tw-content{ display:grid; grid-template-columns:2fr 1fr; gap:1rem }
.panel{ border:1px solid var(--color-border); background:var(--color-background); border-radius:8px; padding:.75rem 1rem }
.panel.tip{ color:#6B7280 }
.panel.warn{ border-color:#F59E0B; background:rgba(245,158,11,.08) }
.plist{ list-style:none; padding:0; margin:0 } .plist li{ display:flex; align-items:center; gap:.5rem; padding:.25rem 0 }
.pill{ font-size:.75rem; padding:.1rem .4rem; border-radius:999px; border:1px solid var(--color-border) }
.pill.out{ border-color:#EF4444; color:#EF4444 } .pill.bot{ border-color:#6B7280; color:#6B7280 } .pill.host{ border-color:#10B981; color:#10B981 }
.bot{ opacity:.9 }
.tw-right .stack{ display:flex; flex-direction:column; gap:.5rem }
.btn{ color:white; padding:.4rem .7rem; border:1px solid var(--color-border); background:var(--color-background); border-radius:6px; cursor:pointer }
.btn.primary{ border-color:var(--color-primary) }
.btn.ghost{ opacity:.9 } .btn.danger{ border-color:#EF4444; color:#EF4444 }
.tw-play{ border-top:1px dashed var(--color-border); padding-top:1rem }
.countdown{ display:flex; align-items:center; gap:1rem; margin-top:.5rem }
.cd-label{ color:#9CA3AF }
.cd-big{ font-size:2.5rem; font-weight:800; letter-spacing:.02em; background:var(--gradient-primary); -webkit-background-clip:text; -webkit-text-fill-color:transparent }
</style>
