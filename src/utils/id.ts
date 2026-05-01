/**
 * Generate a unique ID using timestamp + random string
 * @returns Unique identifier string
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `${timestamp}${randomPart}`;
}
