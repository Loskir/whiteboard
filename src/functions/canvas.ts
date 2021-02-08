/**
 * Get the current pixel ratio, based on the device pixel ratio,
 * and the backing store pixel ratio of the canvas.
 * @returns {number} pixel ratio
 */
export function getCurrentPixelRatio() {
  return window.devicePixelRatio || 1
}
