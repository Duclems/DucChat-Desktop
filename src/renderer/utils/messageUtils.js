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

/**
 * Converts HSL to RGB
 */
function hslToRgb(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Calculates the Euclidean distance between two RGB colors
 */
function colorDistance(rgb1, rgb2) {
  const [r1, g1, b1] = rgb1;
  const [r2, g2, b2] = rgb2;
  return Math.sqrt(
    Math.pow(r1 - r2, 2) + 
    Math.pow(g1 - g2, 2) + 
    Math.pow(b1 - b2, 2)
  );
}

/**
 * Converts hex color to RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : null;
}

/**
 * Checks if a color is too close to the background and returns a safe color if needed
 * Checks against both dark background (#0a0a0a) and light background (white)
 */
export function ensureColorVisibility(color, user, userColorCache) {
  if (!color) return null;
  
  // Check against both dark and light backgrounds
  const darkBgRgb = [10, 10, 10]; // Page background
  const lightBgRgb = [255, 255, 255]; // Message background (white)
  const minDistance = 150; // Minimum color distance from background
  
  // Convert color to RGB
  let rgb = null;
  
  // Handle hex colors (#RRGGBB or #RGB)
  if (color.startsWith('#')) {
    rgb = hexToRgb(color);
  } else if (color.startsWith('rgb')) {
    // Handle rgb() or rgba() format
    const matches = color.match(/\d+/g);
    if (matches && matches.length >= 3) {
      rgb = [parseInt(matches[0]), parseInt(matches[1]), parseInt(matches[2])];
    }
  } else if (color.startsWith('hsl')) {
    // Handle hsl() format
    const matches = color.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/i);
    if (matches) {
      const h = parseInt(matches[1]);
      const s = parseInt(matches[2]);
      const l = parseInt(matches[3]);
      rgb = hslToRgb(h, s, l);
    }
  }
  
  // If we couldn't parse the color, return it as-is
  if (!rgb) return color;
  
  // Check distance from both backgrounds
  const distanceFromDark = colorDistance(rgb, darkBgRgb);
  const distanceFromLight = colorDistance(rgb, lightBgRgb);
  
  // If color is too close to either background, use fallback color instead
  if (distanceFromDark < minDistance || distanceFromLight < minDistance) {
    return fallbackUserColor(user, userColorCache);
  }
  
  return color;
}

export function fallbackUserColor(user, userColorCache) {
  const key = String(user || '').toLowerCase();
  if (!key) return 'hsl(210 85% 50%)';
  const cached = userColorCache.get(key);
  if (cached) return cached;

  // Check against both dark and light backgrounds
  const darkBgRgb = [10, 10, 10]; // Page background
  const lightBgRgb = [255, 255, 255]; // Message background (white)
  const minDistance = 150; // Minimum color distance from background
  
  const baseHue = hashString(key) % 360;
  let hue = baseHue;
  let saturation = 85;
  // Use medium lightness (around 50%) to be visible on both dark and light backgrounds
  let lightness = 50;
  
  // Convert to RGB and check distance from both backgrounds
  let rgb = hslToRgb(hue, saturation, lightness);
  let distanceFromDark = colorDistance(rgb, darkBgRgb);
  let distanceFromLight = colorDistance(rgb, lightBgRgb);
  
  // Adjust if too close to dark background (increase lightness)
  if (distanceFromDark < minDistance) {
    lightness = Math.min(60, lightness + 15);
    saturation = Math.max(75, saturation);
    rgb = hslToRgb(hue, saturation, lightness);
    distanceFromDark = colorDistance(rgb, darkBgRgb);
    distanceFromLight = colorDistance(rgb, lightBgRgb);
  }
  
  // Adjust if too close to light background (decrease lightness)
  if (distanceFromLight < minDistance) {
    lightness = Math.max(40, lightness - 15);
    saturation = Math.max(75, saturation);
    rgb = hslToRgb(hue, saturation, lightness);
    distanceFromDark = colorDistance(rgb, darkBgRgb);
    distanceFromLight = colorDistance(rgb, lightBgRgb);
  }
  
  // If still too close to either background, try a different hue
  if (distanceFromDark < minDistance || distanceFromLight < minDistance) {
    hue = (hue + 180) % 360; // Try opposite hue
    lightness = 50;
    saturation = 85;
    rgb = hslToRgb(hue, saturation, lightness);
    distanceFromDark = colorDistance(rgb, darkBgRgb);
    distanceFromLight = colorDistance(rgb, lightBgRgb);
  }
  
  // Final check: ensure we're not too close to either background
  // If still problematic, use a safe medium color
  if (distanceFromDark < minDistance || distanceFromLight < minDistance) {
    // Use a vibrant medium color that works on both backgrounds
    hue = 210; // Blue
    saturation = 85;
    lightness = 50;
  }
  
  const color = `hsl(${hue} ${saturation}% ${lightness}%)`;
  userColorCache.set(key, color);
  return color;
}

