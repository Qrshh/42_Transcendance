import { reactive } from 'vue'
import type { GameState } from './types'
import { CANVAS_WIDTH, CANVAS_HEIGHT, PADDLE_WIDTH, PADDLE_HEIGHT, BALL_RADIUS, INITIAL_BALL_SPEED } from './constants'

export function createInitialState(): GameState {
  return reactive({
    ball: {
      x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2,
      vx: INITIAL_BALL_SPEED, vy: INITIAL_BALL_SPEED,
      radius: BALL_RADIUS, lastCollisionTime: 0
    },
    paddles: {
      p1: { x: 10, y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2, width: PADDLE_WIDTH, height: PADDLE_HEIGHT, vy: 0 },
      p2: { x: CANVAS_WIDTH - PADDLE_WIDTH - 10, y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2, width: PADDLE_WIDTH, height: PADDLE_HEIGHT, vy: 0 },
    },
    score: { player1: 0, player2: 0 }
  })
}
