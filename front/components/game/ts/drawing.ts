import type { GameState } from './types'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants'

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

/**
* Dessine l'état complet du jeu (balle, raquettes) sur un contexte de canvas 2D.
* @param ctx Le contexte 2D du canvas sur lequel dessiner.
* @param state L'état actuel du jeu à dessiner.
*/
export function drawGameState(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  const { bg: pongBg, ball: pongBall, paddle: pongPaddle, overlay: pongOverlay } = ensureThemeColors()

  ctx.fillStyle = pongBg  // fond
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  const { ball, paddles } = state

  // 2️⃣ Dessiner la balle
  ctx.fillStyle = pongBall  // balle

  ctx.beginPath()
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
  ctx.fill()
  // 3️⃣ Dessiner les paddles
  ctx.fillStyle = pongPaddle  // raquettes

  ctx.fillRect(paddles.p1.x, paddles.p1.y, paddles.p1.width, paddles.p1.height)
  ctx.fillRect(paddles.p2.x, paddles.p2.y, paddles.p2.width, paddles.p2.height)

  // 4️⃣ Afficher le message Game Over si nécessaire
  if (state.gameOver) {
    ctx.fillStyle = pongOverlay
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    ctx.fillStyle = pongPaddle
    ctx.font = '40px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('GAME OVER !', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30)
    ctx.fillText(`Winner : ${state.winner}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20)
  }
}
