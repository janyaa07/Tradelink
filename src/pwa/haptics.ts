/**
 * A short vibration on Confirm and similar taps (docs/PLAN.md, section 4.7). Android browsers support
 * `navigator.vibrate`; iPhone has no web haptics, so this does nothing there until the Capacitor shell.
 */
export function tapFeedback(pattern: number | number[] = 12): boolean {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}
