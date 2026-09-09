// A fast response needs only the button spinner. Slow feedback must not outlive
// the request, cancellation, or the screen that started it.
export function delayedRequestNotice(
  signal: AbortSignal,
  show: () => void,
  hide: () => void,
  delay = 8000,
) {
  if (signal.aborted) return () => {};
  let shown = false;
  let stopped = false;
  const timer = setTimeout(() => {
    if (stopped || signal.aborted) return;
    shown = true;
    show();
  }, delay);
  function stop() {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    signal.removeEventListener('abort', stop);
    if (shown) hide();
  }
  signal.addEventListener('abort', stop, { once: true });
  return stop;
}
