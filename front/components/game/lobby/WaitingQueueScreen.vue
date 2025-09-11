<template>
  <div class="waiting-queue-screen p-6 bg-gray-700 rounded-lg shadow-md text-center">
    <h2 class="text-3xl font-bold mb-4 text-white">En attente de la partie :</h2>
    <p class="text-4xl font-extrabold text-blue-400 mb-6">{{ gameName }}</p>

    <div class="space-y-3 text-lg text-gray-200">
      <p>Joueurs: <span class="font-bold text-blue-300">{{ currentPlayers }}</span> / <span class="font-bold text-blue-300">{{ maxPlayers }}</span></p>
      <p>Statut: <span class="font-bold text-purple-300">{{ statusMessage }}</span></p>
      <p v-if="estimatedWaitTime">Temps d'attente estimé: <span class="font-bold text-yellow-300">{{ estimatedWaitTime }} min</span></p>
    </div>

    <button @click="leaveQueue"
            class="mt-8 py-3 px-​6 bg-red-600 hover:bg-red-700 rounded-lg text-white font-semibold transition duration-300">
      Quitter la file
    </button>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch, onMounted, onUnmounted } from 'vue';
import type { Socket } from 'socket.io-client';
import { useGlobalToasts } from '../../../composables/useGlobalToasts'

export default defineComponent({
  name: 'WaitingQueueScreen',
  props: {
    socket: {
      type: Object as () => Socket,
      required: true,
    },
    gameId: {
      type: String,
      required: true,
    },
    gameName: {
      type: String,
      required: true,
    },
  },
  emits: ['leftQueue', 'gameStarted'],
  setup(props, { emit }) {
    const { showToast } = useGlobalToasts()
    const currentPlayers = ref(0);
    const maxPlayers = ref(0);
    const statusMessage = ref('En attente de joueurs...');
    const estimatedWaitTime = ref<number | null>(null);

    // Fonction pour gérer les mises à jour de la file d'attente
    // Dans handleGameQueueUpdate, améliore la gestion :
    const handleGameQueueUpdate = (data: any) => {
        console.log('WaitingQueue: Reçu gameQueueUpdate', data);
        
        // Vérifier que c'est bien pour notre partie
        if (data.gameId !== props.gameId) {
            console.log('WaitingQueue: Données pour une autre partie, ignoré');
            return;
        }
        
        if (data.status === 'not_found') {
            console.error('Lobby introuvable, retour au menu');
            statusMessage.value = 'Partie introuvable';
            setTimeout(() => emit('leftQueue'), 2000);
            return;
        }
        
        if (data.status === 'started') {
            console.log('Partie démarrée !');
            statusMessage.value = 'Partie démarrée ! Redirection...';
            emit('gameStarted', data.roomId || props.gameId);
            return;
        }
        
        // Mise à jour normale
        currentPlayers.value = data.currentPlayers || 0;
        maxPlayers.value = data.maxPlayers || 2;
        
        if (data.status === 'starting') {
            statusMessage.value = 'La partie va commencer !';
        } else if (data.status === 'lobby') {
            statusMessage.value = 'En attente de joueurs...';
        } else {
            statusMessage.value = data.status || 'En attente...';
        }
        
        estimatedWaitTime.value = data.estimatedWaitTime;
    };
    
    
    const leaveQueue = () => {
        props.socket.emit('leaveGame', { gameId: props.gameId });
        // Le backend devrait confirmer que le joueur a quitté la file
        // Pour l'exemple, on part du principe que ça réussit et on revient au menu.
        emit('leftQueue');
    };

    onMounted(() => {
        // Demande l'état initial de la partie via Socket.IO
        props.socket.emit('requestGameQueueStatus', { gameId: props.gameId });

        // Écoute les mises à jour de la file d'attente pour cette partie
        props.socket.on('gameQueueUpdate', handleGameQueueUpdate);

        // Écoute les erreurs lors de la sortie de la file
        props.socket.on('leaveGameError', (data: { message: string }) => {
            showToast(`Erreur en quittant la file: ${data.message}`, 'error');
        });
    });

    onUnmounted(() => {
      // Nettoyer les écouteurs d'événements Socket.IO
      props.socket.off('gameQueueUpdate', handleGameQueueUpdate);
      props.socket.off('leaveGameError');
    });

    // Optionnel: Si la gameId change (peu probable dans ce scénario, mais bonne pratique)
    watch(() => props.gameId, () => {
        // Quand l'ID de la partie change, potentiellement re-demander le statut
        // et s'assurer que l'écouteur est bien ciblé
        props.socket.emit('requestGameQueueStatus', { gameId: props.gameId });
    });

    return {
      currentPlayers,
      maxPlayers,
      statusMessage,
      estimatedWaitTime,
      leaveQueue,
    };
  },
});
</script>
