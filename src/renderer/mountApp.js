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
  const frameBorderRadiusParam = Number(params.get('frameBorderRadius'));
  const framePaddingParam = Number(params.get('framePadding'));
  const frameShadowBlurParam = Number(params.get('frameShadowBlur'));
  const frameShadowColorParam = params.get('frameShadowColor');
  const frameTextColorParam = params.get('frameTextColor');
  const frameTextBoldParam = params.get('frameTextBold');
  const frameTextItalicParam = params.get('frameTextItalic');
  const frameTextUnderlineParam = params.get('frameTextUnderline');
  const frameTextUppercaseParam = params.get('frameTextUppercase');
  const userColorParam = params.get('userColor');
  const userTextBoldParam = params.get('userTextBold');
  const userTextItalicParam = params.get('userTextItalic');
  const userTextUnderlineParam = params.get('userTextUnderline');
  const userTextUppercaseParam = params.get('userTextUppercase');

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
  const frameBorderWidth = Number.isFinite(frameBorderWidthParam) && frameBorderWidthParam >= 0 && frameBorderWidthParam <= 20 ? Math.floor(frameBorderWidthParam) : 2;
  const frameBorderColor = frameBorderColorParam && /^#[0-9A-Fa-f]{6}$/.test(frameBorderColorParam) ? frameBorderColorParam : '#ff0000';
  const frameBorderRadius = Number.isFinite(frameBorderRadiusParam) && frameBorderRadiusParam >= 0 && frameBorderRadiusParam <= 50 ? Math.floor(frameBorderRadiusParam) : 0;
  const framePadding = Number.isFinite(framePaddingParam) && framePaddingParam >= 0 && framePaddingParam <= 2 ? framePaddingParam : 0.3;
  const frameShadowBlur = Number.isFinite(frameShadowBlurParam) && frameShadowBlurParam >= 0 && frameShadowBlurParam <= 50 ? Math.floor(frameShadowBlurParam) : 0;
  const frameShadowColor = frameShadowColorParam && /^#[0-9A-Fa-f]{6}$/.test(frameShadowColorParam) ? frameShadowColorParam : '#000000';
  const frameTextColor = frameTextColorParam && /^#[0-9A-Fa-f]{6}$/.test(frameTextColorParam) ? frameTextColorParam : '#ffffff';
  const frameTextBold = frameTextBoldParam === '1' || frameTextBoldParam === 'true';
  const frameTextItalic = frameTextItalicParam === '1' || frameTextItalicParam === 'true';
  const frameTextUnderline = frameTextUnderlineParam === '1' || frameTextUnderlineParam === 'true';
  const frameTextUppercase = frameTextUppercaseParam === '1' || frameTextUppercaseParam === 'true';
  const userColor = userColorParam && /^#[0-9A-Fa-f]{6}$/.test(userColorParam) ? userColorParam : null;
  const userTextBold = userTextBoldParam === '1' || userTextBoldParam === 'true';
  const userTextItalic = userTextItalicParam === '1' || userTextItalicParam === 'true';
  const userTextUnderline = userTextUnderlineParam === '1' || userTextUnderlineParam === 'true';
  const userTextUppercase = userTextUppercaseParam === '1' || userTextUppercaseParam === 'true';

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
    if (frameBorderRadius > 0) {
      document.documentElement.style.setProperty('--frame-border-radius', `${frameBorderRadius}px`);
    }
    document.documentElement.style.setProperty('--frame-padding', `${framePadding}em`);
    if (frameShadowBlur > 0) {
      document.documentElement.style.setProperty('--frame-shadow', `inset 0 0 ${frameShadowBlur}px ${frameShadowColor}`);
    }
    document.documentElement.style.setProperty('--frame-text-color', frameTextColor);
    document.documentElement.style.setProperty('--frame-text-weight', frameTextBold ? 'bold' : 'normal');
    document.documentElement.style.setProperty('--frame-text-style', frameTextItalic ? 'italic' : 'normal');
    document.documentElement.style.setProperty('--frame-text-decoration', frameTextUnderline ? 'underline' : 'none');
    document.documentElement.style.setProperty('--frame-text-transform', frameTextUppercase ? 'uppercase' : 'none');
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

  // Expose a tiny runtime config for pages (optional)
  window.__ducchatInterface = { fontSize, limit, showStreamer, userColors, emoteRadius, stacked, msgPad, msgTimeout, frameRed, frameBgColor };

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


