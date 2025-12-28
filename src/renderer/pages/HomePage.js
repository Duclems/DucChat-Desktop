export function HomePage() {
  const wrap = document.createElement('div');
  wrap.className = 'card';

  const isOverlay = document.body.classList.contains('isOverlay');
  const userColorCache = new Map();

  function hashString(str) {
    // Fast deterministic hash (FNV-1a)
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function fallbackUserColor(user) {
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

  const h2 = document.createElement('h2');
  h2.textContent = 'Chat Twitch';

  const meta = document.createElement('p');
  meta.className = 'muted';
  meta.textContent = 'Aucune chaîne configurée. Va dans Settings.';

  const log = document.createElement('div');
  log.className = 'chatLog';

  const messages = [];
  const MAX_DEFAULT = 200;

  function getInterfaceConfig() {
    const cfg = window.__ducchatInterface || {};
    const limit = Number.isFinite(cfg.limit) ? cfg.limit : MAX_DEFAULT;
    const showStreamer = cfg.showStreamer !== false;
    const userColors = cfg.userColors !== false;
    return { limit, showStreamer, userColors };
  }

  function renderMessage(m) {
    const row = document.createElement('div');
    row.className = 'chatMsg';

    const user = document.createElement('span');
    user.className = 'chatMsg__user';
    user.textContent = `${m.user}:`;
    const { userColors } = getInterfaceConfig();
    if (userColors) {
      const c = String(m.userColor || '').trim();
      row.style.setProperty('--user-color', c || fallbackUserColor(m.user));
    }

    const content = document.createElement('span');
    content.className = 'chatMsg__text';

    const frag = document.createDocumentFragment();
    const segs = Array.isArray(m.segments) ? m.segments : [{ type: 'text', text: m.message }];
    for (const s of segs) {
      if (s?.type === 'text') {
        frag.append(document.createTextNode(s.text || ''));
      } else if (s?.type === 'emote' && s.url) {
        const img = document.createElement('img');
        img.className = 'chatEmote';
        img.src = s.url;
        img.alt = s.alt || s.name || 'emote';
        img.title = s.name || s.alt || '';
        img.loading = 'lazy';
        img.decoding = 'async';
        frag.append(img);
      }
    }
    content.append(frag);

    row.append(user, content);
    return row;
  }

  function pushMessage(m) {
    const { limit } = getInterfaceConfig();
    messages.push(m);
    if (messages.length > limit) messages.shift();
    log.append(renderMessage(m));
    if (log.childNodes.length > limit) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }

  async function init() {
    const ch = await window.twitch?.getChannel?.();
    if (ch) {
      meta.textContent = `Chaîne: ${ch}`;
      return;
    }

    // Browser/OBS fallback (no preload): subscribe to SSE
    if (!window.twitch?.onMessage) {
      try {
        const es = new EventSource('/api/stream');
        meta.textContent = 'Connexion interface…';
        es.addEventListener('status', (ev) => {
          try {
            const s = JSON.parse(ev.data);
            if (s?.state === 'connected') meta.textContent = `Chaîne: ${s.channel}`;
            else if (s?.state === 'connecting') meta.textContent = `Connexion à ${s.channel}...`;
            else if (s?.state === 'reconnecting') meta.textContent = `Reconnexion à ${s.channel}...`;
            else meta.textContent = 'Déconnecté (va dans Settings)';
          } catch {
            // ignore
          }
        });
        es.addEventListener('message', (ev) => {
          try {
            const m = JSON.parse(ev.data);
            const { showStreamer } = getInterfaceConfig();
            if (!showStreamer && m.isBroadcaster) return;
            pushMessage(m);
          } catch {
            // ignore
          }
        });
        es.addEventListener('error', () => {
          meta.textContent = 'Interface: impossible de se connecter au flux.';
        });
        return;
      } catch {
        // ignore
      }
    }

    meta.textContent = 'Aucune chaîne configurée. Va dans Settings.';
  }

  if (window.twitch?.onMessage) {
    window.twitch.onMessage((m) => {
      if (!m) return;
      const { showStreamer } = getInterfaceConfig();
      if (!showStreamer && m.isBroadcaster) return;
      pushMessage(m);
    });
  }

  if (window.twitch?.onStatus) {
    window.twitch.onStatus((s) => {
      if (!s?.state) return;
      if (s.state === 'connected') meta.textContent = `Chaîne: ${s.channel}`;
      else if (s.state === 'connecting') meta.textContent = `Connexion à ${s.channel}...`;
      else if (s.state === 'reconnecting') meta.textContent = `Reconnexion à ${s.channel}...`;
      else if (s.state === 'disconnected') meta.textContent = 'Déconnecté (va dans Settings)';
    });
  }

  init().catch(() => {});

  // For custom HTTP interfaces (overlay), render ONLY the chat messages.
  if (!isOverlay) wrap.append(h2, meta);
  wrap.append(log);
  return wrap;
}


