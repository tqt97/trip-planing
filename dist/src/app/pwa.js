export function initPwa({ trace } = {}) {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').then(() => trace?.('info','PWA_READY','PWA service worker đã sẵn sàng.')).catch(error => trace?.('warn','PWA_REGISTER_FAILED',error.message)));
  const sync=()=>document.body.classList.toggle('is-offline',!navigator.onLine);window.addEventListener('online',sync);window.addEventListener('offline',sync);sync();
}
