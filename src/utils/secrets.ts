/** Number of leading/trailing characters kept when masking a secret. */
const PREFIX_LENGTH = 6;
const SUFFIX_LENGTH = 4;
/** Below this length there is nothing safe to reveal. */
const MIN_REVEALABLE_LENGTH = PREFIX_LENGTH + SUFFIX_LENGTH + 2;
const ELLIPSIS = "…";

/**
 * Render an API key safe to send to a browser.
 *
 * The settings dialog needs to show that a key is configured without handing
 * the key itself to anyone who can reach the server. The ellipsis is what makes
 * a mask distinguishable from a real key — no provider issues keys containing
 * one — which is what lets `resolveApiKey` detect an untouched field.
 */
export function maskApiKey(key: string | null | undefined): string {
  if (!key) return "";
  if (key.length < MIN_REVEALABLE_LENGTH) return ELLIPSIS.repeat(4);
  return `${key.slice(0, PREFIX_LENGTH)}${ELLIPSIS}${key.slice(-SUFFIX_LENGTH)}`;
}

/** True when `value` is a mask rather than a real secret. */
export function isMaskedApiKey(value: string): boolean {
  return value.includes(ELLIPSIS);
}

/**
 * Decide which key a request actually means.
 *
 * A submitted value that matches the mask of the stored key means the user left
 * the field alone, so the stored key is kept. Anything else is a real edit —
 * including clearing the field, which removes the key.
 */
export function resolveApiKey(submitted: string | null | undefined, stored: string | null): string {
  const value = submitted ?? "";
  if (isMaskedApiKey(value)) return stored ?? "";
  return value;
}
