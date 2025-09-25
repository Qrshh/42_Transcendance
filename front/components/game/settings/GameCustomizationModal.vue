<template>
  <Transition name="fade">
    <div v-if="open" class="custom-overlay" :class="{ 'is-mobile': isMobile }" @click.self="close">
      <div
        class="custom-modal"
        :class="{ 'mobile-sheet': isMobile }"
        :style="modalStyle"
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-custom-title"
      >
        <header
          ref="headerRef"
          class="modal-header"
          :class="{ mobile: isMobile }"
          @pointerdown="startDrag"
        >
          <div v-if="isMobile" class="drag-handle" aria-hidden="true"></div>
          <div class="header-content">
            <div class="title-block">
              <h3 id="game-custom-title">⚙️ {{ t.gameCustomization }}</h3>
              <p>{{ t.applySettingsAllModes }}</p>
            </div>
            <button class="close-btn" type="button" @click="close" aria-label="{{ t.close }}">✕</button>
          </div>
        </header>

        <div class="modal-body">
          <section class="preset-section">
            <h4>{{ t.preset }}</h4>
            <div class="preset-buttons">
              <button
                type="button"
                :class="['preset-btn', { active: isClassic } ]"
                @click="setPreset('classic')"
              >
                🎯 {{ t.classic }}
              </button>
              <button
                type="button"
                :class="['preset-btn', { active: !isClassic } ]"
                @click="setPreset('custom')"
              >
                🎮 {{ t.custom }}
              </button>
            </div>
            <p class="preset-desc">
              {{ isClassic ? t.classicDesc : t.customDesc }}
            </p>
          </section>

          <section class="grid">
            <article class="card">
              <h5>{{ t.arenaTheme }}</h5>
              <div class="options-row">
                <label v-for="theme in arenaOptions" :key="theme.value" :class="['preset-btn', { active: settings.arena === theme.value }]">
                  <input type="radio" :value="theme.value" v-model="settings.arena" @change="markCustom" />
                  <span>{{ theme.label }}</span>
                </label>
              </div>
            </article>

            <article class="card">
              <h5>{{ t.ballSpeed }}</h5>
              <div class="options-row">
                <label v-for="speed in speedOptions" :key="speed.value" :class="['preset-btn', { active: settings.ballSpeed === speed.value }]">
                  <input type="radio" :value="speed.value" v-model="settings.ballSpeed" @change="markCustom" />
                  <span>{{ speed.label }}</span>
                </label>
              </div>
            </article>

            <article class="card">
              <h5>{{ t.ballSize }}</h5>
              <div class="options-row">
                <label v-for="size in sizeOptions" :key="size.value" :class="['preset-btn', { active: settings.ballSize === size.value }]">
                  <input type="radio" :value="size.value" v-model="settings.ballSize" @change="markCustom" />
                  <span>{{ size.label }}</span>
                </label>
              </div>
            </article>

            <article class="card">
              <h5>{{ t.powerUps }}</h5>
              <div class="options-row">
                <label v-for="power in powerOptions" :key="power.value" :class="['preset-btn', { active: settings.powerUps === power.value }]">
                  <input type="radio" :value="power.value" v-model="settings.powerUps" @change="markCustom" />
                  <span>{{ power.label }}</span>
                </label>
              </div>
              <p class="hint">{{ t.autoBoostHint }}</p>
            </article>

            <article class="card toggles">
              <h5>{{ t.optionalModules }}</h5>
              <label class="toggle">
                <input type="checkbox" v-model="settings.accelBall" @change="markCustom" />
                <span class="slider"></span>
                <span class="toggle-label">🚀 {{ t.acceleratingBall }}</span>
              </label>
              <label class="toggle">
                <input type="checkbox" v-model="settings.paddleDash" @change="markCustom" />
                <span class="slider"></span>
                <span class="toggle-label">⚡ {{ t.paddleDash }}</span>
              </label>
            </article>
          </section>
        </div>

        <footer class="modal-footer">
          <button type="button" class="btn ghost" @click="applyClassic">{{ t.classicMode }}</button>
          <button type="button" class="btn primary" @click="close">{{ t.save }}</button>
        </footer>
      </div>
    </div>
  </Transition>
</template>


<script setup lang="ts">
import { watch, computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useGameSettings } from '../../../stores/gameSettings'
import { useI18n } from '../../../composables/useI18n';

const { t } = useI18n()

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const { settings, isClassic, setPreset, applyClassicPreset } = useGameSettings()

const arenaOptions = [
  { value: 'classic', label: 'Classique 1972' },
  { value: 'neon', label: 'Neon futuriste' },
  { value: 'cosmic', label: 'Cosmos' },
]

