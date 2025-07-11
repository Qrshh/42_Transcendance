import type { GameState, Ball, Paddle } from './types'
import { CANVAS_WIDTH, CANVAS_HEIGHT, INITIAL_BALL_SPEED } from './constants'

/**
* collides
* Détecter la collision du paddle et de la balle
* (à améliorer la collision pour les faces)
* @returns 'true' | 'false'
*/
function collides(ball: Ball, paddle: Paddle): boolean {
  return (
    ball.x - ball.radius < paddle.x + paddle.width &&
    ball.x + ball.radius > paddle.x &&
    ball.y - ball.radius < paddle.y + paddle.height &&
    ball.y + ball.radius > paddle.y
  )
}

/**
* resetBall
* Sert à reset la balle à sa position initiale
*/
function resetBall(ball: Ball): void {
  ball.x = CANVAS_WIDTH / 2
  ball.y = CANVAS_HEIGHT / 2
  ball.vx = Math.random() > 0.5 ? INITIAL_BALL_SPEED : -INITIAL_BALL_SPEED
  ball.vy = Math.random() > 0.5 ? INITIAL_BALL_SPEED : -INITIAL_BALL_SPEED
}

/**
* updateGame
* Sert à updater les mouvevents de paddles et de balles,
* de rebond sur les mur et paddles et enfin la gestion du score
*/
export function updateGame(state: GameState): void {
  const { ball, paddles, score } = state

  Object.values(paddles).forEach(p => {
    p.y = Math.max(0, Math.min(CANVAS_HEIGHT - p.height, p.y + p.vy))
  })

  ball.x += ball.vx
  ball.y += ball.vy

  if (ball.y - ball.radius < 0 || ball.y + ball.radius > CANVAS_HEIGHT) {
    ball.vy *= -1
  }

  if (collides(ball, paddles.p1) || collides(ball, paddles.p2)) {
    ball.vx *= -1
  }

  if (ball.x - ball.radius < 0) {
    score.player2++
    resetBall(ball)
  } else if (ball.x + ball.radius > CANVAS_WIDTH) {
    score.player1++
    resetBall(ball)
  }
}
