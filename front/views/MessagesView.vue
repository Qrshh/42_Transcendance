<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'
import ChatBox from '../components/ChatBox.vue'

const users = ref<string[]>([])
const selectedUser = ref<string | null>(null)

const fetchUsers = async () => {
  const res = await axios.get('http://localhost:3000/users')
  const currentUser = localStorage.getItem('username') || ''
  users.value = res.data
    .map((u: any) => u.username)
    .filter((name: string) => name.toLowerCase() !== currentUser.toLowerCase())
}

onMounted(fetchUsers)
</script>

<template>
  <div class="flex h-full">
    <!-- Liste des utilisateurs -->
	 <!-- AJUSTER POUR QUE CA SOIT LA LISTE D'AMIS ET PAS TOUT LES UTILISATEURS EXISTANTS-->
    <aside class="w-1/3 border-r p-4">
      <h2 class="text-lg font-bold mb-4">Utilisateurs</h2>
      <ul>
        <li
          v-for="u in users"
          :key="u"
          class="cursor-pointer hover:underline"
          @click="selectedUser = u"
        >
          {{ u }}
        </li>
      </ul>
    </aside>

    <!-- Boîte de chat -->
    <main class="w-2/3 p-4" v-if="selectedUser">
      <ChatBox :receiver="selectedUser" />
    </main>
  </div>
</template>
