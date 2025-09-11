// src/utils/scale.ts
export type ScaleState = {
  scale: number;       // facteur (monde -> CSS pixels)
  offsetX: number;     // bordures noires (letterbox) en CSS px
  offsetY: number;
  viewportW: number;   // taille de la zone d’affichage en CSS px
  viewportH: number;
  dpr: number;         // devicePixelRatio
  worldW: number;
  worldH: number;
};

export function computeFit(
  worldW: number,
  worldH: number,
  viewportW: number,
  viewportH: number,
  dpr = window.devicePixelRatio || 1
): ScaleState {
  const scale = Math.min(viewportW / worldW, viewportH / worldH);
  const canvasW = worldW * scale;
  const canvasH = worldH * scale;
  const offsetX = Math.floor((viewportW - canvasW) / 2);
  const offsetY = Math.floor((viewportH - canvasH) / 2);
  return { scale, offsetX, offsetY, viewportW, viewportH, dpr, worldW, worldH };
}

/**
 * Prépare le canvas pour un rendu net :
 *  - Backing store = viewport * dpr (donc net sur écrans Retina)
 *  - Style = viewport (CSS pixels)
 *  - Transform = offsets + scale (monde → CSS px), puis *dpr* (CSS px → backstore)
 *  - À partir de là, TU DESSINES EN UNITÉS DU MONDE (sans te soucier du scale).
 */
export function setupCanvasTransform(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  s: ScaleState
) {
  const bw = Math.round(s.viewportW * s.dpr);
  const bh = Math.round(s.viewportH * s.dpr);

  if (canvas.width !== bw) canvas.width = bw;
  if (canvas.height !== bh) canvas.height = bh;

  canvas.style.width = `${s.viewportW}px`;
  canvas.style.height = `${s.viewportH}px`;

  // Réinitialise et bascule en "pixels CSS"
  ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
  ctx.clearRect(0, 0, s.viewportW, s.viewportH);

  // Offsets (letterbox) en CSS px
  ctx.translate(s.offsetX, s.offsetY);
  // Scale monde -> CSS px
  ctx.scale(s.scale, s.scale);
}

/** Convertit un point écran (clientX/Y) en coordonnées monde */
export function screenToWorld(s: ScaleState, clientX: number, clientY: number) {
  const xCss = clientX - s.offsetX;
  const yCss = clientY - s.offsetY;
  return {
    x: xCss / s.scale,
    y: yCss / s.scale,
  };
}
