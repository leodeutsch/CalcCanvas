export const scheduleIdle = (cb: () => void) => {
  const raf =
    global.requestAnimationFrame || ((fn: any) => setTimeout(fn, 16) as any);
  return raf(cb);
};
