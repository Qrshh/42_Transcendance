<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'

const username = localStorage.getItem('username') || ''

const requests = ref<{ fromUser: string }[]>([])

const fetchRequests = async () => {
  try {
    const res = await axios.get(`http://10.12.2.6:3000/friends/requests/${username}`)
    requests.value = res.data
  } catch (e) {
    console.error('Erreur fetch requests', e)
  }
}

const respondToRequest = async (fromUser: string, accept: boolean) => {
  try {
    await axios.post('http://10.12.2.6:3000/friends/respond', {
      from: fromUser,
      to: username,
      accept
    })
    await fetchRequests() // rafraîchir la liste après réponse
    alert(`Demande ${accept ? 'acceptée' : 'refusée'}`)
  } catch (e) {
    alert('Erreur lors de la réponse : ' + (e.response?.data?.error || e.message))
  }
}

onMounted(fetchRequests)
</script>

<template>
  <div>
    <h2 class="text-xl font-bold mb-2">Demandes d'amis reçues</h2>
    <ul>
      <li v-for="req in requests" :key="req.fromUser" class="flex justify-between items-center mb-2 p-2 border rounded">
        <span>{{ req.fromUser }}</span>
        <div>
          <button 
            @click="respondToRequest(req.fromUser, true)" 
            class="mr-2 px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700"
          >
            Accepter
          </button>
          <button 
            @click="respondToRequest(req.fromUser, false)" 
            class="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
          >
            Refuser
          </button>
        </div>
      </li>
      <li v-if="requests.length === 0" class="text-gray-500">Aucune demande en attente</li>
    </ul>
  </div>
</template>
