export const isCoarsePointerDevice = () => {
  if (typeof window === "undefined") return false;
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
  const touchPoints = Number(navigator?.maxTouchPoints || 0) > 0;
  return Boolean(coarsePointer || touchPoints);
};

