<template>
  <div class="text-white text-xl font-bold">
    {{ player1 }} : {{ player2 }}
  </div>
</template>

<script>
  export default {
    name: 'ScoreBoard',
    props: {
      player1: { type: Number, required: true },
      player2: { type: Number, required: true }
    }
  }
</script>

<style scoped>

</style>
