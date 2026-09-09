export function fitImage(
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  if (width <= 0 || height <= 0 || viewportWidth <= 0 || viewportHeight <= 0)
    return { width: 0, height: 0 };
  const ratio = Math.min(viewportWidth / width, viewportHeight / height);
  return { width: width * ratio, height: height * ratio };
}

export function panLimit(image: number, viewport: number, scale: number) {
  'worklet';
  return Math.max(0, (image * scale - viewport) / 2);
}

export function clampPan(value: number, limit: number) {
  'worklet';
  return Math.max(-limit, Math.min(limit, value));
}

export function resistPan(value: number, limit: number, dimension: number) {
  'worklet';
  const edge = clampPan(value, limit);
  if (dimension <= 0) return edge;
  const overshoot = value - edge;
  return edge + (overshoot * dimension * 0.55) / (dimension + 0.55 * Math.abs(overshoot));
}
