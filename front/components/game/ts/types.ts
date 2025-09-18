export interface Ball {
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  lastCollisionTime?: number;
}

export interface Paddle {
  x: number; y: number;
  width: number; height: number;
  vy: number;
  isDashing?:boolean;
  dashCooldown?: number;
  dashProgress?: number;
  startX?: number;
}

export interface Score {
  player1: number;
  player2: number;
}

import type { ArenaTheme, BallSpeed, BallSize, PowerUpsFrequency } from '../../../stores/gameSettings'

export interface GameCustomizationState {
  arena: ArenaTheme
  ballSpeed: BallSpeed
  ballSize: BallSize
  accelBall: boolean
  paddleDash: boolean
  powerUps: PowerUpsFrequency
}

export interface GameState {
  ball: Ball;
  paddles: {
    p1: Paddle;
    p2: Paddle;
  };
  score: Score;

  gameOver: boolean;
  winner: string | null;
  status?: 'waiting' | 'starting' | 'playing' | 'finished';
  settings?: GameCustomizationState;
  baseSpeed?: number;
  targetScore?: number;
  powerUpsFrequency?: PowerUpsFrequency;
  usernames?: { p1?: string; p2?: string };
  icons?: { p1?: string; p2?: string };
  countdown?: number;
}
