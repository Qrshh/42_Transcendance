import { onMounted, onBeforeUnmount } from 'vue'

/**
* Gère une boucle de jeu basée sur requestAnimationFrame
* @param callback La fonction à exécuter à chaque "tick" de la boucle
*/
export function useGameLoop(callback: () => void) {
  let animationFrameId: number;

  function loop() {
    callback();
    animationFrameId = requestAnimationFrame(loop);
  }

  onMounted(() => {
    loop();
  });

  onBeforeUnmount(() => {
    cancelAnimationFrame(animationFrameId);
  });
}
