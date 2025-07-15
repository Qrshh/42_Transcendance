<template>
  <div class="details">
    <h3>
      <slot name="heading"></slot>
    </h3>
    <slot></slot>
  </div>
</template>

<style scoped>
  .details {
    flex: 1;
    margin-left: 1rem;
  }
  h3 {
    font-size: 1.2rem;
    font-weight: 500;
    margin-bottom: 0.4rem;
    color: var(--color-heading);
  }
</style>
