<template>
  <div class="relative">
    <canvas
      ref="canvas"
      width="600"
      height="400"
      class="border-4 border-gray-800 bg-black"
    ></canvas>
  </div>
</template>

<script>
  import { ref, onMounted, onBeforeUnmount } from 'vue'
  import { io } from 'socket.io-client'
  
  /** Setter pour la game par défaut 
  * il initie la balle et les deux paddle et le score, ensuite, il draw les paddle,
  * set les key à emettre
  */
  export default {
    name: 'GameBoard',
    emits: ['scoreUpdate', 'statusUpdate'], 
    setup(props, { emit }) {
      const canvas = ref(null)
      const socket = io('http://10.12.2.6:3000')
      let ctx
      const initialState = {
        ball: { x: 300, y: 200, radius: 8 },
        paddles: {
          p1: { x: 10, y: 150, width: 10, height: 100 },
          p2: { x: 580, y: 150, width: 10, height: 100 }
        }
      };
      const draw = (state) => {
        if (!ctx) return
        
        ctx.clearRect(0, 0, 600, 400)
        ctx.fillStyle = '#CCCCFF'
        ctx.beginPath()

        ctx.arc(state.ball.x, state.ball.y, state.ball.radius, 0, Math.PI * 2)
        ctx.fill()
  
        ctx.fillRect(state.paddles.p1.x, state.paddles.p1.y, state.paddles.p1.width, state.paddles.p1.height)
        ctx.fillRect(state.paddles.p2.x, state.paddles.p2.y, state.paddles.p2.width, state.paddles.p2.height)
      }
  
      const handleKeyDown = (e) => {
        if (e.key === 'w' || e.key === 's' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          const direction = (e.key === 'w' || e.key === 'ArrowUp') ? 'up' : 'down';
          socket.emit('movePaddle', direction)
        }
      }
      
      const handleKeyUp = (e) => {
        if (['w', 's', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
          socket.emit('movePaddle', 'stop');
        }
      }
  
      onMounted(() => {
        ctx = canvas.value.getContext('2d')
        draw(initialState);
        socket.on('gameState', (gameState) => {
          draw(gameState)
          emit('scoreUpdate', gameState.score)
          emit('statusUpdate', gameState.status);
        })
  
        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)
      })
  
      onBeforeUnmount(() => {
        window.removeEventListener('keydown', handleKeyDown)
        window.removeEventListener('keyup', handleKeyUp)
        socket.disconnect()
      })
      return { canvas }
    }
  }
</script>

<style scoped>
</style>
