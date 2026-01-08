import { AppShell } from './ui/AppShell';
import { createHashRouter } from './router/createHashRouter';
import { HomePage } from './pages/HomePage';
import { SettingsPage } from './pages/SettingsPage';
import { PseudosPage } from './pages/PseudosPage';

export function mountApp() {
  const root = document.getElementById('app');
  if (!root) throw new Error('Missing #app element in index.html');

  const params = new URL(window.location.href).searchParams;
  const isOverlay = params.get('overlay') === '1';
  // Compact is always enabled by default
  const isCompact = params.get('compact') !== '0'; // Default to true unless explicitly disabled
  const fontSizeParam = Number(params.get('fontSize'));
  const limitParam = Number(params.get('limit'));
  const showStreamerParam = params.get('showStreamer');
  const userColorsParam = params.get('userColors');
  const emoteRadiusParam = Number(params.get('emoteRadius'));
  const stackedParam = params.get('stacked');
  const msgPadParam = Number(params.get('msgPad'));
  const msgTimeoutParam = Number(params.get('msgTimeout'));
  const frameRedParam = params.get('frameRed');
  const frameBgColorParam = params.get('frameBgColor');
  const frameBorderWidthParam = Number(params.get('frameBorderWidth'));
  const frameBorderColorParam = params.get('frameBorderColor');
  const frameBorderRadiusTopLeftParam = Number(params.get('frameBorderRadiusTopLeft'));
  const frameBorderRadiusTopRightParam = Number(params.get('frameBorderRadiusTopRight'));
  const frameBorderRadiusBottomRightParam = Number(params.get('frameBorderRadiusBottomRight'));
  const frameBorderRadiusBottomLeftParam = Number(params.get('frameBorderRadiusBottomLeft'));
  // Compatibilité avec l'ancien format
  const frameBorderRadiusParam = Number(params.get('frameBorderRadius'));
  const framePaddingParam = Number(params.get('framePadding'));
  const frameShadowBlurParam = Number(params.get('frameShadowBlur'));
  const frameShadowColorParam = params.get('frameShadowColor');
  const frameShadowOpacityParam = Number(params.get('frameShadowOpacity'));
  const frameOuterShadowBlurParam = Number(params.get('frameOuterShadowBlur'));
  const frameOuterShadowColorParam = params.get('frameOuterShadowColor');
  const frameOuterShadowOpacityParam = Number(params.get('frameOuterShadowOpacity'));
  const frameTextColorParam = params.get('frameTextColor');
  const frameTextFontParam = params.get('frameTextFont');
  const frameTextBoldParam = params.get('frameTextBold');
  const frameTextItalicParam = params.get('frameTextItalic');
  const frameTextUnderlineParam = params.get('frameTextUnderline');
  const frameTextUppercaseParam = params.get('frameTextUppercase');
  const frameTextCapitalizeFirstParam = params.get('frameTextCapitalizeFirst');
  const userColorParam = params.get('userColor');
  const userFontParam = params.get('userFont');
  const userTextBoldParam = params.get('userTextBold');
  const userTextItalicParam = params.get('userTextItalic');
  const userTextUnderlineParam = params.get('userTextUnderline');
  const userTextUppercaseParam = params.get('userTextUppercase');
  const mentionColorParam = params.get('mentionColor');
  const mentionFontParam = params.get('mentionFont');
  const mentionBoldParam = params.get('mentionBold');
  const mentionItalicParam = params.get('mentionItalic');
  const mentionUnderlineParam = params.get('mentionUnderline');
  const mentionUppercaseParam = params.get('mentionUppercase');
  const userCapitalizeFirstParam = params.get('userCapitalizeFirst');
  const msgWidthTypeParam = params.get('msgWidthType');
  const msgWidthValueParam = Number(params.get('msgWidthValue'));
  const msgAlignParam = params.get('msgAlign');
  const animationTypeParam = params.get('animationType');
  const animationDurationParam = Number(params.get('animationDuration'));

  document.body.classList.toggle('isOverlay', isOverlay);
  document.body.classList.toggle('isCompact', isCompact);

  const fontSize = Number.isFinite(fontSizeParam) && fontSizeParam >= 8 && fontSizeParam <= 72 ? fontSizeParam : null;
  const limit = Number.isFinite(limitParam) && limitParam >= 1 && limitParam <= 500 ? Math.floor(limitParam) : null;
  const showStreamer = showStreamerParam === null ? true : showStreamerParam === '1' || showStreamerParam === 'true';
  const userColors = userColorsParam === null ? true : userColorsParam === '1' || userColorsParam === 'true';
  const emoteRadius =
    Number.isFinite(emoteRadiusParam) && emoteRadiusParam >= 0 && emoteRadiusParam <= 50
      ? Math.floor(emoteRadiusParam)
      : 0;
  const stacked = stackedParam === null ? false : stackedParam === '1' || stackedParam === 'true';
  const msgPad =
    Number.isFinite(msgPadParam) && msgPadParam >= 0 && msgPadParam <= 1 ? msgPadParam : null;
  const msgTimeout =
    Number.isFinite(msgTimeoutParam) && msgTimeoutParam >= 0 && msgTimeoutParam <= 300 ? msgTimeoutParam : null;
  const frameRed = frameRedParam === '1' || frameRedParam === 'true';
  const frameBgColor = frameBgColorParam && /^#[0-9A-Fa-f]{6}$/.test(frameBgColorParam) ? frameBgColorParam : null;
  const frameBorderWidth = Number.isFinite(frameBorderWidthParam) && frameBorderWidthParam >= 0 && frameBorderWidthParam <= 20 ? Math.floor(frameBorderWidthParam) : 0;
  const frameBorderColor = frameBorderColorParam && /^#[0-9A-Fa-f]{6}$/.test(frameBorderColorParam) ? frameBorderColorParam : '#ff0000';
  const frameBorderRadiusTopLeft = Number.isFinite(frameBorderRadiusTopLeftParam) && frameBorderRadiusTopLeftParam >= 0 && frameBorderRadiusTopLeftParam <= 50 ? Math.floor(frameBorderRadiusTopLeftParam) : (Number.isFinite(frameBorderRadiusParam) && frameBorderRadiusParam >= 0 && frameBorderRadiusParam <= 50 ? Math.floor(frameBorderRadiusParam) : 0);
  const frameBorderRadiusTopRight = Number.isFinite(frameBorderRadiusTopRightParam) && frameBorderRadiusTopRightParam >= 0 && frameBorderRadiusTopRightParam <= 50 ? Math.floor(frameBorderRadiusTopRightParam) : (Number.isFinite(frameBorderRadiusParam) && frameBorderRadiusParam >= 0 && frameBorderRadiusParam <= 50 ? Math.floor(frameBorderRadiusParam) : 0);
  const frameBorderRadiusBottomRight = Number.isFinite(frameBorderRadiusBottomRightParam) && frameBorderRadiusBottomRightParam >= 0 && frameBorderRadiusBottomRightParam <= 50 ? Math.floor(frameBorderRadiusBottomRightParam) : (Number.isFinite(frameBorderRadiusParam) && frameBorderRadiusParam >= 0 && frameBorderRadiusParam <= 50 ? Math.floor(frameBorderRadiusParam) : 0);
  const frameBorderRadiusBottomLeft = Number.isFinite(frameBorderRadiusBottomLeftParam) && frameBorderRadiusBottomLeftParam >= 0 && frameBorderRadiusBottomLeftParam <= 50 ? Math.floor(frameBorderRadiusBottomLeftParam) : (Number.isFinite(frameBorderRadiusParam) && frameBorderRadiusParam >= 0 && frameBorderRadiusParam <= 50 ? Math.floor(frameBorderRadiusParam) : 0);
  const framePadding = Number.isFinite(framePaddingParam) && framePaddingParam >= 0 && framePaddingParam <= 2 ? framePaddingParam : 0.3;
  const frameShadowBlur = Number.isFinite(frameShadowBlurParam) && frameShadowBlurParam >= 0 && frameShadowBlurParam <= 50 ? Math.floor(frameShadowBlurParam) : 0;
  const frameShadowColor = frameShadowColorParam && /^#[0-9A-Fa-f]{6}$/.test(frameShadowColorParam) ? frameShadowColorParam : '#000000';
  const frameShadowOpacity = Number.isFinite(frameShadowOpacityParam) && frameShadowOpacityParam >= 0 && frameShadowOpacityParam <= 100 ? frameShadowOpacityParam : 100;
  const frameOuterShadowBlur = Number.isFinite(frameOuterShadowBlurParam) && frameOuterShadowBlurParam >= 0 && frameOuterShadowBlurParam <= 50 ? Math.floor(frameOuterShadowBlurParam) : 0;
  const frameOuterShadowColor = frameOuterShadowColorParam && /^#[0-9A-Fa-f]{6}$/.test(frameOuterShadowColorParam) ? frameOuterShadowColorParam : '#000000';
  const frameOuterShadowOpacity = Number.isFinite(frameOuterShadowOpacityParam) && frameOuterShadowOpacityParam >= 0 && frameOuterShadowOpacityParam <= 100 ? frameOuterShadowOpacityParam : 100;
  const frameTextColor = frameTextColorParam && /^#[0-9A-Fa-f]{6}$/.test(frameTextColorParam) ? frameTextColorParam : '#ffffff';
  const frameTextFont = frameTextFontParam || '';
  const frameTextBold = frameTextBoldParam === '1' || frameTextBoldParam === 'true';
  const frameTextItalic = frameTextItalicParam === '1' || frameTextItalicParam === 'true';
  const frameTextUnderline = frameTextUnderlineParam === '1' || frameTextUnderlineParam === 'true';
  const frameTextUppercase = frameTextUppercaseParam === '1' || frameTextUppercaseParam === 'true';
  const frameTextCapitalizeFirst = frameTextCapitalizeFirstParam === '1' || frameTextCapitalizeFirstParam === 'true';
  const userColor = userColorParam && /^#[0-9A-Fa-f]{6}$/.test(userColorParam) ? userColorParam : null;
  const userFont = userFontParam || '';
  const userTextBold = userTextBoldParam === '1' || userTextBoldParam === 'true';
  const userTextItalic = userTextItalicParam === '1' || userTextItalicParam === 'true';
  const userTextUnderline = userTextUnderlineParam === '1' || userTextUnderlineParam === 'true';
  const userTextUppercase = userTextUppercaseParam === '1' || userTextUppercaseParam === 'true';
  const mentionColor = mentionColorParam && /^#[0-9A-Fa-f]{6}$/.test(mentionColorParam) ? mentionColorParam : '#9146ff';
  const mentionFont = mentionFontParam || '';
  const mentionBold = mentionBoldParam === '1' || mentionBoldParam === 'true';
  const mentionItalic = mentionItalicParam === '1' || mentionItalicParam === 'true';
  const mentionUnderline = mentionUnderlineParam === '1' || mentionUnderlineParam === 'true';
  const mentionUppercase = mentionUppercaseParam === '1' || mentionUppercaseParam === 'true';
  const userCapitalizeFirst = userCapitalizeFirstParam === '1' || userCapitalizeFirstParam === 'true';

  if (fontSize) {
    document.documentElement.style.setProperty('--chat-font-size', `${fontSize}px`);
  }
  if (emoteRadius) {
    document.documentElement.style.setProperty('--emote-radius', `${emoteRadius}px`);
  }
  if (msgPad !== null) {
    document.documentElement.style.setProperty('--msg-pad', `${msgPad}em`);
  }
  if (frameRed) {
    document.body.classList.add('hasFrameRed');
    if (frameBgColor) {
      document.documentElement.style.setProperty('--frame-bg-color', frameBgColor);
    }
    document.documentElement.style.setProperty('--frame-border-width', `${frameBorderWidth}px`);
    document.documentElement.style.setProperty('--frame-border-color', frameBorderColor);
    if (frameBorderRadiusTopLeft > 0 || frameBorderRadiusTopRight > 0 || frameBorderRadiusBottomRight > 0 || frameBorderRadiusBottomLeft > 0) {
      const borderRadius = `${frameBorderRadiusTopLeft}px ${frameBorderRadiusTopRight}px ${frameBorderRadiusBottomRight}px ${frameBorderRadiusBottomLeft}px`;
      document.documentElement.style.setProperty('--frame-border-radius', borderRadius);
    } else {
      document.documentElement.style.removeProperty('--frame-border-radius');
    }
    document.documentElement.style.setProperty('--frame-padding', `${framePadding}em`);
    // Build box-shadow value combining inner and outer shadows
    // Outer shadow first, then inner shadow (order matters for visibility)
    const shadows = [];
    let outerShadowPadding = 0;
    if (frameOuterShadowBlur > 0) {
      const outerOpacity = frameOuterShadowOpacity / 100;
      // Convert hex to rgba
      const hex = frameOuterShadowColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const rgbaColor = `rgba(${r}, ${g}, ${b}, ${outerOpacity})`;
      shadows.push(`0 2px ${frameOuterShadowBlur}px ${rgbaColor}`);
      // Calculate padding needed: blur spreads in all directions, so we need blur * 2 for each side
      // Plus offset (2px) + extra margin for safety (10px)
      outerShadowPadding = (frameOuterShadowBlur * 2) + 2 + 10;
    }
    if (frameShadowBlur > 0) {
      const opacity = frameShadowOpacity / 100;
      // Convert hex to rgba
      const hex = frameShadowColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const rgbaColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
      shadows.push(`inset 0 0 ${frameShadowBlur}px ${rgbaColor}`);
    }
    if (shadows.length > 0) {
      document.documentElement.style.setProperty('--frame-box-shadow', shadows.join(', '));
    } else {
      document.documentElement.style.removeProperty('--frame-box-shadow');
    }
    // Add padding to chatLog to accommodate outer shadow
    if (outerShadowPadding > 0) {
      document.documentElement.style.setProperty('--chat-log-shadow-padding', `${outerShadowPadding}px`);
    } else {
      document.documentElement.style.removeProperty('--chat-log-shadow-padding');
    }
    document.documentElement.style.setProperty('--frame-text-color', frameTextColor);
    document.documentElement.style.setProperty('--frame-text-weight', frameTextBold ? 'bold' : 'normal');
    document.documentElement.style.setProperty('--frame-text-style', frameTextItalic ? 'italic' : 'normal');
    document.documentElement.style.setProperty('--frame-text-decoration', frameTextUnderline ? 'underline' : 'none');
    document.documentElement.style.setProperty('--frame-text-transform', frameTextUppercase ? 'uppercase' : 'none');
    if (frameTextFont) {
      document.documentElement.style.setProperty('--frame-text-font-family', frameTextFont);
    } else {
      document.documentElement.style.removeProperty('--frame-text-font-family');
    }
  }
  
  // Apply user (pseudo) styles
  if (userColor) {
    document.documentElement.style.setProperty('--user-default-color', userColor);
  } else {
    document.documentElement.style.removeProperty('--user-default-color');
  }
  document.documentElement.style.setProperty('--user-text-weight', userTextBold ? 'bold' : 'normal');
  document.documentElement.style.setProperty('--user-text-style', userTextItalic ? 'italic' : 'normal');
  document.documentElement.style.setProperty('--user-text-decoration', userTextUnderline ? 'underline' : 'none');
  document.documentElement.style.setProperty('--user-text-transform', userTextUppercase ? 'uppercase' : 'none');
  if (userFont) {
    document.documentElement.style.setProperty('--user-font-family', userFont);
  } else {
    document.documentElement.style.removeProperty('--user-font-family');
  }
  
  // Apply mention styles (always enabled)
  document.documentElement.style.setProperty('--mention-color', mentionColor);
  document.documentElement.style.setProperty('--mention-weight', mentionBold ? 'bold' : 'normal');
  document.documentElement.style.setProperty('--mention-style', mentionItalic ? 'italic' : 'normal');
  document.documentElement.style.setProperty('--mention-decoration', mentionUnderline ? 'underline' : 'none');
  document.documentElement.style.setProperty('--mention-transform', mentionUppercase ? 'uppercase' : 'none');
  if (mentionFont) {
    document.documentElement.style.setProperty('--mention-font-family', mentionFont);
  } else {
    document.documentElement.style.removeProperty('--mention-font-family');
  }
  
  // Apply layout styles (width and alignment)
  const msgWidthType = msgWidthTypeParam || 'auto';
  const msgWidthValue = Number.isFinite(msgWidthValueParam) && msgWidthValueParam >= 50 && msgWidthValueParam <= 2000 ? msgWidthValueParam : 300;
  const msgAlign = msgAlignParam === 'center' ? 'center' : msgAlignParam === 'right' ? 'flex-end' : 'flex-start';
  
  if (msgWidthType === 'fixed') {
    document.documentElement.style.setProperty('--msg-width', `${msgWidthValue}px`);
  } else {
    document.documentElement.style.setProperty('--msg-width', 'auto');
  }
  document.documentElement.style.setProperty('--msg-align', msgAlign);
  
  // Apply animation styles
  const animationType = animationTypeParam || 'none';
  const animationDuration = Number.isFinite(animationDurationParam) && animationDurationParam > 0 ? animationDurationParam : 0.3;
  
  // Set CSS variables for animation duration and easing
  document.documentElement.style.setProperty('--msg-animation-duration', `${animationDuration}s`);
  document.documentElement.style.setProperty('--msg-animation-easing', 'ease-out');
  
  if (animationType && animationType !== 'none') {
    // Apply animation to all existing messages
    document.querySelectorAll('.chatMsg').forEach((msg) => {
      msg.dataset.animation = animationType;
    });
  }

  // Expose a tiny runtime config for pages (optional)
  window.__ducchatInterface = { fontSize, limit, showStreamer, userColors, emoteRadius, stacked, msgPad, msgTimeout, frameRed, frameBgColor, frameTextCapitalizeFirst, animationType, animationDuration };

  const outlet = document.createElement('div');

  const router = createHashRouter({
    routes: {
      '/': HomePage,
      '/settings': SettingsPage,
      '/pseudos': PseudosPage,
    },
    outlet,
  });

  root.replaceChildren(AppShell({ outlet, router, isOverlay }));
  router.start();
}


