<!-- src/components/JoinTournamentList.vue -->
<template>
  <div class="jt-wrap">
    <div class="header">
      <h2 class="title">🔎 Rejoindre un tournoi</h2>
      <button class="btn" @click="refresh">Rafraîchir</button>
    </div>

    <div v-if="loading" class="hint">Chargement…</div>
    <div v-else-if="tournaments.length === 0" class="hint">Aucun tournoi en attente pour l’instant.</div>

    <ul class="list">
      <li v-for="t in tournaments" :key="t.id" class="card">
        <div class="main">
          <div class="name">🏆 {{ t.name }}</div>
          <div class="sub">👑 {{ t.host }} · 👥 {{ t.participants }}/{{ t.maxPlayers }}</div>
        </div>
        <div class="side">
          <div class="time" v-if="t.status==='waiting'">⏳ {{ fmtTime(t.timeLeftToFill) }}</div>
          <button class="btn primary" :disabled="t.status!=='waiting'|| t.participants>=t.maxPlayers" @click="join(t)">Rejoindre</button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { Socket } from 'socket.io-client'

const props = defineProps<{ socket: Socket }>()
const emit = defineEmits<{ (e:'back'):void; (e:'joined', p:{ id:string, name:string }): void }>()

type TSumm = { id:string; name:string; host:string; participants:number; maxPlayers:number; status:'waiting'|'running'|'completed'; timeLeftToFill:number }

const tournaments = ref<TSumm[]>([])
const loading = ref(true)

function fmtTime(s:number){ s=Math.max(0,Math.floor(s)); const m=Math.floor(s/60), r=s%60; return m?`${m}m${String(r).padStart(2,'0')}s`:`${r}s` }
function refresh(){ props.socket.emit('getTournamentList') }
function join(t:TSumm){
  props.socket.emit('joinTournament', { tournamentId: t.id })
  // Une fois rejoint, on bascule sur l'écran d'attente
  emit('joined', { id: t.id, name: t.name })
}

function onList(arr:TSumm[]){
  const list = Array.isArray(arr) ? arr : []
  // N'afficher que les tournois en attente (évite ceux déjà démarrés ou terminés)
  tournaments.value = list.filter(t => t.status === 'waiting')
  loading.value = false
}

onMounted(() => {
  props.socket.on('tournamentList', onList)
  refresh()
})
onBeforeUnmount(() => {
  props.socket.off('tournamentList', onList)
})
</script>

<style scoped>
.jt-wrap{ display:grid; gap:1rem }
.header{ display:flex; align-items:center; justify-content:space-between }
.title{ margin:0 }
.hint{ color:#6B7280 }
.list{ list-style:none; padding:0; margin:0; display:grid; gap:.75rem }
.card{ display:flex; justify-content:space-between; align-items:center; border:1px solid var(--color-border); background:var(--color-background); border-radius:8px; padding:.5rem .75rem }
.name{ font-weight:700 }
.sub{ color:#6B7280; font-size:.9rem }
.side{ display:flex; align-items:center; gap:.5rem }
.btn{ color: white; padding:.4rem .7rem; border:1px solid var(--color-border); background:var(--color-background); border-radius:6px; cursor:pointer }
.btn.primary{ border-color:var(--color-primary) }
.btn.ghost{ color: white; opacity:.9 }
.time{ color:#6B7280 }
</style>
