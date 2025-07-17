<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'

const props = defineProps<{
  friends: { friend: string }[],
  selectedFriend: string | null,
}>()

const emit = defineEmits(['selectFriend'])

const select = (friend: string) => {
  if (props.selectedFriend === friend) {
    // Si on reclique sur le même ami, on désélectionne (= ferme le chat)
    emit('selectFriend', null)
  } else {
    // Sinon on sélectionne cet ami
    emit('selectFriend', friend)
  }
}
</script>

<template>
  <div>
    <h2 class="text-xl font-bold mb-2">Amis</h2>
    <ul>
      <li 
        v-for="f in friends" 
        :key="f.friend" 
        @click="select(f.friend)"
        :class="['cursor-pointer p-2 rounded', props.selectedFriend === f.friend ? 'bg-blue-500 text-white' : 'hover:bg-blue-100']"
      >
        {{ f.friend }}
      </li>
    </ul>
  </div>
</template>
