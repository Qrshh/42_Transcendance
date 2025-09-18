import { reactive, computed, watch } from 'vue'

export type GamePreset = 'classic' | 'custom'
export type ArenaTheme = 'classic' | 'neon' | 'cosmic'
export type BallSpeed = 'normal' | 'fast' | 'extreme'
export type BallSize = 'standard' | 'large'
export type PowerUpsFrequency = 'off' | 'rare' | 'frequent'

export interface GameCustomization {
  preset: GamePreset
  arena: ArenaTheme
  ballSpeed: BallSpeed
  ballSize: BallSize
  accelBall: boolean
  paddleDash: boolean
  powerUps: PowerUpsFrequency
}

const STORAGE_KEY = 'transcendence_game_customization'

const CLASSIC_PRESET: GameCustomization = {
  preset: 'classic',
  arena: 'classic',
  ballSpeed: 'normal',
  ballSize: 'standard',
  accelBall: false,
  paddleDash: false,
  powerUps: 'off',
}

function loadSettings(): GameCustomization {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...CLASSIC_PRESET }
    const parsed = JSON.parse(raw)
    return {
      ...CLASSIC_PRESET,
      ...parsed,
    }
  } catch (e) {
    console.warn('[GameSettings] Failed to load customization:', e)
    return { ...CLASSIC_PRESET }
  }
}

const state = reactive<GameCustomization>(loadSettings())

watch(
  () => ({ ...state }),
  (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch (e) {
      console.warn('[GameSettings] Failed to persist customization:', e)
    }
  },
  { deep: true }
)

function applyClassicPreset() {
  Object.assign(state, CLASSIC_PRESET)
}

function ensureCustomPreset() {
  if (state.preset !== 'custom') state.preset = 'custom'
}

export function useGameSettings() {
  const isClassic = computed(() => state.preset === 'classic')

  const setPreset = (preset: GamePreset) => {
    if (preset === 'classic') applyClassicPreset()
    else state.preset = 'custom'
  }

  const updateSetting = <K extends keyof GameCustomization>(key: K, value: GameCustomization[K]) => {
    if (key !== 'preset') ensureCustomPreset()
    ;(state[key] as GameCustomization[K]) = value
  }

  const toggleClassic = (enabled: boolean) => {
    if (enabled) applyClassicPreset()
    else state.preset = 'custom'
  }

  return {
    settings: state,
    isClassic,
    setPreset,
    updateSetting,
    toggleClassic,
    applyClassicPreset,
  }
}

export function resolveBallSpeed(speed: BallSpeed): number {
  switch (speed) {
    case 'fast':
      return 6
    case 'extreme':
      return 8
    default:
      return 4
  }
}

export function resolveBallRadius(size: BallSize): number {
  switch (size) {
    case 'large':
      return 14
    default:
      return 8
  }
}

export function resolvePowerUpInterval(freq: PowerUpsFrequency): number {
  switch (freq) {
    case 'rare':
      return 600
    case 'frequent':
      return 360
    default:
      return Infinity
  }
}
