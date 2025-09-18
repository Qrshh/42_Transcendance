import type { GameState, Ball, Paddle } from './types'
import { CANVAS_WIDTH, CANVAS_HEIGHT, INITIAL_BALL_SPEED } from './constants'

/**
* Détecter la collision du paddle et de la balle
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
* Vérifie si la balle va vers le paddle (évite les collisions multiples)
*/
function isBallMovingTowardsPaddle(ball: Ball, paddle: Paddle): boolean {
  // Pour le paddle de gauche (p1)
  if (paddle.x < CANVAS_WIDTH / 2) {
    return ball.vx < 0 // La balle va vers la gauche
  } 
  // Pour le paddle de droite (p2)
  else {
    return ball.vx > 0 // La balle va vers la droite
  }
}

/**
* Repositionne la balle hors du paddle après collision
*/
function repositionBallAfterCollision(ball: Ball, paddle: Paddle): void {
  // Pour le paddle de gauche (p1)
  if (paddle.x < CANVAS_WIDTH / 2) {
    ball.x = paddle.x + paddle.width + ball.radius + 1
  } 
  // Pour le paddle de droite (p2)
  else {
    ball.x = paddle.x - ball.radius - 1
  }
}

/**
* reset la balle à sa position initiale
*/
function resetBall(state: GameState): void {
  const ball = state.ball
  const base = state.baseSpeed ?? INITIAL_BALL_SPEED
  ball.x = CANVAS_WIDTH / 2
  ball.y = CANVAS_HEIGHT / 2
  ball.vx = Math.random() > 0.5 ? base : -base
  ball.vy = Math.random() > 0.5 ? base : -base
  ball.lastCollisionTime = 0
}

/**
* Sert à updater les mouvevents de paddles et de balles,
* de rebond sur les mur et paddles et enfin la gestion du score
*/
const SPEED_INCREMENT = 1.05
const MAX_SPEED = 20
const DASH_DISTANCE = 20
const DASH_DURATION = 10
const COLLISION_COOLDOWN = 10 // frames de cooldown entre collisions

export function updateGame(state: GameState, opts: { accelerating?: boolean } = {}): void {
  const { ball, paddles, score } = state

  if(state.gameOver) return ;

  const accelerating = opts.accelerating ?? state.settings?.accelBall ?? true
  const targetScore = state.targetScore ?? 5

  // Incrémenter le timer de collisions
  if (ball.lastCollisionTime !== undefined && ball.lastCollisionTime > 0) {
    ball.lastCollisionTime--
  }

  Object.values(paddles).forEach(p => {
    if(p.dashCooldown && p.dashCooldown > 0){
      p.dashCooldown--
    }
    if(p.isDashing && p.dashProgress !== undefined){
      const direction = p === state.paddles.p1 ? 1 : -1
      if(p.dashProgress < DASH_DURATION){
        //aller
        p.x = p.startX! + direction * (DASH_DISTANCE * (p.dashProgress / DASH_DURATION))
      } else if (p.dashProgress < DASH_DURATION * 2){
        //retour 
        const progressBack = p.dashProgress - DASH_DURATION
        p.x = p.startX! + direction * (DASH_DISTANCE * (1 - progressBack / DASH_DURATION))
      } else {
        p.x = p.startX!
        p.isDashing = false
        p.dashProgress = undefined
        p.startX = undefined
      }
      p.dashProgress! += 1
    }

    p.y = Math.max(0, Math.min(CANVAS_HEIGHT - p.height, p.y + p.vy))
  })

  ball.x += ball.vx
  ball.y += ball.vy

  // Rebond sur les murs haut/bas
  if (ball.y - ball.radius < 0 || ball.y + ball.radius > CANVAS_HEIGHT) {
    ball.vy *= -1
  }

  const canCollide = !ball.lastCollisionTime || ball.lastCollisionTime <= 0

  if (canCollide) {
    // Vérifier collision avec paddle 1
    if (collides(ball, paddles.p1) && isBallMovingTowardsPaddle(ball, paddles.p1)) {
      handlePaddleCollision(ball, paddles.p1, accelerating)
    }
    // Vérifier collision avec paddle 2  
    else if (collides(ball, paddles.p2) && isBallMovingTowardsPaddle(ball, paddles.p2)) {
      handlePaddleCollision(ball, paddles.p2, accelerating)
    }
  }

  // Gestion des buts
  if (ball.x - ball.radius < 0) {
    score.player2++
    if(score.player2 >= targetScore){
      state.gameOver = true
      state.winner = 'player 2'
      state.status = 'finished'
    } else {
      resetBall(state)
    }
  } else if (ball.x + ball.radius > CANVAS_WIDTH) {
    score.player1++
    if(score.player1 >= targetScore){
      state.gameOver = true
      state.winner = 'player 1'
      state.status = 'finished'
    } else {
      resetBall(state)
    }
  }
}

/**
* Gère la collision avec un paddle
*/
function handlePaddleCollision(ball: Ball, paddle: Paddle, accelerating: boolean): void {
  // Inverser la direction horizontale
  ball.vx *= -1

  // Repositionner la balle hors du paddle
  repositionBallAfterCollision(ball, paddle)

  // Accélération si activée
  if(accelerating){
    ball.vx = ball.vx * SPEED_INCREMENT
    ball.vy = ball.vy * SPEED_INCREMENT

    ball.vx = Math.max(Math.min(ball.vx, MAX_SPEED), -MAX_SPEED)
    ball.vy = Math.max(Math.min(ball.vy, MAX_SPEED), -MAX_SPEED)
  }

  // Bonus de vitesse si le paddle fait un dash
  if(paddle.isDashing){
    ball.vx *= 1.2
    ball.vy *= 1.2
  }

  // Activer le cooldown de collision
  ball.lastCollisionTime = COLLISION_COOLDOWN
}
