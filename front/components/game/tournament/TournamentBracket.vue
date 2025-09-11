<!-- src/components/game/tournament/TournamentBracket.vue -->
<template>
  <div class="tournament-bracket" v-if="bracket">
    <div class="columns">
      <div v-for="(round, rIdx) in bracket.rounds" :key="rIdx" class="round-col">
        <h3 class="round-title">{{ roundName(rIdx, bracket.rounds.length) }}</h3>
        <div class="matches">
          <div v-for="m in round" :key="m.id" class="match" :class="{ playing: m.status==='playing', done: m.status==='done' }">
            <div class="slot">
              <span :class="slotClass(m, 'p1')">{{ pretty(m.p1) }}</span>
              <span v-if="m.status==='done' && m.winner===m.p1?.username" class="badge win">✅</span>
              <span v-else-if="m.status==='done' && m.winner && m.p1 && m.p1.username !== m.winner" class="badge lose">❌</span>
            </div>
            <div class="vs">vs</div>
            <div class="slot">
              <span :class="slotClass(m, 'p2')">{{ pretty(m.p2) }}</span>
              <span v-if="m.status==='done' && m.winner===m.p2?.username" class="badge win">✅</span>
              <span v-else-if="m.status==='done' && m.winner && m.p2 && m.p2.username !== m.winner" class="badge lose">❌</span>
            </div>
            <div class="actions" v-if="m.roomId && m.status==='playing'">
              <button class="btn btn-spectate" @click="$emit('spectate', m.roomId)">👁️ Spectate</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
const props = defineProps<{ bracket: any }>();
defineEmits<{ (e:'spectate', roomId:string): void }>();
function pretty(p:any){ if(!p) return '—'; if(p.isBye) return 'BYE'; return p.username; }
function slotClass(m:any, side:'p1'|'p2'){ const p=m?.[side]; if(!p) return 'name'; if(p.isBye) return 'name bye'; if(m.status==='done') return m.winner===p.username?'name winner':'name loser'; return 'name'; }
function roundName(i:number,t:number){ if(i===t-1) return 'Finale'; if(i===t-2) return 'Demi-finales'; return `Round ${i+1}`; }
</script>

<style scoped>
/* petit style épuré (colonnes, ✅/❌, hover léger) */
.tournament-bracket { width:100% }
.columns { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px,1fr)); gap:1rem }
.round-col { background:var(--color-background); border:1px solid var(--color-border); border-radius:7px; padding:.75rem }
.round-title { margin:0 0 .75rem; font-weight:700; font-size:.95rem }
.matches { display:grid; gap:.75rem }
.match { border:1px solid var(--color-border); border-radius:7px; padding:.5rem .75rem; background:var(--color-background-soft); transition:.2s }
.match.playing { border-color:var(--color-primary); box-shadow:0 0 0 2px rgba(var(--color-primary-rgb),.15) inset }
.slot { display:flex; align-items:center; justify-content:space-between; gap:.5rem }
.name { font-weight:600 }
.name.bye { color:#9CA3AF; font-weight:500 }
.name.winner { color:#10B981 } .name.loser { color:#EF4444 }
.vs { margin:.25rem 0; text-align:center; font-size:.8rem; color:#9CA3AF }
.actions { display:flex; justify-content:flex-end; margin-top:.25rem }
.btn { padding:.25rem .5rem; border-radius:7px; border:1px solid var(--color-border); background:var(--color-background); cursor:pointer }
.btn:hover{ border-color:var(--color-primary) }
</style>
