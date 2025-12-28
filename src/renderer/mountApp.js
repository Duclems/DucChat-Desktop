import { AppShell } from './ui/AppShell';
import { createHashRouter } from './router/createHashRouter';
import { HomePage } from './pages/HomePage';
import { SettingsPage } from './pages/SettingsPage';
import { InterfacePage } from './pages/InterfacePage';
import { StylePage } from './pages/StylePage';

export function mountApp() {
  const root = document.getElementById('app');
  if (!root) throw new Error('Missing #app element in index.html');

  const params = new URL(window.location.href).searchParams;
  const isOverlay = params.get('overlay') === '1';
  const isTransparent = params.get('transparent') === '1';
  const isCompact = params.get('compact') === '1';
  const fontSizeParam = Number(params.get('fontSize'));
  const limitParam = Number(params.get('limit'));
  const showStreamerParam = params.get('showStreamer');
  const userColorsParam = params.get('userColors');

  document.body.classList.toggle('isOverlay', isOverlay);
  document.body.classList.toggle('isTransparent', isTransparent);
  document.body.classList.toggle('isCompact', isCompact);

  const fontSize = Number.isFinite(fontSizeParam) && fontSizeParam >= 8 && fontSizeParam <= 72 ? fontSizeParam : null;
  const limit = Number.isFinite(limitParam) && limitParam >= 1 && limitParam <= 500 ? Math.floor(limitParam) : null;
  const showStreamer = showStreamerParam === null ? true : showStreamerParam === '1' || showStreamerParam === 'true';
  const userColors = userColorsParam === null ? true : userColorsParam === '1' || userColorsParam === 'true';

  // Load persisted chat style (works for app and HTTP interface)
  try {
    const applyObj = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string' && v) {
          document.documentElement.style.setProperty(k, v);
        }
      }
    };

    // Chat-only style
    applyObj(JSON.parse(localStorage.getItem('ducchat.chatStyle') || '{}'));

    // Cleanup: older global style key could override app background/theme.
    // The "Style" page now targets chat only, so we remove the legacy key.
    const legacy = localStorage.getItem('ducchat.style');
    if (legacy) {
      const legacyObj = JSON.parse(legacy || '{}');
      const legacyKeys = [
        '--bg',
        '--surface',
        '--surface-2',
        '--text',
        '--title',
        '--muted',
        '--border',
        '--primary',
        '--primary-2',
      ];
      for (const k of legacyKeys) {
        if (legacyObj && typeof legacyObj === 'object' && k in legacyObj) {
          document.documentElement.style.removeProperty(k);
        }
      }
      localStorage.removeItem('ducchat.style');
    }
  } catch {
    // ignore
  }

  if (fontSize) {
    document.documentElement.style.setProperty('--chat-font-size', `${fontSize}px`);
  }

  // Expose a tiny runtime config for pages (optional)
  window.__ducchatInterface = { fontSize, limit, showStreamer, userColors };

  const outlet = document.createElement('div');

  const router = createHashRouter({
    routes: {
      '/': HomePage,
      '/settings': SettingsPage,
      '/interface': InterfacePage,
      '/style': StylePage,
    },
    outlet,
  });

  root.replaceChildren(AppShell({ outlet, router, isOverlay }));
  router.start();
}


