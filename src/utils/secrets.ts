/** Number of leading/trailing characters kept when masking a secret. */
const PREFIX_LENGTH = 6;
const SUFFIX_LENGTH = 4;
/** Below this length there is nothing safe to reveal. */
const MIN_REVEALABLE_LENGTH = PREFIX_LENGTH + SUFFIX_LENGTH + 2;
const ELLIPSIS = "…";

/**
 * Render an API key safe to send to a browser.
 *
 * The settings dialog shows that a key is configured without handing the key
 * itself to anyone who can reach the server. Keys never travel back: config is
 * read-only over HTTP and lives only in `.env`.
 */
export function maskApiKey(key: string | null | undefined): string {
  if (!key) return "";
  if (key.length < MIN_REVEALABLE_LENGTH) return ELLIPSIS.repeat(4);
  return `${key.slice(0, PREFIX_LENGTH)}${ELLIPSIS}${key.slice(-SUFFIX_LENGTH)}`;
}
