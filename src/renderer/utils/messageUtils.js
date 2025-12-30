/**
 * Utility functions for message handling
 */

export function normUserKey(x) {
  return String(x || '').trim().toLowerCase();
}

export function hashString(str) {
  // Fast deterministic hash (FNV-1a)
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function fallbackUserColor(user, userColorCache) {
  const key = String(user || '').toLowerCase();
  if (!key) return 'hsl(210 85% 70%)';
  const cached = userColorCache.get(key);
  if (cached) return cached;

  const hue = hashString(key) % 360;
  // Bright & readable on dark background
  const color = `hsl(${hue} 85% 70%)`;
  userColorCache.set(key, color);
  return color;
}

