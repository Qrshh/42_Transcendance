<template>
  <div class="p-6 max-w-md mx-auto">
    <h1 class="text-xl font-bold mb-4">Utilisateurs</h1>
    <ul class="mb-4">
      <li v-for="user in users" :key="user.id" class="mb-1">
        {{ user.username }}
      </li>
    </ul>
    <input
      v-model="newUsername"
      type="text"
      placeholder="Nom d'utilisateur"
      class="border px-2 py-1 mr-2"
    />
    <button @click="addUser" class="bg-blue-500 text-white px-4 py-1 rounded">
      Ajouter
    </button>
  </div>
</template>

<script setup>
  // Sert a add un joueur dans la db et lister la liste des joueurs
  import { ref, onMounted } from 'vue'
  import axios from 'axios'
  
  const users = ref([])
  const newUsername = ref('')
  
  const fetchUsers = async () => {
    const res = await axios.get('http://localhost:3000/users')
    users.value = res.data
  }
  
  const addUser = async () => {
    if (!newUsername.value) return
    await axios.post('http://localhost:3000/users', {
      username: newUsername.value
    })
    newUsername.value = ''
    fetchUsers()
  }
  
  onMounted(fetchUsers)
</script>
