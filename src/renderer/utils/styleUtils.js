/**
 * Utility functions for style management
 */

export function loadPreviewStyle() {
  try {
    return JSON.parse(localStorage.getItem('ducchat.homeStyle') || 'null') || null;
  } catch {
    return null;
  }
}

export function savePreviewStyle(style) {
  localStorage.setItem('ducchat.homeStyle', JSON.stringify(style));
}

export function getInterfaceConfig() {
  const base = window.__ducchatInterface || {};
  const override = (!document.body.classList.contains('isOverlay') && window.__ducchatInterfaceOverrides) 
    ? window.__ducchatInterfaceOverrides 
    : {};
  const cfg = { ...base, ...override };

  const MAX_DEFAULT = 200;
  const limit = Number.isFinite(cfg.limit) ? cfg.limit : MAX_DEFAULT;
  const userColors = cfg.userColors !== false;
  const userColor = cfg.userColor || null;
  const userCapitalizeFirst = cfg.userCapitalizeFirst === true;
  const frameTextCapitalizeFirst = cfg.frameTextCapitalizeFirst === true;
  const stacked = cfg.stacked === true;
  const msgTimeout = Number.isFinite(cfg.msgTimeout) && cfg.msgTimeout >= 0 ? cfg.msgTimeout : null;
  
  return { limit, userColors, userColor, userCapitalizeFirst, frameTextCapitalizeFirst, stacked, msgTimeout };
}

