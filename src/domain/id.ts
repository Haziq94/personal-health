/**
 * Identifier generation.
 *
 * Uses the platform UUID generator when one is present (Hermes exposes
 * `crypto.randomUUID` on recent React Native versions) and falls back to a
 * time-ordered random string. The fallback is not globally unique, but this
 * database never leaves the device, so per-device uniqueness is the bar.
 */
export function newId(): string {
  const cryptoRef = globalThis.crypto;
  if (typeof cryptoRef?.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
