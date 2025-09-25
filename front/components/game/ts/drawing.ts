import type { GameState } from './types'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants'

type ArenaTheme = {
  bg?: string
  ball?: string
  paddle?: string
  overlay?: string
}

const ARENA_THEMES: Record<string, ArenaTheme> = {
  classic: {
    bg: '#050505',
    ball: '#f1f5f9',
    paddle: '#f8fafc',
    overlay: 'rgba(5,5,5,0.72)'
  },
  neon: {
    bg: '#060a1f',
    ball: '#4facfe',
    paddle: '#80faff',
    overlay: 'rgba(7,12,32,0.78)'
  },
  cosmic: {
    bg: '#0a041b',
    ball: '#d8b4fe',
    paddle: '#93c5fd',
    overlay: 'rgba(8,4,27,0.8)'
  }
}

// Cache des couleurs pour éviter getComputedStyle() à chaque frame
let cachedThemeKey: string | null = null
let cachedColors: { bg: string; ball: string; paddle: string; overlay: string } | null = null

function ensureThemeColors() {
  try {
    const root = document.documentElement
    const themeKey = root.getAttribute('data-theme') || ''
    if (!cachedColors || themeKey !== cachedThemeKey) {
      const cs = getComputedStyle(root)
      cachedColors = {
        bg: (cs.getPropertyValue('--pong-bg') || '#000').trim() || '#000',
        ball: (cs.getPropertyValue('--pong-ball') || '#ccc').trim() || '#ccc',
        paddle: (cs.getPropertyValue('--pong-paddle') || '#fff').trim() || '#fff',
        overlay: (cs.getPropertyValue('--pong-overlay') || 'rgba(0,0,0,.7)').trim() || 'rgba(0,0,0,.7)'
      }
      cachedThemeKey = themeKey
    }
  } catch {
    if (!cachedColors) {
      cachedColors = { bg: '#000', ball: '#ccc', paddle: '#fff', overlay: 'rgba(0,0,0,.7)' }
      cachedThemeKey = null
    }
  }
  return cachedColors!
}

export function drawGameState(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  const baseColors = ensureThemeColors()
  const arenaKey = state.settings?.arena ?? 'classic'
  const themeOverrides = ARENA_THEMES[arenaKey] ?? ARENA_THEMES.classic
  const colors = {
    bg: themeOverrides.bg ?? baseColors.bg,
    ball: themeOverrides.ball ?? baseColors.ball,
    paddle: themeOverrides.paddle ?? baseColors.paddle,
    overlay: themeOverrides.overlay ?? baseColors.overlay
  }

  ctx.fillStyle = colors.bg  // fond
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  const { ball, paddles } = state

  ctx.fillStyle = colors.ball  // balle

  ctx.beginPath()
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = colors.paddle  // raquettes

  ctx.fillRect(paddles.p1.x, paddles.p1.y, paddles.p1.width, paddles.p1.height)
  ctx.fillRect(paddles.p2.x, paddles.p2.y, paddles.p2.width, paddles.p2.height)

  //if (state.gameOver) {
  //  ctx.fillStyle = colors.overlay
  //  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  //  ctx.fillStyle = colors.paddle
  //  ctx.font = '40px Arial'
  //  ctx.textAlign = 'center'
  //  ctx.fillText('GAME OVER !', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30)
  //  ctx.fillText(`Winner : ${state.winner}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20)
  //}
}
