import type { GameState } from '../ts/types'
import { PADDLE_SPEED } from '../ts/constants'

/** Type pour identifier les joueurs selon leur paddle */
export type PaddleId = 'p1' | 'p2';

/** Typage pour l'état du jeux */
export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  vy: number;
}

export interface Score {
  player1: number;
  player2: number;
}

export interface GameState {
  ball: Ball;
  paddles: Record<PaddleId, Paddle>;
  score: Score;
}

/**
* computeAIMove
* Détermine le mouvement du paddle de l'IA pour suivre la balle
*
* @param state    - État actuel du jeu
* @param paddleId - 'p1' ou 'p2' : quelle raquette l’IA contrôle
* @returns 'up' | 'down' | 'stop'
*/
export function computeAIMove(
  state: GameState,
  paddleId: PaddleId
): 'up' | 'down' | 'stop' {
  const paddle = state.paddles[paddleId];
  const ballY = state.ball.y;
  const centerY = paddle.y + paddle.height / 2;
  const deadZone = paddle.height * 0.1;

  if (ballY < centerY - deadZone) {
    return 'up';
  } else if (ballY > centerY + deadZone) {
    return 'down';
  } else {
    return 'stop';
  }
}

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