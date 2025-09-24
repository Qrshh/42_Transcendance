<template>
  <div class="jt-wrap">
    <div class="header">
      <h2 class="title">🔎 {{ t.joinTournament }}</h2>
      <button class="btn" @click="refresh">{{ t.refresh }}</button>
    </div>

    <div v-if="loading" class="hint">{{ t.loading }}…</div>
    <div v-else-if="tournaments.length === 0" class="hint">{{ t.noTournaments }}</div>

    <ul class="list">
      <li v-for="t in tournaments" :key="t.id" class="card">
        <div class="main">
          <div class="name">🏆 {{ t.name }}</div>
          <div class="sub">👑 {{ t.host }} · 👥 {{ t.participants }}/{{ t.maxPlayers }}</div>
        </div>
        <div class="side">
          <div class="time" v-if="t.status==='waiting'">⏳ {{ fmtTime(t.timeLeftToFill) }}</div>
          <button 
            class="btn primary" 
            :disabled="t.status!=='waiting'|| t.participants>=t.maxPlayers" 
            @click="join(t)"
          >
            {{ t.join }}
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { Socket } from 'socket.io-client'
import { useI18n } from '../../../composables/useI18n';

const { t } = useI18n()

const props = defineProps<{ socket: Socket }>()
const emit = defineEmits<{ (e:'back'):void; (e:'joined', p:{ id:string, name:string }): void }>()

type TSumm = { id:string; name:string; host:string; participants:number; maxPlayers:number; status:'waiting'|'running'|'completed'; timeLeftToFill:number }

const tournaments = ref<TSumm[]>([])
const loading = ref(true)

function fmtTime(s:number){ s=Math.max(0,Math.floor(s)); const m=Math.floor(s/60), r=s%60; return m?`${m}m${String(r).padStart(2,'0')}s`:`${r}s` }
function refresh(){ props.socket.emit('getTournamentList') }
function join(t:TSumm){
   //demande de l'alias a l'utilisateur 
  const alias = prompt("Entrez votre alias pour ce tournoi ;", "")
  if(!alias || !alias.trim()){
    alert("Vous devez entrer un alias")
    return 
  }
  props.socket.emit('joinTournament', { tournamentId: t.id, alias: alias.trim() })
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
.jt-wrap {
  display: grid;
  gap: 1.5rem;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--color-heading);
}
.hint {
  color: rgba(148, 163, 184, 0.85);
  font-weight: 500;
  padding: 0.35rem 0;
}
.list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.85rem;
}
.card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.25rem;
  padding: 1rem 1.25rem;
  border-radius: 16px;
  border: 1px solid var(--panel-border, var(--color-border));
  background: var(--panel-bg, rgba(255, 255, 255, 0.75));
  box-shadow: var(--panel-shadow);
  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}
.card:hover {
  transform: translateY(-4px);
  border-color: var(--color-border-hover);
  box-shadow: var(--shadow-lg);
}
.main {
  display: grid;
  gap: 0.35rem;
}
.name {
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--color-heading);
}
.sub {
  color: rgba(148, 163, 184, 0.9);
  font-size: 0.95rem;
}
.side {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.time {
  color: var(--color-info-contrast);
  font-weight: 600;
  background: var(--color-info-soft);
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
}
.btn {
  padding: 0.55rem 1.1rem;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--color-background-mute);
  color: var(--color-text);
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
}
.btn:hover {
  transform: translateY(-2px);
  border-color: var(--color-border-hover);
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
.btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  box-shadow: none;
  transform: none;
  filter: grayscale(0.2);
}
@media (max-width: 768px) {
  .card {
    flex-direction: column;
    align-items: flex-start;
  }
  .side {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
