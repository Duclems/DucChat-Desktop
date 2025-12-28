export function HomePage() {
  const wrap = document.createElement('div');
  wrap.className = 'card';

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
    return { limit, showStreamer };
  }

  function renderMessage(m) {
    const row = document.createElement('div');
    row.className = 'chatMsg';

    const user = document.createElement('span');
    user.className = 'chatMsg__user';
    user.textContent = m.user;

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

  wrap.append(h2, meta, log);
  return wrap;
}


