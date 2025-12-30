export function HomePage() {
  const wrap = document.createElement('div');
  wrap.className = 'card';

  const isOverlay = document.body.classList.contains('isOverlay');
  const userColorCache = new Map();

  /** @type {{blocked: string[], renames: Record<string,string>}} */
  let pseudosCfg = { blocked: [], renames: {} };
  let blockedSet = new Set();

  function normUserKey(x) {
    return String(x || '').trim().toLowerCase();
  }

  function setPseudosCfg(next) {
    const cfg = next && typeof next === 'object' ? next : {};
    const blockedRaw = Array.isArray(cfg.blocked) ? cfg.blocked : [];
    const renamesRaw = cfg.renames && typeof cfg.renames === 'object' ? cfg.renames : {};

    const blocked = Array.from(
      new Set(blockedRaw.map((u) => normUserKey(u)).filter(Boolean))
    );
    const renames = {};
    for (const [k, v] of Object.entries(renamesRaw)) {
      const key = normUserKey(k);
      const val = String(v || '').trim();
      if (!key || !val) continue;
      renames[key] = val;
    }
    pseudosCfg = { blocked, renames };
    blockedSet = new Set(blocked);

    // Apply immediately to already-rendered rows
    try {
      for (const row of Array.from(log.children)) {
        const key = row?.dataset?.userkey || '';
        if (key && blockedSet.has(key)) {
          row.remove();
          continue;
        }
        const orig = row?.dataset?.origuser || '';
        let display = (orig && renames[normUserKey(orig)]) ? renames[normUserKey(orig)] : (orig || '');
        const { userCapitalizeFirst } = getInterfaceConfig();
        if (userCapitalizeFirst && display.length > 0) {
          display = display.charAt(0).toUpperCase() + display.slice(1).toLowerCase();
        }
        const userEl = row.querySelector?.('.chatMsg__user');
        if (userEl && display) userEl.textContent = `${display} :`;
      }
      // If stacked, re-measure indent after any rename changes
      if (getInterfaceConfig().stacked) {
        requestAnimationFrame(() => {
          log.querySelectorAll('.chatMsg').forEach((row) => {
            const user = row.querySelector('.chatMsg__user');
            if (!user) return;
            const w = user.getBoundingClientRect().width;
            row.style.setProperty('--user-space', `${Math.ceil(w + 10)}px`);
          });
        });
      }
    } catch {
      // ignore
    }
  }

  function loadPreviewStyle() {
    try {
      return JSON.parse(localStorage.getItem('ducchat.homeStyle') || 'null') || null;
    } catch {
      return null;
    }
  }

  function savePreviewStyle(style) {
    localStorage.setItem('ducchat.homeStyle', JSON.stringify(style));
  }

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

  const h2Container = document.createElement('div');
  h2Container.style.display = 'flex';
  h2Container.style.justifyContent = 'space-between';
  h2Container.style.alignItems = 'center';
  h2Container.style.marginBottom = 'var(--space-13)';

  const h2 = document.createElement('h2');
  h2.textContent = 'Chat Twitch';
  h2.style.margin = '0';

  const meta = document.createElement('p');
  meta.className = 'muted';
  meta.textContent = 'Aucune chaîne configurée. Va dans Settings.';

  const log = document.createElement('div');
  log.className = 'chatLog';

  const messages = [];
  const MAX_DEFAULT = 200;

  function getInterfaceConfig() {
    const base = window.__ducchatInterface || {};
    const override = (!isOverlay && window.__ducchatInterfaceOverrides) ? window.__ducchatInterfaceOverrides : {};
    const cfg = { ...base, ...override };

    const limit = Number.isFinite(cfg.limit) ? cfg.limit : MAX_DEFAULT;
    const userColors = cfg.userColors !== false;
    const userColor = cfg.userColor || null;
    const userCapitalizeFirst = cfg.userCapitalizeFirst === true;
    const stacked = cfg.stacked === true;
    const msgTimeout = Number.isFinite(cfg.msgTimeout) && cfg.msgTimeout >= 0 ? cfg.msgTimeout : null;
    return { limit, userColors, userColor, userCapitalizeFirst, stacked, msgTimeout };
  }

  // In HTTP/overlay mode we don't run the preview panel, so we must apply interface classes here.
  // Compact is always enabled by default
  log.classList.add('chatLog--compact');
  log.classList.toggle('chatLog--stacked', getInterfaceConfig().stacked);

  function applyStyleToPreview({ fontSize }) {
    if (typeof fontSize === 'number') {
      document.documentElement.style.setProperty('--chat-font-size', `${fontSize}px`);
    } else {
      document.documentElement.style.removeProperty('--chat-font-size');
    }
    // Emotes rounding
    const r = (window.__ducchatInterfaceOverrides && typeof window.__ducchatInterfaceOverrides.emoteRadius === 'number')
      ? window.__ducchatInterfaceOverrides.emoteRadius
      : null;
    if (typeof r === 'number' && r > 0) {
      document.documentElement.style.setProperty('--emote-radius', `${r}px`);
    } else {
      document.documentElement.style.removeProperty('--emote-radius');
    }
    // Message vertical padding (em)
    const p =
      window.__ducchatInterfaceOverrides && typeof window.__ducchatInterfaceOverrides.msgPad === 'number'
        ? window.__ducchatInterfaceOverrides.msgPad
        : null;
    if (typeof p === 'number' && p >= 0) {
      document.documentElement.style.setProperty('--msg-pad', `${p}em`);
    } else {
      document.documentElement.style.removeProperty('--msg-pad');
    }
    // Compact is always enabled by default
    log.classList.add('chatLog--compact');
    log.classList.toggle('chatLog--stacked', !!window.__ducchatInterfaceOverrides?.stacked);

    // Stacked mode is now handled purely by CSS, no JS needed
  }

  async function getBaseUrl() {
    // In Electron (and in our dev proxy) we expose window.ui.getUrls().
    const res = await window.ui?.getUrls?.();
    if (res?.ok && res.url) return String(res.url).replace(/\/+$/, '/');
    // Browser fallback
    return `${window.location.origin}/`;
  }

  function buildInterfaceUrl(baseUrl, cfg) {
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
      if (cfg.frameBorderRadius) u.searchParams.set('frameBorderRadius', String(cfg.frameBorderRadius));
      if (cfg.framePadding) u.searchParams.set('framePadding', String(cfg.framePadding));
      if (cfg.frameShadowBlur > 0) {
        u.searchParams.set('frameShadowBlur', String(cfg.frameShadowBlur));
        if (cfg.frameShadowColor) u.searchParams.set('frameShadowColor', cfg.frameShadowColor);
      }
      if (cfg.frameTextColor) u.searchParams.set('frameTextColor', cfg.frameTextColor);
      if (cfg.frameTextBold) u.searchParams.set('frameTextBold', '1');
      if (cfg.frameTextItalic) u.searchParams.set('frameTextItalic', '1');
      if (cfg.frameTextUnderline) u.searchParams.set('frameTextUnderline', '1');
      if (cfg.frameTextUppercase) u.searchParams.set('frameTextUppercase', '1');
      if (cfg.userColor) u.searchParams.set('userColor', cfg.userColor);
      if (cfg.userTextBold) u.searchParams.set('userTextBold', '1');
      if (cfg.userTextItalic) u.searchParams.set('userTextItalic', '1');
      if (cfg.userTextUnderline) u.searchParams.set('userTextUnderline', '1');
      if (cfg.userTextUppercase) u.searchParams.set('userTextUppercase', '1');
      if (cfg.userCapitalizeFirst) u.searchParams.set('userCapitalizeFirst', '1');
      if (cfg.mentionColor) u.searchParams.set('mentionColor', cfg.mentionColor);
      if (cfg.mentionBold) u.searchParams.set('mentionBold', '1');
      if (cfg.mentionItalic) u.searchParams.set('mentionItalic', '1');
      if (cfg.mentionUnderline) u.searchParams.set('mentionUnderline', '1');
      if (cfg.mentionUppercase) u.searchParams.set('mentionUppercase', '1');
    }
    u.hash = '#/';
    return u.toString();
  }

  function renderMessage(m) {
    const origUser = String(m.user || 'unknown');
    const userKey = normUserKey(origUser);
    let displayUser = pseudosCfg.renames?.[userKey] || origUser;
    
    // Capitalize first letter if option is enabled
    const { userCapitalizeFirst } = getInterfaceConfig();
    if (userCapitalizeFirst && displayUser.length > 0) {
      displayUser = displayUser.charAt(0).toUpperCase() + displayUser.slice(1).toLowerCase();
    }

    const row = document.createElement('div');
    row.className = 'chatMsg';
    row.dataset.userkey = userKey;
    row.dataset.origuser = origUser;

    const user = document.createElement('span');
    user.className = 'chatMsg__user';
    user.textContent = `${displayUser} :`;
    const { userColors, userColor: customUserColor } = getInterfaceConfig();
    if (userColors) {
      const c = String(m.userColor || '').trim();
      if (c) {
        // Use Twitch color if available
        row.style.setProperty('--user-color', c);
      } else if (customUserColor) {
        // Use custom color if set
        row.style.setProperty('--user-color', customUserColor);
      } else {
        // Use default title color
        row.style.removeProperty('--user-color');
      }
    } else {
      // If userColors is disabled, use custom color or default
      if (customUserColor) {
        row.style.setProperty('--user-color', customUserColor);
      } else {
        row.style.removeProperty('--user-color');
      }
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
      } else if (s?.type === 'mention' && s.username) {
        // Check if username is renamed
        const mentionKey = normUserKey(s.username);
        let displayMention = pseudosCfg.renames?.[mentionKey] || s.username;
        
        // Apply capitalization if enabled
        const { userCapitalizeFirst } = getInterfaceConfig();
        if (userCapitalizeFirst && displayMention.length > 0) {
          displayMention = displayMention.charAt(0).toUpperCase() + displayMention.slice(1).toLowerCase();
        }
        
        const mentionSpan = document.createElement('span');
        mentionSpan.className = 'chatMsg__mention';
        mentionSpan.textContent = `@${displayMention}`;
        frag.append(mentionSpan);
      }
    }
    content.append(frag);

    row.append(user, content);
    return row;
  }

  function applyTimeoutToMessage(row, msgTimeout, messageObj) {
    if (!row || !row.parentNode) return;
    
    // Clear any existing timeout
    if (row.dataset.timeoutId) {
      clearTimeout(Number(row.dataset.timeoutId));
      delete row.dataset.timeoutId;
    }
    
    // Apply timeout if configured
    if (msgTimeout !== null && msgTimeout > 0) {
      const timeoutId = setTimeout(() => {
        if (row.parentNode === log) {
          row.remove();
          // Try to find and remove from messages array if messageObj provided
          if (messageObj) {
            const idx = messages.indexOf(messageObj);
            if (idx >= 0) messages.splice(idx, 1);
          } else {
            // If no messageObj, try to find by dataset
            const userKey = row.dataset?.userkey;
            if (userKey) {
              const idx = messages.findIndex(m => normUserKey(m?.user) === userKey);
              if (idx >= 0) messages.splice(idx, 1);
            }
          }
        }
      }, msgTimeout * 1000);
      row.dataset.timeoutId = String(timeoutId);
    }
  }

  function pushMessage(m) {
    const userKey = normUserKey(m?.user);
    if (userKey && blockedSet.has(userKey)) return;

    const { limit, msgTimeout } = getInterfaceConfig();
    messages.push(m);
    if (messages.length > limit) messages.shift();
    const row = renderMessage(m);
    
    log.append(row);
    if (log.childNodes.length > limit) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
    
    // Apply timeout
    applyTimeoutToMessage(row, msgTimeout, m);
  }

  function enforceLimitNow() {
    const { limit } = getInterfaceConfig();
    while (messages.length > limit) messages.shift();
    while (log.childNodes.length > limit) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }

  async function init() {
    // Load initial pseudos config
    try {
      const r = await window.pseudos?.getConfig?.();
      if (r?.ok && r.config) setPseudosCfg(r.config);
    } catch {
      // ignore
    }

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
        es.addEventListener('config', (ev) => {
          try {
            const c = JSON.parse(ev.data);
            setPseudosCfg(c);
          } catch {
            // ignore
          }
        });
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
      pushMessage(m);
    });
  }

  if (window.pseudos?.onConfig) {
    window.pseudos.onConfig((nextCfg) => setPseudosCfg(nextCfg));
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
  if (!isOverlay) {
    // Preview controls (only in app mode)
    const panel = document.createElement('div');
    panel.className = 'stylePanel';

    const panelTitle = document.createElement('div');
    panelTitle.className = 'stylePanel__title';
    panelTitle.textContent = 'Style (preview + URL interface)';

    // Category selector
    const categorySelect = document.createElement('select');
    categorySelect.className = 'styleCategorySelect';
    const categories = [
      { value: 'display', label: 'Affichage' },
      { value: 'messages', label: 'Messages' },
      { value: 'emotes', label: 'Emotes' },
      { value: 'visual', label: 'Style visuel' },
    ];
    categories.forEach((cat) => {
      const option = document.createElement('option');
      option.value = cat.value;
      option.textContent = cat.label;
      categorySelect.append(option);
    });
    categorySelect.value = 'display';

    const grid = document.createElement('div');
    grid.className = 'styleGrid';

    const name = (labelText) => {
      const s = document.createElement('div');
      s.className = 'urlLabel';
      s.textContent = labelText;
      return s;
    };

    const numInput = (placeholder, min, max) => {
      const i = document.createElement('input');
      i.className = 'textInput';
      i.type = 'number';
      if (min != null) i.min = String(min);
      if (max != null) i.max = String(max);
      i.placeholder = placeholder;
      return i;
    };

    const check = (text) => {
      const label = document.createElement('label');
      label.className = 'checkRow';
      const input = document.createElement('input');
      input.type = 'checkbox';
      const span = document.createElement('span');
      span.textContent = text;
      label.append(input, span);
      return { label, input };
    };

    const colorInput = (defaultValue) => {
      const i = document.createElement('input');
      i.className = 'textInput';
      i.type = 'color';
      i.value = defaultValue || '#000000';
      return i;
    };

    const font = numInput('18', 8, 72);
    const limit = numInput('100', 1, 500);
    const msgPad = numInput('0.20', 0, 1);
    msgPad.step = '0.01';
    const emoteRadius = numInput('0', 0, 50);
    const msgTimeout = numInput('0', 0, 300);
    msgTimeout.step = '1';
    const userColors = check('Couleurs Twitch (fallback si vide)');
    const roundEmotes = check('Arrondir les emotes');
    const stacked = check('Message sous le pseudo');
    const frameRed = check('Activer CSS');
    const frameBgColor = colorInput('#000000');
    const frameBorderWidth = numInput('2', 0, 20);
    frameBorderWidth.step = '1';
    const frameBorderColor = colorInput('#ff0000');
    const frameBorderRadius = numInput('0', 0, 50);
    frameBorderRadius.step = '1';
    const framePadding = numInput('0.3', 0, 2);
    framePadding.step = '0.1';
    const frameShadowBlur = numInput('0', 0, 50);
    frameShadowBlur.step = '1';
    const frameShadowColor = colorInput('#000000');
    const frameTextColor = colorInput('#ffffff');
    const frameTextBold = check('Gras');
    const frameTextItalic = check('Italique');
    const frameTextUnderline = check('Souligné');
    const frameTextUppercase = check('Majuscules');
    const userTextBold = check('Gras');
    const userTextItalic = check('Italique');
    const userTextUnderline = check('Souligné');
    const userTextUppercase = check('Majuscules');
    const userCapitalizeFirst = check('Première lettre en majuscule');
    const userColor = colorInput('#e5e5e4');
    const mentionColor = colorInput('#9146ff');
    const mentionBold = check('Gras');
    const mentionItalic = check('Italique');
    const mentionUnderline = check('Souligné');
    const mentionUppercase = check('Majuscules');

    userColors.input.checked = true;

    const saved = loadPreviewStyle();
    if (saved) {
      if (typeof saved.fontSize === 'number') font.value = String(saved.fontSize);
      if (typeof saved.limit === 'number') limit.value = String(saved.limit);
      if (typeof saved.msgPad === 'number') msgPad.value = String(saved.msgPad);
      if (typeof saved.emoteRadius === 'number') emoteRadius.value = String(saved.emoteRadius);
      if (typeof saved.msgTimeout === 'number') msgTimeout.value = String(saved.msgTimeout);
      if (typeof saved.userColors === 'boolean') userColors.input.checked = saved.userColors;
      if (typeof saved.roundEmotes === 'boolean') roundEmotes.input.checked = saved.roundEmotes;
      if (typeof saved.stacked === 'boolean') stacked.input.checked = saved.stacked;
      if (typeof saved.frameRed === 'boolean') frameRed.input.checked = saved.frameRed;
      if (typeof saved.frameBgColor === 'string') frameBgColor.value = saved.frameBgColor;
      if (typeof saved.frameBorderWidth === 'number') frameBorderWidth.value = String(saved.frameBorderWidth);
      if (typeof saved.frameBorderColor === 'string') frameBorderColor.value = saved.frameBorderColor;
      if (typeof saved.frameBorderRadius === 'number') frameBorderRadius.value = String(saved.frameBorderRadius);
      if (typeof saved.framePadding === 'number') framePadding.value = String(saved.framePadding);
      if (typeof saved.frameShadowBlur === 'number') frameShadowBlur.value = String(saved.frameShadowBlur);
      if (typeof saved.frameShadowColor === 'string') frameShadowColor.value = saved.frameShadowColor;
      if (typeof saved.frameTextColor === 'string') frameTextColor.value = saved.frameTextColor;
      if (typeof saved.frameTextBold === 'boolean') frameTextBold.input.checked = saved.frameTextBold;
      if (typeof saved.frameTextItalic === 'boolean') frameTextItalic.input.checked = saved.frameTextItalic;
      if (typeof saved.frameTextUnderline === 'boolean') frameTextUnderline.input.checked = saved.frameTextUnderline;
      if (typeof saved.frameTextUppercase === 'boolean') frameTextUppercase.input.checked = saved.frameTextUppercase;
      if (typeof saved.userColor === 'string') userColor.value = saved.userColor;
      if (typeof saved.userCapitalizeFirst === 'boolean') userCapitalizeFirst.input.checked = saved.userCapitalizeFirst;
      if (typeof saved.mentionColor === 'string') mentionColor.value = saved.mentionColor;
      if (typeof saved.mentionBold === 'boolean') mentionBold.input.checked = saved.mentionBold;
      if (typeof saved.mentionItalic === 'boolean') mentionItalic.input.checked = saved.mentionItalic;
      if (typeof saved.mentionUnderline === 'boolean') mentionUnderline.input.checked = saved.mentionUnderline;
      if (typeof saved.mentionUppercase === 'boolean') mentionUppercase.input.checked = saved.mentionUppercase;
      if (typeof saved.userTextBold === 'boolean') userTextBold.input.checked = saved.userTextBold;
      if (typeof saved.userTextItalic === 'boolean') userTextItalic.input.checked = saved.userTextItalic;
      if (typeof saved.userTextUnderline === 'boolean') userTextUnderline.input.checked = saved.userTextUnderline;
      if (typeof saved.userTextUppercase === 'boolean') userTextUppercase.input.checked = saved.userTextUppercase;
    }
    
    // Apply initial mention styles (always enabled)
    document.documentElement.style.setProperty('--mention-color', mentionColor.value || '#9146ff');
    document.documentElement.style.setProperty('--mention-weight', mentionBold.input.checked ? 'bold' : 'normal');
    document.documentElement.style.setProperty('--mention-style', mentionItalic.input.checked ? 'italic' : 'normal');
    document.documentElement.style.setProperty('--mention-decoration', mentionUnderline.input.checked ? 'underline' : 'none');
    document.documentElement.style.setProperty('--mention-transform', mentionUppercase.input.checked ? 'uppercase' : 'none');

    const urlRow = document.createElement('div');
    urlRow.className = 'urlRow urlRow--wide';
    const urlLabel = document.createElement('span');
    urlLabel.className = 'urlLabel';
    urlLabel.textContent = 'URL';
    const urlInput = document.createElement('input');
    urlInput.className = 'textInput';
    urlInput.readOnly = true;
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn--ghost';
    copyBtn.type = 'button';
    copyBtn.textContent = 'Copier';
    urlRow.append(urlLabel, urlInput, copyBtn);

    // Example preview of message rendering
    const exampleWrap = document.createElement('div');
    exampleWrap.className = 'examplePreview';
    const exampleLabelRow = document.createElement('div');
    exampleLabelRow.style.display = 'flex';
    exampleLabelRow.style.justifyContent = 'space-between';
    exampleLabelRow.style.alignItems = 'center';
    exampleLabelRow.style.marginBottom = 'var(--space-8)';
    const exampleLabel = document.createElement('div');
    exampleLabel.className = 'examplePreview__label';
    exampleLabel.textContent = 'Exemple de rendu:';
    const testBtn = document.createElement('button');
    testBtn.className = 'btn btn--ghost';
    testBtn.type = 'button';
    testBtn.textContent = 'Test';
    testBtn.style.fontSize = '12px';
    testBtn.style.padding = '0.3em 0.8em';
    exampleLabelRow.append(exampleLabel, testBtn);
    const exampleLog = document.createElement('div');
    exampleLog.className = 'chatLog examplePreview__log';
    exampleLog.style.height = 'auto';
    exampleLog.style.maxHeight = '120px';
    exampleLog.style.marginTop = 'var(--space-8)';

    function createExampleRow(userName, textContent, emotes = []) {
      const { userColors, userColor: customUserColor, userCapitalizeFirst } = getInterfaceConfig();
      
      let displayName = userName;
      if (userCapitalizeFirst && displayName.length > 0) {
        displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1).toLowerCase();
      }
      
      const row = document.createElement('div');
      row.className = 'chatMsg';

      const user = document.createElement('span');
      user.className = 'chatMsg__user';
      user.textContent = `${displayName} :`;
      if (userColors) {
        // In example, simulate Twitch color with random color
        row.style.setProperty('--user-color', fallbackUserColor(userName));
      } else if (customUserColor) {
        row.style.setProperty('--user-color', customUserColor);
      } else {
        row.style.removeProperty('--user-color');
      }

      const content = document.createElement('span');
      content.className = 'chatMsg__text';
      
      // Parse mentions in example text (before emotes)
      const mentionRegex = /(@[a-zA-Z0-9_]+)/g;
      const parts = textContent.split(mentionRegex);
      const frag = document.createDocumentFragment();
      for (const part of parts) {
        if (part.startsWith('@')) {
          const mentionName = part.slice(1);
          const mentionSpan = document.createElement('span');
          mentionSpan.className = 'chatMsg__mention';
          mentionSpan.textContent = part;
          frag.append(mentionSpan);
        } else if (part) {
          frag.append(document.createTextNode(part));
        }
      }
      
      // Add emotes after text
      for (const emoteUrl of emotes) {
        const emote = document.createElement('img');
        emote.className = 'chatEmote';
        emote.src = emoteUrl;
        emote.alt = 'Emote';
        emote.title = 'Emote';
        emote.loading = 'lazy';
        emote.decoding = 'async';
        frag.append(' ', emote);
      }
      
      content.append(frag);

      row.append(user, content);
      return row;
    }

    function renderExampleMessage() {
      exampleLog.replaceChildren();
      
      // Apply same CSS classes as the real chat log
      const { stacked } = getInterfaceConfig();
      // Compact is always enabled by default
      exampleLog.classList.add('chatLog--compact');
      exampleLog.classList.toggle('chatLog--stacked', !!stacked);
      
      const row1 = createExampleRow(
        'ExempleUser',
        'Voici un exemple de message avec @AutreUser et des emotes',
        [
          'https://static-cdn.jtvnw.net/emoticons/v2/emotesv2_32a19dbdb8ef4e09b13a9f239ffe910d/default/dark/4.0',
          'https://static-cdn.jtvnw.net/emoticons/v2/emotesv2_72e02b2fb5af423f91f076f723034ff7/default/dark/4.0',
        ]
      );

      const row2 = createExampleRow(
        'AutreUser',
        'Un deuxième message avec @ExempleUser pour voir le rendu',
        [
          'https://static-cdn.jtvnw.net/emoticons/v2/emotesv2_eb49980ac4ea4585a7a0a7e5ae291fd7/default/dark/4.0',
        ]
      );

      exampleLog.append(row1, row2);

      // Stacked mode is now handled purely by CSS, no JS needed
    }

    const update = async () => {
      const cfg = {
        fontSize: Number(font.value) || null,
        limit: Number(limit.value) || null,
        msgPad: Number(msgPad.value),
        emoteRadius: Number(emoteRadius.value) || 0,
        msgTimeout: Number(msgTimeout.value) || 0,
        roundEmotes: !!roundEmotes.input.checked,
        userColors: !!userColors.input.checked,
        compact: true, // Always compact by default
        stacked: !!stacked.input.checked,
        frameRed: !!frameRed.input.checked,
        frameBgColor: frameBgColor.value || '#000000',
        frameBorderWidth: Number(frameBorderWidth.value) || 2,
        frameBorderColor: frameBorderColor.value || '#ff0000',
        frameBorderRadius: Number(frameBorderRadius.value) || 0,
        framePadding: Number(framePadding.value) || 0.3,
        frameShadowBlur: Number(frameShadowBlur.value) || 0,
        frameShadowColor: frameShadowColor.value || '#000000',
        frameTextColor: frameTextColor.value || '#ffffff',
        frameTextBold: !!frameTextBold.input.checked,
        frameTextItalic: !!frameTextItalic.input.checked,
        frameTextUnderline: !!frameTextUnderline.input.checked,
        frameTextUppercase: !!frameTextUppercase.input.checked,
        userColor: userColor.value || '#e5e5e4',
        userTextBold: !!userTextBold.input.checked,
        userTextItalic: !!userTextItalic.input.checked,
        userTextUnderline: !!userTextUnderline.input.checked,
        userTextUppercase: !!userTextUppercase.input.checked,
        userCapitalizeFirst: !!userCapitalizeFirst.input.checked,
        mentionColor: mentionColor.value || '#9146ff',
        mentionBold: !!mentionBold.input.checked,
        mentionItalic: !!mentionItalic.input.checked,
        mentionUnderline: !!mentionUnderline.input.checked,
        mentionUppercase: !!mentionUppercase.input.checked,
      };

      // Apply preview + hook runtime config
      window.__ducchatInterfaceOverrides = {
        limit: cfg.limit && cfg.limit >= 1 && cfg.limit <= 500 ? Math.floor(cfg.limit) : null,
        userColors: cfg.userColors,
        userColor: cfg.userColor,
        userCapitalizeFirst: cfg.userCapitalizeFirst,
        msgPad: Number.isFinite(cfg.msgPad) && cfg.msgPad >= 0 && cfg.msgPad <= 1 ? cfg.msgPad : null,
        emoteRadius:
          cfg.roundEmotes && cfg.emoteRadius >= 0 && cfg.emoteRadius <= 50 ? Math.floor(cfg.emoteRadius) : 0,
        stacked: cfg.stacked,
        msgTimeout: Number.isFinite(cfg.msgTimeout) && cfg.msgTimeout >= 0 && cfg.msgTimeout <= 300 ? cfg.msgTimeout : null,
      };
      // Apply limit immediately (no need to wait for a new message)
      enforceLimitNow();
      
      // Apply timeout to existing messages if timeout changed
      const { msgTimeout: newTimeout } = getInterfaceConfig();
      Array.from(log.children).forEach((row) => {
        applyTimeoutToMessage(row, newTimeout, null);
      });
      
      applyStyleToPreview({
        fontSize: cfg.fontSize && cfg.fontSize >= 8 && cfg.fontSize <= 72 ? Math.floor(cfg.fontSize) : null,
      });

      // Apply custom CSS (frame + background color)
      if (cfg.frameRed) {
        document.body.classList.add('hasFrameRed');
        document.documentElement.style.setProperty('--frame-bg-color', cfg.frameBgColor);
        document.documentElement.style.setProperty('--frame-border-width', `${cfg.frameBorderWidth}px`);
        document.documentElement.style.setProperty('--frame-border-color', cfg.frameBorderColor);
        if (cfg.frameBorderRadius > 0) {
          document.documentElement.style.setProperty('--frame-border-radius', `${cfg.frameBorderRadius}px`);
        } else {
          document.documentElement.style.removeProperty('--frame-border-radius');
        }
        document.documentElement.style.setProperty('--frame-padding', `${cfg.framePadding}em`);
        if (cfg.frameShadowBlur > 0) {
          const shadowColor = cfg.frameShadowColor || '#000000';
          document.documentElement.style.setProperty('--frame-shadow', `inset 0 0 ${cfg.frameShadowBlur}px ${shadowColor}`);
        } else {
          document.documentElement.style.removeProperty('--frame-shadow');
        }
        document.documentElement.style.setProperty('--frame-text-color', cfg.frameTextColor);
        document.documentElement.style.setProperty('--frame-text-weight', cfg.frameTextBold ? 'bold' : 'normal');
        document.documentElement.style.setProperty('--frame-text-style', cfg.frameTextItalic ? 'italic' : 'normal');
        document.documentElement.style.setProperty('--frame-text-decoration', cfg.frameTextUnderline ? 'underline' : 'none');
        document.documentElement.style.setProperty('--frame-text-transform', cfg.frameTextUppercase ? 'uppercase' : 'none');
      }
      
      // Apply user (pseudo) styles
      if (cfg.userColor) {
        document.documentElement.style.setProperty('--user-default-color', cfg.userColor);
      } else {
        document.documentElement.style.removeProperty('--user-default-color');
      }
      document.documentElement.style.setProperty('--user-text-weight', cfg.userTextBold ? 'bold' : 'normal');
      document.documentElement.style.setProperty('--user-text-style', cfg.userTextItalic ? 'italic' : 'normal');
      document.documentElement.style.setProperty('--user-text-decoration', cfg.userTextUnderline ? 'underline' : 'none');
      document.documentElement.style.setProperty('--user-text-transform', cfg.userTextUppercase ? 'uppercase' : 'none');
      
      // Apply mention styles (always enabled)
      document.documentElement.style.setProperty('--mention-color', cfg.mentionColor || '#9146ff');
      document.documentElement.style.setProperty('--mention-weight', cfg.mentionBold ? 'bold' : 'normal');
      document.documentElement.style.setProperty('--mention-style', cfg.mentionItalic ? 'italic' : 'normal');
      document.documentElement.style.setProperty('--mention-decoration', cfg.mentionUnderline ? 'underline' : 'none');
      document.documentElement.style.setProperty('--mention-transform', cfg.mentionUppercase ? 'uppercase' : 'none');
      
      if (!cfg.frameRed) {
        document.body.classList.remove('hasFrameRed');
        document.documentElement.style.removeProperty('--frame-bg-color');
        document.documentElement.style.removeProperty('--frame-border-width');
        document.documentElement.style.removeProperty('--frame-padding');
        document.documentElement.style.removeProperty('--frame-border-color');
        document.documentElement.style.removeProperty('--frame-border-radius');
        document.documentElement.style.removeProperty('--frame-shadow');
        document.documentElement.style.removeProperty('--frame-text-color');
        document.documentElement.style.removeProperty('--frame-text-weight');
        document.documentElement.style.removeProperty('--frame-text-style');
        document.documentElement.style.removeProperty('--frame-text-decoration');
        document.documentElement.style.removeProperty('--frame-text-transform');
      }
      
      // Update existing messages' capitalization
      const { userCapitalizeFirst: newCapitalizeFirst } = getInterfaceConfig();
      Array.from(log.querySelectorAll('.chatMsg__user')).forEach((userEl) => {
        const currentText = userEl.textContent || '';
        // Remove colon and space to get the username
        const username = currentText.replace(/ :$/, '');
        if (username.length > 0) {
          const capitalized = username.charAt(0).toUpperCase() + username.slice(1).toLowerCase();
          const original = userEl.closest('.chatMsg')?.dataset?.origuser || username;
          const userKey = normUserKey(original);
          const renamed = pseudosCfg.renames?.[userKey] || original;
          let displayName = renamed;
          if (newCapitalizeFirst) {
            displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1).toLowerCase();
          }
          userEl.textContent = `${displayName} :`;
        }
      });
      
      savePreviewStyle({
        fontSize: cfg.fontSize ? Math.floor(cfg.fontSize) : null,
        limit: cfg.limit ? Math.floor(cfg.limit) : null,
        msgPad: Number.isFinite(cfg.msgPad) && cfg.msgPad >= 0 && cfg.msgPad <= 1 ? cfg.msgPad : null,
        emoteRadius: cfg.emoteRadius ? Math.floor(cfg.emoteRadius) : 0,
        msgTimeout: cfg.msgTimeout ? cfg.msgTimeout : 0,
        roundEmotes: cfg.roundEmotes,
        userColors: cfg.userColors,
        stacked: cfg.stacked,
        frameRed: cfg.frameRed,
        frameBgColor: cfg.frameBgColor,
        frameBorderWidth: cfg.frameBorderWidth,
        frameBorderColor: cfg.frameBorderColor,
        frameBorderRadius: cfg.frameBorderRadius,
        framePadding: cfg.framePadding,
        frameShadowBlur: cfg.frameShadowBlur,
        frameShadowColor: cfg.frameShadowColor,
        frameTextColor: cfg.frameTextColor,
        frameTextBold: cfg.frameTextBold,
        frameTextItalic: cfg.frameTextItalic,
        frameTextUnderline: cfg.frameTextUnderline,
        frameTextUppercase: cfg.frameTextUppercase,
        userColor: cfg.userColor,
        userTextBold: cfg.userTextBold,
        userTextItalic: cfg.userTextItalic,
        userTextUnderline: cfg.userTextUnderline,
        userTextUppercase: cfg.userTextUppercase,
        userCapitalizeFirst: cfg.userCapitalizeFirst,
        mentionColor: cfg.mentionColor,
        mentionBold: cfg.mentionBold,
        mentionItalic: cfg.mentionItalic,
        mentionUnderline: cfg.mentionUnderline,
        mentionUppercase: cfg.mentionUppercase,
      });

      const baseUrl = await getBaseUrl();
      urlInput.value = buildInterfaceUrl(baseUrl, cfg);
      
      // Update example preview
      renderExampleMessage();
    };

    const inputs = [
      font,
      limit,
      msgPad,
      msgTimeout,
      emoteRadius,
      userColors.input,
      roundEmotes.input,
      stacked.input,
      frameRed.input,
      frameBgColor,
      frameBorderWidth,
      frameBorderColor,
      frameBorderRadius,
      framePadding,
      frameShadowBlur,
      frameShadowColor,
      frameTextColor,
      frameTextBold.input,
      frameTextItalic.input,
      frameTextUnderline.input,
      frameTextUppercase.input,
      userColor,
      userTextBold.input,
      userTextItalic.input,
      userTextUnderline.input,
      userTextUppercase.input,
      userCapitalizeFirst.input,
      mentionColor,
      mentionBold.input,
      mentionItalic.input,
      mentionUnderline.input,
      mentionUppercase.input,
    ];
    inputs.forEach((el) => el.addEventListener('input', () => update()));
    inputs.forEach((el) => el.addEventListener('change', () => update()));

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(urlInput.value);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = urlInput.value;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
    });

    // Category containers
    const categoryContainers = {
      display: document.createElement('div'),
      messages: document.createElement('div'),
      emotes: document.createElement('div'),
      visual: document.createElement('div'),
    };

    // Display category: Font, Limit, Pad
    const row1 = document.createElement('div');
    row1.className = 'styleGrid__row';
    row1.append(name('Font'), font, name('Limit'), limit);
    const rowPad = document.createElement('div');
    rowPad.className = 'styleGrid__row';
    rowPad.append(name('Pad'), msgPad, document.createElement('div'), document.createElement('div'));
    categoryContainers.display.append(row1, rowPad);

    // Messages category: Timeout, Stacked
    const rowTimeout = document.createElement('div');
    rowTimeout.className = 'styleGrid__row';
    rowTimeout.append(name('Timeout (s)'), msgTimeout, document.createElement('div'), document.createElement('div'));
    const checksMessages = document.createElement('div');
    checksMessages.className = 'styleChecks';
    checksMessages.append(stacked.label);
    categoryContainers.messages.append(rowTimeout, checksMessages);

    // Emotes category: Emote radius, Round emotes
    const rowEmotes = document.createElement('div');
    rowEmotes.className = 'styleGrid__row';
    rowEmotes.append(name('Emote'), emoteRadius, roundEmotes.label, document.createElement('div'));
    categoryContainers.emotes.append(rowEmotes);


    // Visual style category: Custom CSS
    const checksVisual = document.createElement('div');
    checksVisual.className = 'styleChecks';
    checksVisual.append(frameRed.label);
    
    // Select for visual style sections
    const visualSectionSelect = document.createElement('select');
    visualSectionSelect.className = 'styleCategorySelect';
    visualSectionSelect.style.marginTop = 'var(--space-13)';
    const visualSections = [
      { value: 'border', label: 'Bordure' },
      { value: 'bg', label: 'Fond' },
      { value: 'shadow', label: 'Ombre intérieure' },
      { value: 'text', label: 'Texte' },
      { value: 'user', label: 'Pseudonyme' },
      { value: 'mention', label: 'Citation' },
    ];
    visualSections.forEach((sec) => {
      const option = document.createElement('option');
      option.value = sec.value;
      option.textContent = sec.label;
      visualSectionSelect.append(option);
    });
    visualSectionSelect.value = 'border';
    
    // Container for visual style sections
    const visualSectionsContainer = document.createElement('div');
    visualSectionsContainer.className = 'visualSectionsContainer';
    
    // Section: Bordure
    const sectionBorder = document.createElement('div');
    sectionBorder.className = 'styleSection';
    const sectionBorderTitle = document.createElement('div');
    sectionBorderTitle.className = 'styleSection__title';
    sectionBorderTitle.textContent = 'Bordure';
    const rowFrameBorder = document.createElement('div');
    rowFrameBorder.className = 'styleGrid__row';
    rowFrameBorder.append(name('Épaisseur'), frameBorderWidth, name('Couleur bordure'), frameBorderColor);
    const rowFrameRadius = document.createElement('div');
    rowFrameRadius.className = 'styleGrid__row';
    rowFrameRadius.append(name('Rayon'), frameBorderRadius, name('Padding'), framePadding);
    sectionBorder.append(sectionBorderTitle, rowFrameBorder, rowFrameRadius);
    
    // Section: Fond
    const sectionBg = document.createElement('div');
    sectionBg.className = 'styleSection';
    const sectionBgTitle = document.createElement('div');
    sectionBgTitle.className = 'styleSection__title';
    sectionBgTitle.textContent = 'Fond';
    const rowFrameBg = document.createElement('div');
    rowFrameBg.className = 'styleGrid__row';
    rowFrameBg.append(name('Couleur'), frameBgColor, document.createElement('div'), document.createElement('div'));
    sectionBg.append(sectionBgTitle, rowFrameBg);
    
    // Section: Ombre
    const sectionShadow = document.createElement('div');
    sectionShadow.className = 'styleSection';
    const sectionShadowTitle = document.createElement('div');
    sectionShadowTitle.className = 'styleSection__title';
    sectionShadowTitle.textContent = 'Ombre intérieure';
    const rowFrameShadow = document.createElement('div');
    rowFrameShadow.className = 'styleGrid__row';
    rowFrameShadow.append(name('Blur'), frameShadowBlur, name('Couleur'), frameShadowColor);
    sectionShadow.append(sectionShadowTitle, rowFrameShadow);
    
    // Section: Texte
    const sectionText = document.createElement('div');
    sectionText.className = 'styleSection';
    const sectionTextTitle = document.createElement('div');
    sectionTextTitle.className = 'styleSection__title';
    sectionTextTitle.textContent = 'Texte';
    const rowFrameText = document.createElement('div');
    rowFrameText.className = 'styleGrid__row';
    rowFrameText.append(name('Couleur'), frameTextColor, document.createElement('div'), document.createElement('div'));
    const checksTextStyle = document.createElement('div');
    checksTextStyle.className = 'styleChecks';
    checksTextStyle.append(frameTextBold.label, frameTextItalic.label, frameTextUnderline.label, frameTextUppercase.label);
    sectionText.append(sectionTextTitle, rowFrameText, checksTextStyle);
    
    // Section: Pseudonyme
    const sectionUser = document.createElement('div');
    sectionUser.className = 'styleSection';
    const sectionUserTitle = document.createElement('div');
    sectionUserTitle.className = 'styleSection__title';
    sectionUserTitle.textContent = 'Pseudonyme';
    const checksUserColors = document.createElement('div');
    checksUserColors.className = 'styleChecks';
    checksUserColors.append(userColors.label);
    const rowUserColor = document.createElement('div');
    rowUserColor.className = 'styleGrid__row';
    rowUserColor.append(name('Couleur'), userColor, document.createElement('div'), document.createElement('div'));
    const checksUserStyle = document.createElement('div');
    checksUserStyle.className = 'styleChecks';
    checksUserStyle.append(userTextBold.label, userTextItalic.label, userTextUnderline.label, userTextUppercase.label);
    const checksUserCapitalize = document.createElement('div');
    checksUserCapitalize.className = 'styleChecks';
    checksUserCapitalize.append(userCapitalizeFirst.label);
    sectionUser.append(sectionUserTitle, checksUserColors, rowUserColor, checksUserStyle, checksUserCapitalize);
    
    // Section: Citation
    const sectionMention = document.createElement('div');
    sectionMention.className = 'styleSection';
    sectionMention.dataset.visualSection = 'mention';
    const sectionMentionTitle = document.createElement('div');
    sectionMentionTitle.className = 'styleSection__title';
    sectionMentionTitle.textContent = 'Citation';
    const rowMentionColor = document.createElement('div');
    rowMentionColor.className = 'styleGrid__row';
    rowMentionColor.append(name('Couleur'), mentionColor, document.createElement('div'), document.createElement('div'));
    const checksMentionStyle = document.createElement('div');
    checksMentionStyle.className = 'styleChecks';
    checksMentionStyle.append(mentionBold.label, mentionItalic.label, mentionUnderline.label, mentionUppercase.label);
    sectionMention.append(sectionMentionTitle, rowMentionColor, checksMentionStyle);
    
    // Add data attributes to sections for selection
    sectionBorder.dataset.visualSection = 'border';
    sectionBg.dataset.visualSection = 'bg';
    sectionShadow.dataset.visualSection = 'shadow';
    sectionText.dataset.visualSection = 'text';
    sectionUser.dataset.visualSection = 'user';
    
    // Add sections to container
    visualSectionsContainer.append(sectionBorder, sectionBg, sectionShadow, sectionText, sectionUser, sectionMention);
    
    // Show/hide visual sections based on selection
    function showVisualSection(sectionValue) {
      visualSectionsContainer.querySelectorAll('[data-visual-section]').forEach((section) => {
        section.style.display = section.dataset.visualSection === sectionValue ? 'block' : 'none';
      });
    }
    showVisualSection('border');
    visualSectionSelect.addEventListener('change', () => showVisualSection(visualSectionSelect.value));
    
    categoryContainers.visual.append(checksVisual, visualSectionSelect, visualSectionsContainer);

    // Show/hide categories based on selection
    function showCategory(categoryValue) {
      Object.entries(categoryContainers).forEach(([key, container]) => {
        container.style.display = key === categoryValue ? 'block' : 'none';
      });
    }
    showCategory('display');
    categorySelect.addEventListener('change', () => showCategory(categorySelect.value));

    // Append all category containers to grid
    Object.values(categoryContainers).forEach((container) => {
      grid.append(container);
    });

    panel.append(panelTitle, categorySelect, grid);

    renderExampleMessage();

    // Tabs to switch between live chat and examples
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'chatTabs';
    
    const tabLive = document.createElement('button');
    tabLive.className = 'chatTabs__tab chatTabs__tab--active';
    tabLive.type = 'button';
    tabLive.textContent = 'Chat en direct';
    
    const tabExample = document.createElement('button');
    tabExample.className = 'chatTabs__tab';
    tabExample.type = 'button';
    tabExample.textContent = 'Exemples';
    
    const contentContainer = document.createElement('div');
    contentContainer.className = 'chatTabs__content';
    
    // Initially show live chat
    log.style.display = 'flex';
    exampleWrap.style.display = 'none';
    
    tabLive.addEventListener('click', () => {
      tabLive.classList.add('chatTabs__tab--active');
      tabExample.classList.remove('chatTabs__tab--active');
      log.style.display = 'flex';
      exampleWrap.style.display = 'none';
    });
    
    tabExample.addEventListener('click', () => {
      tabExample.classList.add('chatTabs__tab--active');
      tabLive.classList.remove('chatTabs__tab--active');
      log.style.display = 'none';
      exampleWrap.style.display = 'block';
    });
    
    tabsContainer.append(tabLive, tabExample);
    contentContainer.append(log, exampleWrap);
    
    // Add URL to the right of h2
    h2Container.append(h2, urlRow);
    
    wrap.append(h2Container, meta, panel, tabsContainer, contentContainer);
    exampleWrap.append(exampleLabelRow, exampleLog);
    
    // Test button functionality
    testBtn.addEventListener('click', () => {
      const { msgTimeout } = getInterfaceConfig();
      const testRow = createExampleRow(
        'TestUser',
        'Message de test avec timeout',
        [
          'https://static-cdn.jtvnw.net/emoticons/v2/emotesv2_32a19dbdb8ef4e09b13a9f239ffe910d/default/dark/4.0',
        ]
      );
      
      exampleLog.append(testRow);
      
      // Apply timeout if configured
      if (msgTimeout !== null && msgTimeout > 0) {
        setTimeout(() => {
          if (testRow.parentNode === exampleLog) {
            testRow.remove();
          }
        }, msgTimeout * 1000);
      }
      
      // Scroll to bottom
      exampleLog.scrollTop = exampleLog.scrollHeight;
    });
    
    // Initialize once
    update().catch(() => {});
  } else {
    // In overlay mode, just show the log
    wrap.append(log);
  }
  return wrap;
}