const speedOptions = [
  { value: 'normal', label: 'Normal' },
  { value: 'fast', label: 'Rapide' },
  { value: 'extreme', label: 'Extrême' },
]

const sizeOptions = [
  { value: 'standard', label: 'Standard' },
  { value: 'large', label: 'Large' },
]

const powerOptions = [
  { value: 'off', label: 'Désactivé' },
  { value: 'rare', label: 'Occasionnel' },
  { value: 'frequent', label: 'Fréquent' },
]

const isMobile = ref(false)
const sheetOffset = ref(0)
const isDragging = ref(false)
const dragStartY = ref(0)
const activePointerId = ref<number | null>(null)
const headerRef = ref<HTMLElement | null>(null)
let mediaQuery: MediaQueryList | null = null

const detachDragListeners = () => {
  window.removeEventListener('pointermove', onDrag)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointercancel', cancelDrag)
}

const close = () => {
  if (activePointerId.value !== null) {
    headerRef.value?.releasePointerCapture?.(activePointerId.value)
  }
  sheetOffset.value = 0
  isDragging.value = false
  activePointerId.value = null
  detachDragListeners()
  emit('close')
}

const markCustom = () => {
  if (settings.preset !== 'custom') settings.preset = 'custom'
}

const applyClassic = () => {
  applyClassicPreset()
}

const handleMediaChange = (event: MediaQueryListEvent) => {
  isMobile.value = event.matches
}

onMounted(() => {
  if (typeof window === 'undefined') return
  if ('matchMedia' in window) {
    mediaQuery = window.matchMedia('(max-width: 640px)')
    isMobile.value = mediaQuery.matches
    mediaQuery.addEventListener('change', handleMediaChange)
  } else {
    isMobile.value = window.innerWidth <= 640
  }
})

onBeforeUnmount(() => {
  mediaQuery?.removeEventListener('change', handleMediaChange)
  detachDragListeners()
})

const startDrag = (event: PointerEvent) => {
  if (!isMobile.value || event.pointerType !== 'touch') return
  const target = event.target as HTMLElement | null
  if (target?.closest('.close-btn')) return

  isDragging.value = true
  dragStartY.value = event.clientY
  sheetOffset.value = 0
  activePointerId.value = event.pointerId
  headerRef.value?.setPointerCapture?.(event.pointerId)
  window.addEventListener('pointermove', onDrag, { passive: true })
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('pointercancel', cancelDrag)
}

const onDrag = (event: PointerEvent) => {
  if (!isDragging.value || event.pointerId !== activePointerId.value) return
  const delta = event.clientY - dragStartY.value
  sheetOffset.value = Math.max(0, delta)
}

const endDrag = (event: PointerEvent) => {
  if (event.pointerId !== activePointerId.value) return
  headerRef.value?.releasePointerCapture?.(event.pointerId)
  detachDragListeners()
  const shouldClose = sheetOffset.value > 120
  isDragging.value = false
  activePointerId.value = null
  if (shouldClose) {
    close()
  } else {
    sheetOffset.value = 0
  }
}

const cancelDrag = () => {
  if (!isDragging.value) return
  if (activePointerId.value !== null) {
    headerRef.value?.releasePointerCapture?.(activePointerId.value)
  }
  detachDragListeners()
  isDragging.value = false
  activePointerId.value = null
  sheetOffset.value = 0
}

const modalStyle = computed(() => {
  if (!isMobile.value) return undefined
  return {
    transform: `translateY(${sheetOffset.value}px)`,
    transition: isDragging.value ? 'none' : 'transform 0.24s ease'
  }
})

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      if (settings.preset === 'classic') applyClassicPreset()
      sheetOffset.value = 0
      isDragging.value = false
      activePointerId.value = null
    } else {
      sheetOffset.value = 0
      isDragging.value = false
      activePointerId.value = null
      detachDragListeners()
    }
  }
)

</script>

<style scoped>
.custom-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.57);
  backdrop-filter: blur(14px);
  display: grid;
  place-items: center;
  z-index: 2000;
  padding: 1.5rem;
}

.custom-modal {
  width: min(720px, 100%);
  border-radius: 7px;
  background: linear-gradient(160deg, var(--color-background) 0%, var(--color-background-soft) 100%);
  border: 1px solid var(--color-border);
  box-shadow: 0 30px 80px rgba(0,0,0,.35);
  display: grid;
  grid-template-rows: auto 1fr auto;
  max-height: 90vh;
  will-change: transform;
}

.custom-modal.mobile-sheet {
  max-height: 88vh;
  width: 100%;
  border-radius: 22px 22px 0 0;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 1.75rem;
  border-bottom: 1px solid var(--color-border);
  border-radius: 7px 7px 0 0;
}

