import type { GameState } from './types'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants'

/**
* Dessine l'état complet du jeu (balle, raquettes) sur un contexte de canvas 2D.
* @param ctx Le contexte 2D du canvas sur lequel dessiner.
* @param state L'état actuel du jeu à dessiner.
*/
export function drawGameState(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  ctx.fillStyle = '#000000'  // couleur du fond du pong
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  const { ball, paddles } = state

  // 2️⃣ Dessiner la balle
  ctx.fillStyle = '#CCCCFF'  // couleur de la balle

  ctx.beginPath()
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
  ctx.fill()
  // 3️⃣ Dessiner les paddles
  ctx.fillStyle = '#FFFFFF'  // couleur des paddles

  ctx.fillRect(paddles.p1.x, paddles.p1.y, paddles.p1.width, paddles.p1.height)
  ctx.fillRect(paddles.p2.x, paddles.p2.y, paddles.p2.width, paddles.p2.height)

  // 4️⃣ Afficher le message Game Over si nécessaire
  if (state.gameOver) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    ctx.fillStyle = 'white'
    ctx.font = '40px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('GAME OVER !', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30)
    ctx.fillText(`Winner : ${state.winner}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20)
  }
}
