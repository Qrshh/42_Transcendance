import { reactive } from 'vue'
import type { GameState } from './types'
import { CANVAS_WIDTH, CANVAS_HEIGHT, PADDLE_WIDTH, PADDLE_HEIGHT, BALL_RADIUS, INITIAL_BALL_SPEED } from './constants'
import type { ArenaTheme, BallSpeed, BallSize, PowerUpsFrequency } from '../../../stores/gameSettings'

export interface InitialStateOptions {
  arena?: ArenaTheme
  ballSpeed?: BallSpeed
  ballSize?: BallSize
  baseSpeed?: number
  ballRadius?: number
  accelBall?: boolean
  paddleDash?: boolean
  powerUps?: PowerUpsFrequency
  targetScore?: number
}

export function createInitialState(options: InitialStateOptions = {}): GameState {
  const baseSpeed = options.baseSpeed ?? INITIAL_BALL_SPEED
  const radius = options.ballRadius ?? BALL_RADIUS
  const targetScore = options.targetScore ?? 5

  return reactive<GameState>({
    ball: {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      vx: baseSpeed,
      vy: baseSpeed,
      radius,
      lastCollisionTime: 0
    },
    paddles: {
      p1: { x: 10, y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2, width: PADDLE_WIDTH, height: PADDLE_HEIGHT, vy: 0 },
      p2: { x: CANVAS_WIDTH - PADDLE_WIDTH - 10, y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2, width: PADDLE_WIDTH, height: PADDLE_HEIGHT, vy: 0 },
    },
    score: { player1: 0, player2: 0 },
    gameOver: false,
    winner: null,
    status: 'waiting',
    baseSpeed,
    targetScore,
    powerUpsFrequency: options.powerUps ?? 'off',
    settings: {
      arena: options.arena ?? 'classic',
      ballSpeed: options.ballSpeed ?? 'normal',
      ballSize: options.ballSize ?? 'standard',
      accelBall: options.accelBall ?? false,
      paddleDash: options.paddleDash ?? false,
      powerUps: options.powerUps ?? 'off'
    },
    usernames: {
      p1: 'Joueur 1',
      p2: 'Joueur 2'
    },
    icons: {
      p1: '🎮',
      p2: '🎯'
    },
    countdown: 0
  })
}
