export function vibrate(ms = 30): void {
  navigator.vibrate?.(ms);
}
