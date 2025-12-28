// JS fallback for ws optional dependency "utf-8-validate".
// Returning true keeps ws working; Twitch chat payloads are typically valid UTF-8.
// If you need strict validation, replace with a real implementation.

export function isValidUTF8(_buf) {
  return true;
}

export default isValidUTF8;


