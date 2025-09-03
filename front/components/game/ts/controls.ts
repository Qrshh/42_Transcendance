import type { GameState } from './types'
import { PADDLE_SPEED } from './constants'

/**
* Met à jour la vitesse verticale (vy) d'un paddle en fonction de la direction
* ou déclenche un dash (avancée horizontale).
* @param state L'état actuel du jeu
* @param player Le joueur ('p1' ou 'p2') dont le paddle doit bouger
* @param action La direction du mouvement ou dash
*/
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