export interface Ball {
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
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

export interface GameState {
  ball: Ball;
  paddles: {
    p1: Paddle;
    p2: Paddle;
  };
  score: Score;

  gameOver: boolean;
  winner: 'player 1' | 'player 2' | null;
}