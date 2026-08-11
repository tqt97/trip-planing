const PHASE_CLASSES = ['app-booting', 'app-auth-required', 'app-ready'];

export function createAppShell({ bootGate, bootMessage, authGate, authMessage, loginButton }) {
  function phase(next, message = '') {
    document.body.classList.remove(...PHASE_CLASSES);
    document.body.classList.add(`app-${next}`);
    const booting = next === 'booting';
    const authRequired = next === 'auth-required';
    if (bootGate) bootGate.hidden = !booting;
    if (authGate) authGate.hidden = !authRequired;
    if (message) {
      if (booting && bootMessage) bootMessage.textContent = message;
      if (authRequired && authMessage) authMessage.textContent = message;
    }
  }

  function setLoginBusy(busy) {
    if (!loginButton) return;
    loginButton.disabled = busy;
    loginButton.textContent = busy ? 'Đang mở Google…' : 'Đăng nhập với Google';
  }

  return {
    boot(message) { phase('booting', message); },
    auth(message) { phase('auth-required', message); },
    ready() { phase('ready'); },
    setLoginBusy
  };
}
