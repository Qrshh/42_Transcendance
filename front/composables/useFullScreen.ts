// src/composables/useFullscreen.ts
export function requestFullscreen(el: Element) {
  const anyEl = el as any;
  if (el.requestFullscreen) return el.requestFullscreen();
  if (anyEl.webkitRequestFullscreen) return anyEl.webkitRequestFullscreen(); // iOS Safari
  if (anyEl.msRequestFullscreen) return anyEl.msRequestFullscreen();
}

export function exitFullscreen() {
  const doc: any = document;
  if (document.exitFullscreen) return document.exitFullscreen();
  if (doc.webkitExitFullscreen) return doc.webkitExitFullscreen();
  if (doc.msExitFullscreen) return doc.msExitFullscreen();
}

export function isFullscreen(): boolean {
  const doc: any = document;
  return !!(
    document.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.msFullscreenElement
  );
}

export function onFullscreenChange(cb: () => void) {
  const doc: any = document;
  document.addEventListener('fullscreenchange', cb);
  document.addEventListener('webkitfullscreenchange', cb);
  document.addEventListener('msfullscreenchange', cb);
  return () => {
    document.removeEventListener('fullscreenchange', cb);
    document.removeEventListener('webkitfullscreenchange', cb);
    document.removeEventListener('msfullscreenchange', cb);
  };
}
