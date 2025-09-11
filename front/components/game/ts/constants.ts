/** Valeurs généraux pour les état des jeux */
// Adapte le ratio pour mobile portrait afin que le canvas
// puisse occuper toute la hauteur en plein écran sans déformation.
// Portrait → ratio ~9:16 (largeur < hauteur)
// Landscape/desktop → ratio 2:1 (valeurs historiques)
const isPortrait = (() => {
  try { return typeof window !== 'undefined' && window.innerHeight > window.innerWidth } catch { return false }
})()

export const CANVAS_WIDTH = isPortrait ? 540 : 800
export const CANVAS_HEIGHT = isPortrait ? 960 : 400
export const PADDLE_SPEED = 8
export const INITIAL_BALL_SPEED = 4
export const PADDLE_WIDTH = 10
export const PADDLE_HEIGHT = 100
export const BALL_RADIUS = 8
