/**
 * Builds the interface URL with all style parameters
 */
export function buildInterfaceUrl(baseUrl, cfg) {
  const u = new URL(baseUrl);
  u.searchParams.set('overlay', '1');
  if (cfg.fontSize) u.searchParams.set('fontSize', String(cfg.fontSize));
  if (cfg.limit) u.searchParams.set('limit', String(cfg.limit));
  u.searchParams.set('showStreamer', '1'); // Always show streamer messages
  u.searchParams.set('userColors', cfg.userColors ? '1' : '0');
  u.searchParams.set('compact', '1'); // Compact is always enabled
  if (cfg.emoteRadius && cfg.emoteRadius > 0) u.searchParams.set('emoteRadius', String(cfg.emoteRadius));
  if (cfg.stacked) u.searchParams.set('stacked', '1');
  if (typeof cfg.msgPad === 'number') u.searchParams.set('msgPad', String(cfg.msgPad));
  if (typeof cfg.msgTimeout === 'number' && cfg.msgTimeout > 0) u.searchParams.set('msgTimeout', String(cfg.msgTimeout));
  if (cfg.frameRed) {
    u.searchParams.set('frameRed', '1');
    if (cfg.frameBgColor) u.searchParams.set('frameBgColor', cfg.frameBgColor);
    if (cfg.frameBorderWidth) u.searchParams.set('frameBorderWidth', String(cfg.frameBorderWidth));
    if (cfg.frameBorderColor) u.searchParams.set('frameBorderColor', cfg.frameBorderColor);
    if (cfg.frameBorderRadiusTopLeft) u.searchParams.set('frameBorderRadiusTopLeft', String(cfg.frameBorderRadiusTopLeft));
    if (cfg.frameBorderRadiusTopRight) u.searchParams.set('frameBorderRadiusTopRight', String(cfg.frameBorderRadiusTopRight));
    if (cfg.frameBorderRadiusBottomRight) u.searchParams.set('frameBorderRadiusBottomRight', String(cfg.frameBorderRadiusBottomRight));
    if (cfg.frameBorderRadiusBottomLeft) u.searchParams.set('frameBorderRadiusBottomLeft', String(cfg.frameBorderRadiusBottomLeft));
    if (cfg.framePadding) u.searchParams.set('framePadding', String(cfg.framePadding));
    if (cfg.frameShadowBlur > 0) {
      u.searchParams.set('frameShadowBlur', String(cfg.frameShadowBlur));
      if (cfg.frameShadowColor) u.searchParams.set('frameShadowColor', cfg.frameShadowColor);
      if (cfg.frameShadowOpacity !== undefined) u.searchParams.set('frameShadowOpacity', String(cfg.frameShadowOpacity));
    }
    if (cfg.frameTextColor) u.searchParams.set('frameTextColor', cfg.frameTextColor);
    if (cfg.frameTextFont) u.searchParams.set('frameTextFont', cfg.frameTextFont);
    if (cfg.frameTextBold) u.searchParams.set('frameTextBold', '1');
    if (cfg.frameTextItalic) u.searchParams.set('frameTextItalic', '1');
    if (cfg.frameTextUnderline) u.searchParams.set('frameTextUnderline', '1');
    if (cfg.frameTextUppercase) u.searchParams.set('frameTextUppercase', '1');
    if (cfg.frameTextCapitalizeFirst) u.searchParams.set('frameTextCapitalizeFirst', '1');
    if (cfg.userColor) u.searchParams.set('userColor', cfg.userColor);
    if (cfg.userFont) u.searchParams.set('userFont', cfg.userFont);
    if (cfg.userTextBold) u.searchParams.set('userTextBold', '1');
    if (cfg.userTextItalic) u.searchParams.set('userTextItalic', '1');
    if (cfg.userTextUnderline) u.searchParams.set('userTextUnderline', '1');
    if (cfg.userTextUppercase) u.searchParams.set('userTextUppercase', '1');
    if (cfg.userCapitalizeFirst) u.searchParams.set('userCapitalizeFirst', '1');
    if (cfg.mentionColor) u.searchParams.set('mentionColor', cfg.mentionColor);
    if (cfg.mentionFont) u.searchParams.set('mentionFont', cfg.mentionFont);
    if (cfg.mentionBold) u.searchParams.set('mentionBold', '1');
    if (cfg.mentionItalic) u.searchParams.set('mentionItalic', '1');
    if (cfg.mentionUnderline) u.searchParams.set('mentionUnderline', '1');
    if (cfg.mentionUppercase) u.searchParams.set('mentionUppercase', '1');
    if (cfg.msgWidthType) u.searchParams.set('msgWidthType', cfg.msgWidthType);
    if (cfg.msgWidthType === 'fixed' && cfg.msgWidthValue) u.searchParams.set('msgWidthValue', String(cfg.msgWidthValue));
    if (cfg.msgAlign) u.searchParams.set('msgAlign', cfg.msgAlign);
  }
  u.hash = '#/';
  return u.toString();
}

