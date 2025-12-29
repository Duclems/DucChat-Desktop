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

  if (fontSize) {
    document.documentElement.style.setProperty('--chat-font-size', `${fontSize}px`);
  }
  if (emoteRadius) {
    document.documentElement.style.setProperty('--emote-radius', `${emoteRadius}px`);
  }
  if (msgPad !== null) {
    document.documentElement.style.setProperty('--msg-pad', `${msgPad}em`);
  }

  // Expose a tiny runtime config for pages (optional)
  window.__ducchatInterface = { fontSize, limit, showStreamer, userColors, emoteRadius, stacked, msgPad };

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


