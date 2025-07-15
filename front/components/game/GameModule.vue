<template>
  <div class="flex flex-col items-center space-y-4">
    <ScoreBoard :player1="score.player1" :player2="score.player2" />
    <GameBoard @scoreUpdate="onScoreUpdate" />
  </div>
</template>

<script>
  import GameBoard from './GameBoard.vue'
  import ScoreBoard from './ScoreBoard.vue'

  /**
  * Set tout simplement le score a 0, et met à jour
  * le score sur le component
  */
  export default {
    name: 'GameModule',
    components: { GameBoard, ScoreBoard },
    data() {
      return {
        score: { player1: 0, player2: 0 },
      }
    },
    methods: {
      onScoreUpdate(newScore) {
        this.score = newScore
      }
    }
  }
</script>

<style scoped>

</style>