.modal-header .header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  width: 100%;
}

.modal-header .title-block {
  display: flex;
  flex-direction: column;
}

.modal-header.mobile {
  flex-direction: column;
  gap: 0.75rem;
  cursor: grab;
  touch-action: pan-y;
  padding-top: 1rem;
}

.modal-header.mobile:active {
  cursor: grabbing;
}

.modal-header.mobile .header-content {
  align-items: flex-start;
}

.modal-header.mobile .close-btn {
  align-self: flex-end;
}

.drag-handle {
  width: 52px;
  height: 5px;
  border-radius: 999px;
  background: rgba(255,255,255,0.35);
  margin: 0 auto;
  display: none;
}

.modal-header.mobile .drag-handle {
  display: block;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--color-heading);
}

.modal-header p {
  margin: 0.25rem 0 0;
  color: var(--color-text);
  opacity: 0.7;
}

.close-btn {
  border: none;
  background: transparent;
  color: var(--color-text);
  opacity: 0.7;
  cursor: pointer;
  font-size: 1.2rem;
}

.modal-body {
  padding: 1.75rem;
  overflow-y: auto;
  display: grid;
  gap: 1.5rem;
  -webkit-overflow-scrolling: touch;
}

.preset-section {
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 1.25rem 1.5rem;
  display: grid;
  gap: 0.75rem;
}

.preset-buttons {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.preset-btn {
  border: 1px solid transparent;
  border-radius: 12px;
  padding: 0.65rem 1.1rem;
  font-weight: 600;
  background: rgba(53, 53, 53, 0.17);
  color: var(--color-text);
  cursor: pointer;
  transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
}

.preset-btn.active {
  background: var(--gradient-brand);
  border-color: transparent;
  color: #0b132b;
  box-shadow: var(--glow-primary);
}

.preset-desc {
  margin: 0;
  color: var(--color-text);
  opacity: 0.75;
  font-size: 0.9rem;
}

.grid {
  display: grid;
  gap: 1.2rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.card {
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 1.2rem 1.4rem;
  background: rgba(255,255,255,0.04);
  display: grid;
  gap: 0.75rem;
}

.card h5 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-heading);
}

.options-row {
  display: contents;
  margin: 10px;
  gap: 0.75rem;
}

.option-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid var(--color-border);
  border-radius: 7px;
  padding: 0.35rem 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color .2s ease, background .2s ease, transform .2s ease;
}

.option-pill input {
  display: none;
}

.option-pill.active {
  background: rgba(79, 172, 254, 0.18);
  border-color: rgba(79, 172, 254, 0.5);
  color: white;
}

.toggles {
  gap: 1rem;
}

.toggle {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.toggle input {
  position: absolute;
  opacity: 0;
}

.slider {
  width: 48px;
  height: 26px;
  border-radius: 999px;
  background: rgba(255,255,255,0.15);
  border: 1px solid var(--color-border);
  position: relative;
  transition: background .2s ease, border-color .2s ease;
}

.slider::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  top: 2px;
  left: 2px;
  border-radius: 50%;
  background: #fff;
  transition: transform .2s ease;
}

.toggle input:checked + .slider {
  background: var(--gradient-brand);
  border-color: transparent;
}

.toggle input:checked + .slider::after {
  transform: translateX(22px);
}

.toggle-label {
  font-weight: 600;
}

.modal-footer {
  padding: 1.4rem 1.6rem;
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
}

.btn {
  border-radius: 12px;
  padding: 0.75rem 1.3rem;
  font-weight: 700;
  border: 1px solid var(--color-border);
  background: var(--color-background-mute);
  color: var(--color-text);
  cursor: pointer;
  transition: transform .2s ease, box-shadow .2s ease;
}

.btn.ghost {
  background: transparent;
}

.btn.primary {
  background: var(--gradient-brand);
  color: #0b132b;
  border-color: transparent;
  box-shadow: var(--glow-primary);
}

.btn.primary:hover,
.btn.ghost:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

@media (max-width: 640px) {
  .custom-overlay {
    padding: 0.75rem 0.75rem 0;
    display: flex;
    justify-content: center;
    align-items: flex-end;
  }

  .custom-overlay.is-mobile {
    padding: 0.75rem 0.5rem 0.5rem;
  }

  .modal-body {
    padding: 1.15rem;
  }

  .modal-footer {
    padding: 1.1rem 1.15rem;
    flex-direction: column-reverse;
    gap: 0.75rem;
  }

  .modal-footer .btn {
    width: 100%;
  }

  .btn.primary,
  .btn.ghost {
    box-shadow: none;
  }
}
</style>
