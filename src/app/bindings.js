export function bindEvent(target, eventName, handler, options) {
  if (!target) return false;
  target.addEventListener(eventName, handler, options);
  return true;
}

export function bindScrollControl({ selector, targetSelector = null, trace, options = { behavior: 'smooth', block: 'start' } }) {
  const control = document.querySelector(selector);
  const target = targetSelector ? document.querySelector(targetSelector) : null;
  if (!control || (targetSelector && !target)) {
    trace?.('warn', 'OPTIONAL_UI_BIND_SKIPPED', `Bỏ qua binding ${selector}${targetSelector ? ` → ${targetSelector}` : ''} vì control/target không tồn tại trong layout hiện tại.`);
    return false;
  }
  return bindEvent(control, 'click', () => target ? target.scrollIntoView(options) : window.scrollTo({ top: 0, behavior: 'smooth' }));
}
