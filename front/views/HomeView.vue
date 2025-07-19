<template>
<main class="flex">
  <div class="computer-3d-section">
    <Computer3D 
      :model-path="'/models/commodore.stl'"
      :rotation-x="-1.1"
      :rotation-y="-1.545"
      :rotation-z="-1.175"
      :position-y="0"
      :scale="3.5"
    />
  </div>
  <div class="content-section">
    <Bvn />
    <UserList />
  </div>
</main>
</template>

<script setup lang="ts">
import Bvn from '../components/Bvn.vue'
import UserList from '../components/UserList.vue'
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

.content-section {
  flex: 1;
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
  
  .content-section {
    order: 2;
    padding: 1rem;
  }
}
</style>