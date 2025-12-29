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
        const display = (orig && renames[normUserKey(orig)]) ? renames[normUserKey(orig)] : (orig || '');
        const userEl = row.querySelector?.('.chatMsg__user');
        if (userEl && display) userEl.textContent = `${display}:`;
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
    const stacked = cfg.stacked === true;
    const msgTimeout = Number.isFinite(cfg.msgTimeout) && cfg.msgTimeout >= 0 ? cfg.msgTimeout : null;
    return { limit, userColors, stacked, msgTimeout };
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
    if (cfg.frameRed) u.searchParams.set('frameRed', '1');
    if (cfg.frameBgColor) u.searchParams.set('frameBgColor', cfg.frameBgColor);
    u.hash = '#/';
    return u.toString();
  }

  function renderMessage(m) {
    const origUser = String(m.user || 'unknown');
    const userKey = normUserKey(origUser);
    const displayUser = pseudosCfg.renames?.[userKey] || origUser;

    const row = document.createElement('div');
    row.className = 'chatMsg';
    row.dataset.userkey = userKey;
    row.dataset.origuser = origUser;

    const user = document.createElement('span');
    user.className = 'chatMsg__user';
    user.textContent = `${displayUser}:`;
    const { userColors } = getInterfaceConfig();
    if (userColors) {
      const c = String(m.userColor || '').trim();
      row.style.setProperty('--user-color', c || fallbackUserColor(origUser));
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
      { value: 'colors', label: 'Couleurs' },
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
    const frameRed = check('Cadre rouge');
    const frameBgColor = colorInput('#000000');

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
    }

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
      const { userColors } = getInterfaceConfig();
      
      const row = document.createElement('div');
      row.className = 'chatMsg';

      const user = document.createElement('span');
      user.className = 'chatMsg__user';
      user.textContent = `${userName}:`;
      if (userColors) {
        row.style.setProperty('--user-color', fallbackUserColor(userName));
      }

      const content = document.createElement('span');
      content.className = 'chatMsg__text';
      content.textContent = textContent;

      for (const emoteUrl of emotes) {
        const emote = document.createElement('img');
        emote.className = 'chatEmote';
        emote.src = emoteUrl;
        emote.alt = 'Emote';
        emote.title = 'Emote';
        emote.loading = 'lazy';
        emote.decoding = 'async';
        content.append(' ', emote);
      }

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
        'Voici un exemple de message avec des emotes',
        [
          'https://static-cdn.jtvnw.net/emoticons/v2/emotesv2_32a19dbdb8ef4e09b13a9f239ffe910d/default/dark/4.0',
          'https://static-cdn.jtvnw.net/emoticons/v2/emotesv2_72e02b2fb5af423f91f076f723034ff7/default/dark/4.0',
        ]
      );

      const row2 = createExampleRow(
        'AutreUser',
        'Un deuxième message pour voir le rendu',
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
      };

      // Apply preview + hook runtime config
      window.__ducchatInterfaceOverrides = {
        limit: cfg.limit && cfg.limit >= 1 && cfg.limit <= 500 ? Math.floor(cfg.limit) : null,
        userColors: cfg.userColors,
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

      // Apply frame red style
      if (cfg.frameRed) {
        document.body.classList.add('hasFrameRed');
        document.documentElement.style.setProperty('--frame-bg-color', cfg.frameBgColor);
      } else {
        document.body.classList.remove('hasFrameRed');
        document.documentElement.style.removeProperty('--frame-bg-color');
      }

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
      colors: document.createElement('div'),
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

    // Colors category: User colors
    const checksColors = document.createElement('div');
    checksColors.className = 'styleChecks';
    checksColors.append(userColors.label);
    categoryContainers.colors.append(checksColors);

    // Visual style category: Frame red
    const checksVisual = document.createElement('div');
    checksVisual.className = 'styleChecks';
    checksVisual.append(frameRed.label);
    const rowFrameBg = document.createElement('div');
    rowFrameBg.className = 'styleGrid__row';
    rowFrameBg.append(name('Fond'), frameBgColor, document.createElement('div'), document.createElement('div'));
    categoryContainers.visual.append(checksVisual, rowFrameBg);

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


