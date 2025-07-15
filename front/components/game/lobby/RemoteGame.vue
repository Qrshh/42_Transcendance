
<template>
  <PongCanvas :state="serverState" :onMove="sendMove" />
</template>
<script setup lang="ts">
/** Non fini servira pour la game online */
  import { reactive, onMounted, onBeforeUnmount } from 'vue'
  import PongCanvas from '../PongCanvas.vue'
  import type { Socket } from 'socket.io-client'
  
  const props = defineProps<{ socket: Socket, roomId: string }>()
  
  const serverState = reactive({/* ball,paddles,score,status */})
  
  function sendMove(dir:'up'|'down'|'stop') {
    props.socket.emit('movePaddle',{ roomId: props.roomId, direction: dir })
  }
  
  onMounted(() => {
    props.socket.on('gameState', (s) => Object.assign(serverState, s))
  })
  onBeforeUnmount(() => {
    props.socket.off('gameState')
  })
</script>
