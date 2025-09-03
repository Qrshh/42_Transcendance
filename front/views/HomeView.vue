<template>
<main class="flex">
  <div class="computer-3d-section">
     <Computer3D
      :model-path="'/models/commodore.stl'"
      :rotation-x="1.5708" 
      :rotation-y="3.1416"  
      :rotation-z="1.5708"
      :position-y="0"
      :scale="3.8"
    />
  </div>
</main>
</template>

<script setup lang="ts">
import Computer3D from '../components/3d/Computer3D.vue'

</script>

<style scoped>
main {
  min-height: 100vh;
  display: flex;
  align-items: center;
}

.computer-3d-section {
  flex-shrink: 0;
  padding: 2rem;
}

@media (max-width: 768px) {
  main {
    flex-direction: column;
  }
  
  .computer-3d-section {
    order: 1;
    padding: 1rem;
  }
  
}
</style>