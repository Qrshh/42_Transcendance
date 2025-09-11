<script setup lang="ts">
import { ref, defineEmits } from 'vue'
import axios from 'axios'
import { API_BASE } from '../../config'
import { useGlobalToasts } from '../../composables/useGlobalToasts'

const emits = defineEmits(['friend-added'])

const username = localStorage.getItem('username') || ''
const newFriend = ref('')
const { showToast } = useGlobalToasts()

const sendRequest = async () => {
  if (!newFriend.value.trim()) {
    showToast("Entrez un nom d'utilisateur", 'warning')
    return
  }
  try {
    await axios.post(`${API_BASE}/friends/request`, {
      from: username,
      to: newFriend.value.trim()
    })
    showToast('Demande envoyée ✔', 'success')
    newFriend.value = ''
    emits('friend-added')
  } catch (e: any) {
    const msg = e?.response?.data?.error || e?.message || 'Erreur lors de la demande'
    showToast(msg, 'error')
  }
}
</script>

<template>
  <div class="mb-4">
    <input 
      v-model="newFriend" 
      type="text" 
      placeholder="Nom d'utilisateur à ajouter" 
      class="border p-2 w-full rounded"
    />
    <button 
      @click="sendRequest" 
      class="mt-2 bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700"
    >
      Ajouter un ami
    </button>
  </div>
</template>
