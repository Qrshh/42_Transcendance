<template>
  <div>
    <!-- Affiche le lobby tant qu’on n’a pas choisi de mode -->
    <Lobby
      v-if="mode === 'lobby'"
      @startLocal="() => setMode('local')"
      @startAI   ="() => setMode('ai')"
      @startRemote="onRemoteStart"
    />

    <!-- Selon le mode, on affiche le composant de jeu approprié -->
    <LocalGame
      v-if="mode === 'local'"
      class="game-container"
    />

    <AIGame
      v-if="mode === 'ai'"
      class="game-container"
    />

    <RemoteGame
      v-if="mode === 'remote'"	
      :socket="socket"
      :roomId="roomId"
      class="game-container"
    />
  </div>
</template>

<script lang="ts">
  import { defineComponent, ref } from 'vue';
  import { io, Socket } from 'socket.io-client';
  import Lobby from '../components/game/lobby/Lobby.vue';
  import LocalGame from '../components/game/lobby/LocalGame.vue';
  import AIGame    from '../components/game/lobby/AIGame.vue';
  import RemoteGame from '../components/game/lobby/RemoteGame.vue';
  
  export default defineComponent({
    components: { Lobby, LocalGame, AIGame, RemoteGame },
    setup() {
      const mode = ref<'lobby'|'local'|'ai'|'remote'>('lobby');
      const roomId = ref<string>('');
      const socket: Socket = io();
  
      function setMode(m: typeof mode.value) {
        mode.value = m;
      }
  
      function onRemoteStart({ mode: m, roomId: rid }: {mode:string, roomId:string}) {
        roomId.value = rid;
        mode.value = 'remote';
      }
  
      return { mode, roomId, socket, setMode, onRemoteStart };
    }
  });
</script>

<style>
  .game-container {
    width: 600px; height: 400px;
    margin: auto;
  }
</style>
