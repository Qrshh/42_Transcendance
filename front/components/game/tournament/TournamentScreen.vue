<!-- src/components/game/tournament/TournamentScreen.vue -->
<template>
  <div class="tournament-screen">
    <header class="head">
      <div class="left">
        <h2>🏆 {{ t?.name || 'Tournoi' }}</h2>
        <div class="meta">
          <span v-if="t">👥 {{ t.participants.length }}/{{ t.maxPlayers }}</span>
          <span v-if="t?.status==='waiting'">⏳ Démarrage dans {{ t.timeLeftToFill }}s</span>
          <span v-if="t?.status==='running'">🎬 Round {{ (t.currentRoundIndex ?? 0) + 1 }} / {{ t?.bracket?.rounds?.length || '-' }}</span>
          <span v-if="t?.status==='completed'">🏁 Terminé</span>
        </div>
      </div>
      <div class="right" v-if="amIHost && t?.status==='waiting'">
        <button class="btn" @click="onForceFill">Remplir avec bots</button>
        <button class="btn primary" @click="onStart">Démarrer</button>
      </div>
    </header>

    <section v-if="t && t.status!=='completed'" class="content">
      <div class="left-col">
        <TournamentBracket :bracket="t.bracket" @spectate="spectate" />
      </div>

      <div class="right-col">
        <div class="panel">
          <h3>Participants</h3>
          <ul>
            <li v-for="p in t.participants" :key="p.username">
              <span :class="{ bot: p.isBot }">{{ p.username }}</span>
              <span v-if="p.eliminated" class="tag out">éliminé</span>
            </li>
          </ul>
        </div>

        <div v-if="countdown>0" class="panel highlight">
          <h3>Début du match</h3>
          <div class="big">{{ countdown }}</div>
        </div>

        <div class="panel" v-if="runningRooms.length">
          <h3>Matchs en cours</h3>
          <ul>
            <li v-for="rid in runningRooms" :key="rid">
              <code>{{ rid }}</code>
              <button class="btn" @click="spectate(rid)">👁️ Spectate</button>
            </li>
          </ul>
        </div>

        <div class="panel tip" v-if="t?.status==='running' && !currentRoomId">
          <p>⏱️ Vous êtes en attente pour le round suivant.</p>
        </div>
      </div>
    </section>

    <section v-if="t?.status==='completed'" class="content">
      <div class="panel">
        <h3>Podium</h3>
        <ol class="podium">
          <li><span>🥇</span> {{ t.ranking?.champion }}</li>
          <li><span>🥈</span> {{ t.ranking?.runnerUp }}</li>
          <li><span>🥉</span> {{ t.ranking?.thirdPlaces?.join(' & ') }}</li>
        </ol>
      </div>
      <div class="panel">
        <h3>Classement complet</h3>
        <ol>
          <li v-for="r in t.ranking?.full" :key="r.username">{{ r.place }}. {{ r.username }}</li>
        </ol>
      </div>
    </section>

    <section v-if="currentRoomId" class="play-area">
      <div class="game-header-mini">
        <h2>🎮 Votre match</h2>
        <p>Room: <code class="room-id">{{ currentRoomId }}</code></p>
      </div>
      <RemoteGame :socket="socket" :roomId="currentRoomId" :isSpectator="true" @leaveGame="leaveMatch" @gameEnded="onGameEnded" />
    </section>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import type { Socket } from 'socket.io-client';
import TournamentBracket from './TournamentBracket.vue';
import RemoteGame from '../lobby/RemoteGame.vue';

const props = defineProps<{ socket: Socket, tournamentId: string }>();
defineEmits<{ (e:'leave'): void }>();

const t = ref<any>(null);
const amIHost = computed(() => (localStorage.getItem('username') || 'anon') === t.value?.host);

const currentRoomId = ref<string>(''); // quand c'est ton tour
const countdown = ref<number>(0);
const runningRooms = ref<string[]>([]);

function onForceFill(){ props.socket.emit('forceFillWithBots',{tournamentId:props.tournamentId}); }
function onStart(){ props.socket.emit('startTournament',{tournamentId:props.tournamentId}); }
function spectate(roomId:string){ props.socket.emit('spectateMatch',{roomId}); }
function leaveMatch(){ currentRoomId.value=''; }
function onGameEnded(){ currentRoomId.value=''; }

onMounted(()=>{
  const me = localStorage.getItem('username') || 'anon';
  props.socket.emit('identify', me);
  // s'inscrit à la room tournoi (si host c'est déjà fait côté serveur)
  props.socket.emit('joinTournament', { tournamentId: props.tournamentId });

  props.socket.on('tournamentUpdate', (data:any)=>{ if(data?.id!==props.tournamentId) return; t.value=data; runningRooms.value=(data.runningRooms||[]); });
  props.socket.on('tournamentMatchStart', (p:any)=>{ if(p?.tournamentId!==props.tournamentId) return;
    const me = localStorage.getItem('username') || 'anon';
    if(p.p1===me || p.p2===me){ currentRoomId.value=p.roomId; props.socket.emit('joinChallengeRoom',{roomId:p.roomId, username:me}); }
  });
  props.socket.on('matchCountdown',(c:any)=>{ if(currentRoomId.value && c.roomId===currentRoomId.value){ countdown.value=c.count; if(c.count<=0) setTimeout(()=>countdown.value=0,1200); }});
  props.socket.on('tournamentFinished',()=>{ currentRoomId.value=''; });
});
onBeforeUnmount(()=>{
  props.socket.off('tournamentUpdate');
  props.socket.off('tournamentMatchStart');
  props.socket.off('matchCountdown');
  props.socket.off('tournamentFinished');
});
</script>

<style scoped>
.tournament-screen{ display:grid; gap:1rem }
.head{ display:flex; justify-content:space-between; align-items:center }
.head .meta{ display:flex; gap:1rem; color:#9CA3AF; font-size:.9rem }
.btn{ padding:.4rem .7rem; border:1px solid var(--color-border); background:var(--color-background); border-radius:7px; cursor:pointer }
.btn.primary{ border-color:var(--color-primary) }
.content{ display:grid; grid-template-columns:2fr 1fr; gap:1rem }
.panel{ border:1px solid var(--color-border); background:var(--color-background); border-radius:7px; padding:.75rem 1rem }
.panel.highlight{ border-color:var(--color-primary) }
.panel.tip{ font-size:.95rem; color:#9CA3AF }
.right-col .panel + .panel{ margin-top:.75rem }
.podium{ list-style:none; padding:0; margin:0 } .podium li{ display:flex; align-items:center; gap:.5rem; padding:.25rem 0 }
.big{ font-size:2rem; font-weight:700; text-align:center }
.bot{ opacity:.85 }
.play-area{ border-top:1px dashed var(--color-border); padding-top:1rem }
</style>
