import type { GameState } from './types'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants'

/**
* Dessine l'état complet du jeu (balle, raquettes) sur un contexte de canvas 2D.
* @param ctx Le contexte 2D du canvas sur lequel dessiner.
* @param state L'état actuel du jeu à dessiner.
*/
export function drawGameState(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  ctx.fillStyle = '#CCCCFF'
  
  const { ball, paddles } = state

  ctx.beginPath()
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillRect(paddles.p1.x, paddles.p1.y, paddles.p1.width, paddles.p1.height)
  ctx.fillRect(paddles.p2.x, paddles.p2.y, paddles.p2.width, paddles.p2.height)
}
