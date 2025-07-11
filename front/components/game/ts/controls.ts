import type { GameState } from './types'
import { PADDLE_SPEED } from './constants'

/**
* Met à jour la vitesse verticale (vy) d'un paddle en fonction de la direction
* @param state L'état actuel du jeu
* @param player Le joueur ('p1' ou 'p2') dont le paddle doit bouger
* @param direction La direction du mouvement
*/
export function movePaddle(
  state: GameState, 
  player: 'p1' | 'p2', 
  direction: 'up' | 'down' | 'stop'
): void {
  state.paddles[player].vy =
    direction === 'up'   ? -PADDLE_SPEED :
    direction === 'down' ?  PADDLE_SPEED : 0
}
