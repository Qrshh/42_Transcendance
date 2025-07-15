<template>
  <div :style="ballStyle" class="ball"></div>
</template>

<script>
export default {
  name: 'Ball',
  props: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    radius: { type: Number, default: 8 }
  },
  computed: {
    ballStyle() {
      return {
        position: 'absolute',
        left: `${this.x - this.radius}px`,
        top: `${this.y - this.radius}px`,
        width: `${this.radius * 2}px`,
        height: `${this.radius * 2}px`,
        borderRadius: '50%',
        backgroundColor: 'white',
        pointerEvents: 'none'
      };
    }
  }
};
</script>

<style scoped>
.ball {

}
</style>
