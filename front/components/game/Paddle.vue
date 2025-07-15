<template>
  <div :style="paddleStyle" class="paddle"></div>
</template>

<script>
  /** Setter pour le paddle par défaut */
  export default {
    name: 'Paddle',
    props: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
      width: { type: Number, default: 10 },
      height: { type: Number, default: 100 }
    },
    computed: {
      paddleStyle() {
        return {
          position: 'absolute',
          left: `${this.x}px`,
          top: `${this.y}px`,
          width: `${this.width}px`,
          height: `${this.height}px`,
          backgroundColor: 'white',
          borderRadius: '4px'
        };
      }
    }
  };
</script>

<style scoped>
.paddle {

}
</style>
