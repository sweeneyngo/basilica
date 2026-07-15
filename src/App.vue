<script setup>
import DiggingWheel from './components/DiggingWheel.vue'
</script>

<template>
  <div class="app">
    <header class="site-header">
      <span class="brand">
        <svg class="mark" viewBox="0 0 32 32" aria-hidden="true">
          <!-- finial -->
          <circle class="m-gold" cx="16" cy="4" r="1.5" />
          <rect class="m-gold" x="15.25" y="5.5" width="1.5" height="3" rx="0.75" />
          <!-- central dome -->
          <path class="m-gold" d="M9 17 C9 8 23 8 23 17 Z" />
          <!-- flanking towers -->
          <circle class="m-smoke" cx="7" cy="15.5" r="2.2" />
          <circle class="m-smoke" cx="25" cy="15.5" r="2.2" />
          <rect class="m-smoke" x="5" y="16" width="4" height="11" rx="1.2" />
          <rect class="m-smoke" x="23" y="16" width="4" height="11" rx="1.2" />
          <!-- body -->
          <path class="m-smoke" d="M8 17 h16 v9 a1 1 0 0 1 -1 1 H9 a1 1 0 0 1 -1 -1 Z" />
          <!-- arched door -->
          <path class="m-void" d="M14 27 v-4 a2 2 0 0 1 4 0 v4 Z" />
        </svg>
        <span class="logo">basilica</span>
      </span>
    </header>

    <main>
      <DiggingWheel />
    </main>
  </div>
</template>

<style scoped>
.app {
  height: 100%;
  display: grid;
  grid-template-rows: var(--header-h) 1fr;
}

.site-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 1.25rem;
  border-bottom: 1px solid var(--panel-line);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.mark {
  width: 1.6rem;
  height: 1.6rem;
  flex: none;
}

.mark .m-gold {
  fill: var(--marigold);
}

.mark .m-smoke {
  fill: var(--smoke);
}

.mark .m-void {
  fill: var(--void);
}

.logo {
  font-family: var(--font-display);
  font-weight: 800;
  font-stretch: 125%;
  font-variation-settings: 'wdth' 125;
  font-size: 1.5rem;
  letter-spacing: -0.01em;
}

main {
  min-height: 0; /* let the wheel scroll inside the grid row */
  position: relative;
}
</style>
