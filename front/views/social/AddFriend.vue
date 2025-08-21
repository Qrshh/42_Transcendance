<script setup lang="ts">
import { ref, defineEmits } from 'vue'
import axios from 'axios'

const emits = defineEmits(['friend-added'])

const username = localStorage.getItem('username') || ''
const newFriend = ref('')

const sendRequest = async () => {
  if (!newFriend.value.trim()) return alert("Entrez un nom d'utilisateur")
  try {
    await axios.post('http://localhost:3000/friends/request', {
      from: username,
      to: newFriend.value.trim()
    })
    alert('Demande envoyée !')
    newFriend.value = ''
    emits('friend-added')
  } catch (e) {
    alert('Erreur: ' + e.response?.data?.error || e.message)
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
