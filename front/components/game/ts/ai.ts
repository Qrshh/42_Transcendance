import type { GameState } from './types'
import { PADDLE_SPEED } from './constants'


export type PaddleId = 'p1' | 'p2'

/*
* updateAIPaddle
* Met à jour le mouvement du paddle de l'IA
*/
export function updateAIPaddle(state: GameState): void {
  const { ball, paddles } = state
  const aiPaddle = paddles.p2;
  const paddleCenter = aiPaddle.y + aiPaddle.height / 2;
  const AI_REACTION_THRESHOLD = 15;

  if (ball.y < paddleCenter - AI_REACTION_THRESHOLD) {
    aiPaddle.vy = -PADDLE_SPEED;
  } else if (ball.y > paddleCenter + AI_REACTION_THRESHOLD) {
    aiPaddle.vy = PADDLE_SPEED;
  } else {
    aiPaddle.vy = 0;
  }
}
