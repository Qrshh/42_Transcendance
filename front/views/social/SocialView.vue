<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'

import FriendList from './FriendList.vue'
import AddFriend from './AddFriend.vue'
import FriendRequests from './FriendRequest.vue'
import ChatBox from '../../components/ChatBox.vue'

const username = localStorage.getItem('username') || ''

const friends = ref<{ friend: string }[]>([])
const selectedFriend = ref<string | null>(null)

const fetchFriends = async () => {
  try {
    const res = await axios.get(`http://localhost:3000/friends/${username}`)
    friends.value = res.data
  } catch (e) {
    console.error('Erreur récupération amis', e)
  }
}

onMounted(fetchFriends)

const onFriendAdded = () => {
  fetchFriends()
}
</script>

<template>
  <div class="social-view flex space-x-4 p-4">
    <div class="friends-list w-1/3 border-r pr-4 space-y-6">
      <FriendRequests />
      <AddFriend @friend-added="onFriendAdded" />
      <FriendList 
        :friends="friends" 
        :selectedFriend="selectedFriend" 
        @selectFriend="selectedFriend = $event" 
      />
    </div>
    <div class="chat-box flex-1">
      <ChatBox v-if="selectedFriend" :receiver="selectedFriend" />
      <p v-else class="text-gray-500">Sélectionne un ami pour discuter</p>
    </div>
  </div>
</template>
