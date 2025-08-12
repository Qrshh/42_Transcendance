<template>
  <div class="p-4 space-y-4">
    <button @click="startLocal" class="btn">P. vs P. (local)</button>
    <button @click="startAI"    class="btn">P. vs A.I.</button>
    <button @click="onCreate"   class="btn"> {{ t.createRoom }}</button>
    <button @click="refreshList" class="btn"> {{ t.joinRoom }}</button>

    <!-- pas encore dispo c'est pour la lise des game online -->
    <div v-if="rooms.length">
      <h3 class="font-bold">Sessions disponibles :</h3>
      <ul class="space-y-1">
        <li v-for="room in rooms" :key="room">
          <button @click="onJoin(room)"
                  class="px-3 py-1 border rounded">
            {{ room }}
          </button>
        </li>
      </ul>
    </div>

    <p v-if="error" class="text-red-600">{{ error }}</p>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue';
import { io, Socket } from 'socket.io-client';
import { useI18n } from '../../../composables/useI18n'

/**
* Sert à émettre le mode de jeu et à préparer le matchmaking
*/
export default defineComponent({
  name: 'Lobby',
  emits: ['startLocal', 'startAI', 'startRemote'],
  setup(_, { emit }) {
    const { t } = useI18n() // ✅ ici c’est bon

    const socket: Socket = io();
    const rooms = ref<string[]>([]);
    const error = ref('');
    const pendingRoom = ref('');

    function refreshList() {
      socket.emit('listGames');
    }

    socket.on('roomsList', (list: string[]) => {
      rooms.value = list;
      error.value = '';
    });

    socket.on('gameCreated', (roomId: string) => {
      emit('startRemote', { mode: 'host', roomId });
    });

    socket.on('playerJoined', () => {
      emit('startRemote', { mode: 'join', roomId: pendingRoom.value });
    });

    socket.on('joinError', (msg: string) => {
      error.value = msg;
    });

    function onCreate() {
      socket.emit('createGame');
    }

    function onJoin(room: string) {
      pendingRoom.value = room;
      socket.emit('joinGame', room);
    }

    function startLocal() { emit('startLocal'); }
    function startAI() { emit('startAI'); }

    onMounted(refreshList);

    return { rooms, error, onCreate, onJoin, startLocal, startAI, refreshList, t }; // 👈 retourne t ici
  }
});
</script>


<style scoped>
  .btn {
    padding: 10px;
    background-color: azure;
    border: 2px solid black;
    color: black;
    border-radius: 20px;
  }
</style>

