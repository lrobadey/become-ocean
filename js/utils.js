export function throttle(fn, wait) {
  let lastTime = 0;
  let timeout = null;
  return function(...args) {
    const now = Date.now();
    const remaining = wait - (now - lastTime);
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      lastTime = now;
      return fn.apply(this, args);
    }
    if (!timeout) {
      timeout = setTimeout(() => {
        lastTime = Date.now();
        timeout = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}
