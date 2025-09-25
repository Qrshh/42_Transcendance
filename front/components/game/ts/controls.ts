import type { GameState } from './types'
import { PADDLE_SPEED } from './constants'

export function movePaddle(
  state: GameState, 
  player: 'p1' | 'p2', 
  action: 'up' | 'down' | 'stop' | 'dash'
): void {
  const paddle = state.paddles[player]

  if (action === 'up') {
    paddle.vy = -PADDLE_SPEED
  } else if (action === 'down') {
    paddle.vy = PADDLE_SPEED
  } else if (action === 'stop') {
    paddle.vy = 0
  } else if (action === 'dash') {
    if (!paddle.isDashing && (!paddle.dashCooldown || paddle.dashCooldown <= 0)) {
      paddle.isDashing = true
      paddle.dashCooldown = 60 // environ 1 sec si 60fps
      paddle.dashProgress = 0
      paddle.startX = paddle.x
    }
  } 
}