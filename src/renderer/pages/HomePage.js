import { renderMessage } from '../components/MessageRenderer';
import { createChatLog, applyTimeoutToMessage } from '../components/ChatLog';
import { createExamplePreview, createExampleRow } from '../components/ExamplePreview';
import { normUserKey, fallbackUserColor } from '../utils/messageUtils';
import { getInterfaceConfig, loadPreviewStyle, savePreviewStyle } from '../utils/styleUtils';
import { buildInterfaceUrl } from '../utils/urlBuilder';

export function HomePage() {
  const wrap = document.createElement('div');
  wrap.className = 'card';

  const isOverlay = document.body.classList.contains('isOverlay');
  const userColorCache = new Map();

  /** @type {{blocked: string[], renames: Record<string,string>}} */
  let pseudosCfg = { blocked: [], renames: {} };
  let blockedSet = new Set();

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

  const log = createChatLog();
  const messages = [];

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

  function renderMessageLocal(m) {
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
    
    // Check if we need to capitalize first letter of first word
    const { frameTextCapitalizeFirst } = getInterfaceConfig();
    let foundFirstLetter = false;
    
    for (const s of segs) {
      if (s?.type === 'text') {
        let text = s.text || '';
        // Capitalize first letter of first word if option is enabled and we haven't found it yet
        if (frameTextCapitalizeFirst && !foundFirstLetter && text.length > 0) {
          // Find the first letter (skip whitespace and non-alphabetic characters)
          const firstLetterIndex = text.search(/[a-zA-Z]/);
          if (firstLetterIndex !== -1) {
            text = text.slice(0, firstLetterIndex) + text.charAt(firstLetterIndex).toUpperCase() + text.slice(firstLetterIndex + 1);
            foundFirstLetter = true;
          }
        }
        frag.append(document.createTextNode(text));
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

  function applyTimeoutToMessageLocal(row, msgTimeout, messageObj) {
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
    const row = renderMessage(m, pseudosCfg, userColorCache);
    
    log.append(row);
    if (log.childNodes.length > limit) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
    
    // Apply timeout
    applyTimeoutToMessageLocal(row, msgTimeout, m);
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
      { value: 'layout', label: 'Position' },
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

    const fontSelect = (defaultValue) => {
      const container = document.createElement('div');
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '0.5em';
      container.style.width = '100%';
      
      const select = document.createElement('select');
      select.className = 'textInput';
      const fonts = [
        { value: '', label: 'Par défaut' },
        // Polices génériques
        { value: 'serif', label: 'Serif (générique)' },
        { value: 'sans-serif', label: 'Sans-serif (générique)' },
        { value: 'monospace', label: 'Monospace (générique)' },
        { value: 'cursive', label: 'Cursive (générique)' },
        { value: 'fantasy', label: 'Fantasy (générique)' },
        // Polices Windows standard
        { value: 'Arial', label: 'Arial' },
        { value: 'Arial Black', label: 'Arial Black' },
        { value: 'Arial Narrow', label: 'Arial Narrow' },
        { value: 'Arial Rounded MT Bold', label: 'Arial Rounded MT Bold' },
        { value: 'Bahnschrift', label: 'Bahnschrift' },
        { value: 'Calibri', label: 'Calibri' },
        { value: 'Cambria', label: 'Cambria' },
        { value: 'Cambria Math', label: 'Cambria Math' },
        { value: 'Candara', label: 'Candara' },
        { value: 'Comic Sans MS', label: 'Comic Sans MS' },
        { value: 'Consolas', label: 'Consolas' },
        { value: 'Constantia', label: 'Constantia' },
        { value: 'Corbel', label: 'Corbel' },
        { value: 'Courier New', label: 'Courier New' },
        { value: 'Ebrima', label: 'Ebrima' },
        { value: 'Franklin Gothic Medium', label: 'Franklin Gothic Medium' },
        { value: 'Gabriola', label: 'Gabriola' },
        { value: 'Gadugi', label: 'Gadugi' },
        { value: 'Georgia', label: 'Georgia' },
        { value: 'HoloLens MDL2 Assets', label: 'HoloLens MDL2 Assets' },
        { value: 'Impact', label: 'Impact' },
        { value: 'Ink Free', label: 'Ink Free' },
        { value: 'Javanese Text', label: 'Javanese Text' },
        { value: 'Leelawadee UI', label: 'Leelawadee UI' },
        { value: 'Lucida Console', label: 'Lucida Console' },
        { value: 'Lucida Sans Unicode', label: 'Lucida Sans Unicode' },
        { value: 'Malgun Gothic', label: 'Malgun Gothic' },
        { value: 'Marlett', label: 'Marlett' },
        { value: 'Microsoft Himalaya', label: 'Microsoft Himalaya' },
        { value: 'Microsoft JhengHei', label: 'Microsoft JhengHei' },
        { value: 'Microsoft JhengHei UI', label: 'Microsoft JhengHei UI' },
        { value: 'Microsoft New Tai Lue', label: 'Microsoft New Tai Lue' },
        { value: 'Microsoft PhagsPa', label: 'Microsoft PhagsPa' },
        { value: 'Microsoft Sans Serif', label: 'Microsoft Sans Serif' },
        { value: 'Microsoft Tai Le', label: 'Microsoft Tai Le' },
        { value: 'Microsoft YaHei', label: 'Microsoft YaHei' },
        { value: 'Microsoft YaHei UI', label: 'Microsoft YaHei UI' },
        { value: 'Microsoft Yi Baiti', label: 'Microsoft Yi Baiti' },
        { value: 'MingLiU-ExtB', label: 'MingLiU-ExtB' },
        { value: 'Mongolian Baiti', label: 'Mongolian Baiti' },
        { value: 'MS Gothic', label: 'MS Gothic' },
        { value: 'MS PGothic', label: 'MS PGothic' },
        { value: 'MS UI Gothic', label: 'MS UI Gothic' },
        { value: 'MV Boli', label: 'MV Boli' },
        { value: 'Myanmar Text', label: 'Myanmar Text' },
        { value: 'Nirmala UI', label: 'Nirmala UI' },
        { value: 'Palatino Linotype', label: 'Palatino Linotype' },
        { value: 'Segoe MDL2 Assets', label: 'Segoe MDL2 Assets' },
        { value: 'Segoe Print', label: 'Segoe Print' },
        { value: 'Segoe Script', label: 'Segoe Script' },
        { value: 'Segoe UI', label: 'Segoe UI' },
        { value: 'Segoe UI Black', label: 'Segoe UI Black' },
        { value: 'Segoe UI Emoji', label: 'Segoe UI Emoji' },
        { value: 'Segoe UI Historic', label: 'Segoe UI Historic' },
        { value: 'Segoe UI Symbol', label: 'Segoe UI Symbol' },
        { value: 'SimSun', label: 'SimSun' },
        { value: 'Sitka', label: 'Sitka' },
        { value: 'Sylfaen', label: 'Sylfaen' },
        { value: 'Symbol', label: 'Symbol' },
        { value: 'Tahoma', label: 'Tahoma' },
        { value: 'Times New Roman', label: 'Times New Roman' },
        { value: 'Trebuchet MS', label: 'Trebuchet MS' },
        { value: 'Verdana', label: 'Verdana' },
        { value: 'Webdings', label: 'Webdings' },
        { value: 'Wingdings', label: 'Wingdings' },
        { value: 'Yu Gothic', label: 'Yu Gothic' },
        { value: 'Yu Gothic UI', label: 'Yu Gothic UI' },
        // Polices additionnelles courantes
        { value: 'Book Antiqua', label: 'Book Antiqua' },
        { value: 'Bookman Old Style', label: 'Bookman Old Style' },
        { value: 'Century Gothic', label: 'Century Gothic' },
        { value: 'Century Schoolbook', label: 'Century Schoolbook' },
        { value: 'Copperplate Gothic', label: 'Copperplate Gothic' },
        { value: 'Courier', label: 'Courier' },
        { value: 'Garamond', label: 'Garamond' },
        { value: 'Helvetica', label: 'Helvetica' },
        { value: 'Lucida Bright', label: 'Lucida Bright' },
        { value: 'Lucida Fax', label: 'Lucida Fax' },
        { value: 'Lucida Handwriting', label: 'Lucida Handwriting' },
        { value: 'Lucida Sans', label: 'Lucida Sans' },
        { value: 'Palatino', label: 'Palatino' },
        { value: 'Perpetua', label: 'Perpetua' },
        { value: 'Rockwell', label: 'Rockwell' },
        { value: 'Tahoma', label: 'Tahoma' },
        { value: 'Tempus Sans ITC', label: 'Tempus Sans ITC' },
        { value: '__CUSTOM__', label: 'Personnalisée...' },
      ];
      fonts.forEach((font) => {
        const option = document.createElement('option');
        option.value = font.value;
        option.textContent = font.label;
        if (font.value === defaultValue) option.selected = true;
        select.append(option);
      });
      
      const customInput = document.createElement('input');
      customInput.className = 'textInput';
      customInput.type = 'text';
      customInput.placeholder = 'Nom de la police personnalisée';
      customInput.style.display = 'none';
      
      // Vérifier si la valeur par défaut est une police personnalisée (pas dans la liste)
      const isDefaultCustom = defaultValue && !fonts.some(f => f.value === defaultValue && f.value !== '__CUSTOM__');
      if (isDefaultCustom) {
        select.value = '__CUSTOM__';
        customInput.value = defaultValue;
        customInput.style.display = 'block';
      }
      
      select.addEventListener('change', () => {
        if (select.value === '__CUSTOM__') {
          customInput.style.display = 'block';
          customInput.focus();
        } else {
          customInput.style.display = 'none';
          customInput.value = '';
        }
      });
      
      container.append(select, customInput);
      
      // Retourner un objet avec les éléments nécessaires
      return {
        container,
        select,
        customInput,
        getValue: () => {
          if (select.value === '__CUSTOM__') {
            return customInput.value.trim() || '';
          }
          return select.value;
        },
        setValue: (value) => {
          const isCustom = value && !fonts.some(f => f.value === value && f.value !== '__CUSTOM__');
          if (isCustom) {
            select.value = '__CUSTOM__';
            customInput.value = value;
            customInput.style.display = 'block';
          } else {
            select.value = value || '';
            customInput.style.display = 'none';
            customInput.value = '';
          }
        }
      };
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
    const frameBorderWidth = numInput('0', 0, 20);
    frameBorderWidth.step = '1';
    const frameBorderColor = colorInput('#ff0000');
    const frameBorderRadiusTopLeft = numInput('0', 0, 50);
    frameBorderRadiusTopLeft.step = '1';
    const frameBorderRadiusTopRight = numInput('0', 0, 50);
    frameBorderRadiusTopRight.step = '1';
    const frameBorderRadiusBottomRight = numInput('0', 0, 50);
    frameBorderRadiusBottomRight.step = '1';
    const frameBorderRadiusBottomLeft = numInput('0', 0, 50);
    frameBorderRadiusBottomLeft.step = '1';
    const framePadding = numInput('0.3', 0, 2);
    framePadding.step = '0.1';
    const frameShadowBlur = numInput('0', 0, 50);
    frameShadowBlur.step = '1';
    const frameShadowColor = colorInput('#000000');
    const frameShadowOpacity = numInput('100', 0, 100);
    frameShadowOpacity.step = '1';
    const frameTextColor = colorInput('#ffffff');
    const frameTextFont = fontSelect('');
    const frameTextBold = check('Gras');
    const frameTextItalic = check('Italique');
    const frameTextUnderline = check('Souligné');
    const frameTextUppercase = check('Majuscules');
    const frameTextCapitalizeFirst = check('Première lettre en majuscule');
    const userTextBold = check('Gras');
    const userTextItalic = check('Italique');
    const userTextUnderline = check('Souligné');
    const userTextUppercase = check('Majuscules');
    const userCapitalizeFirst = check('Première lettre en majuscule');
    const userColor = colorInput('#e5e5e4');
    const userFont = fontSelect('');
    const mentionColor = colorInput('#9146ff');
    const mentionFont = fontSelect('');
    const mentionBold = check('Gras');
    const mentionItalic = check('Italique');
    const mentionUnderline = check('Souligné');
    const mentionUppercase = check('Majuscules');
    
    // Layout options
    const msgWidthType = document.createElement('select');
    msgWidthType.className = 'textInput';
    const optionAuto = document.createElement('option');
    optionAuto.value = 'auto';
    optionAuto.textContent = 'Adapter au texte';
    const optionFixed = document.createElement('option');
    optionFixed.value = 'fixed';
    optionFixed.textContent = 'Fixe';
    msgWidthType.append(optionAuto, optionFixed);
    msgWidthType.value = 'auto';
    
    const msgWidthValue = numInput('300', 50, 2000);
    msgWidthValue.step = '10';
    msgWidthValue.style.display = 'none'; // Hidden by default (only show when fixed is selected)
    
    const msgAlign = document.createElement('select');
    msgAlign.className = 'textInput';
    const optionLeft = document.createElement('option');
    optionLeft.value = 'left';
    optionLeft.textContent = 'À gauche';
    const optionCenter = document.createElement('option');
    optionCenter.value = 'center';
    optionCenter.textContent = 'Centrer';
    const optionRight = document.createElement('option');
    optionRight.value = 'right';
    optionRight.textContent = 'À droite';
    msgAlign.append(optionLeft, optionCenter, optionRight);
    msgAlign.value = 'left';

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
      if (typeof saved.frameBorderRadiusTopLeft === 'number') frameBorderRadiusTopLeft.value = String(saved.frameBorderRadiusTopLeft);
      if (typeof saved.frameBorderRadiusTopRight === 'number') frameBorderRadiusTopRight.value = String(saved.frameBorderRadiusTopRight);
      if (typeof saved.frameBorderRadiusBottomRight === 'number') frameBorderRadiusBottomRight.value = String(saved.frameBorderRadiusBottomRight);
      if (typeof saved.frameBorderRadiusBottomLeft === 'number') frameBorderRadiusBottomLeft.value = String(saved.frameBorderRadiusBottomLeft);
      // Compatibilité avec l'ancien format (un seul rayon pour tous les coins)
      if (typeof saved.frameBorderRadius === 'number' && typeof saved.frameBorderRadiusTopLeft === 'undefined') {
        const radius = saved.frameBorderRadius;
        frameBorderRadiusTopLeft.value = String(radius);
        frameBorderRadiusTopRight.value = String(radius);
        frameBorderRadiusBottomRight.value = String(radius);
        frameBorderRadiusBottomLeft.value = String(radius);
      }
      if (typeof saved.framePadding === 'number') framePadding.value = String(saved.framePadding);
      if (typeof saved.frameShadowBlur === 'number') frameShadowBlur.value = String(saved.frameShadowBlur);
      if (typeof saved.frameShadowColor === 'string') frameShadowColor.value = saved.frameShadowColor;
      if (typeof saved.frameShadowOpacity === 'number') frameShadowOpacity.value = String(saved.frameShadowOpacity);
      if (typeof saved.frameTextColor === 'string') frameTextColor.value = saved.frameTextColor;
      if (typeof saved.frameTextFont === 'string') frameTextFont.setValue(saved.frameTextFont);
      if (typeof saved.frameTextBold === 'boolean') frameTextBold.input.checked = saved.frameTextBold;
      if (typeof saved.frameTextItalic === 'boolean') frameTextItalic.input.checked = saved.frameTextItalic;
      if (typeof saved.frameTextUnderline === 'boolean') frameTextUnderline.input.checked = saved.frameTextUnderline;
      if (typeof saved.frameTextUppercase === 'boolean') frameTextUppercase.input.checked = saved.frameTextUppercase;
      if (typeof saved.frameTextCapitalizeFirst === 'boolean') frameTextCapitalizeFirst.input.checked = saved.frameTextCapitalizeFirst;
      if (typeof saved.userColor === 'string') userColor.value = saved.userColor;
      if (typeof saved.userFont === 'string') userFont.setValue(saved.userFont);
      if (typeof saved.userCapitalizeFirst === 'boolean') userCapitalizeFirst.input.checked = saved.userCapitalizeFirst;
      if (typeof saved.mentionColor === 'string') mentionColor.value = saved.mentionColor;
      if (typeof saved.mentionFont === 'string') mentionFont.setValue(saved.mentionFont);
      if (typeof saved.mentionBold === 'boolean') mentionBold.input.checked = saved.mentionBold;
      if (typeof saved.mentionItalic === 'boolean') mentionItalic.input.checked = saved.mentionItalic;
      if (typeof saved.mentionUnderline === 'boolean') mentionUnderline.input.checked = saved.mentionUnderline;
      if (typeof saved.mentionUppercase === 'boolean') mentionUppercase.input.checked = saved.mentionUppercase;
      if (typeof saved.msgWidthType === 'string') msgWidthType.value = saved.msgWidthType;
      if (typeof saved.msgWidthValue === 'number') msgWidthValue.value = String(saved.msgWidthValue);
      if (typeof saved.msgAlign === 'string') msgAlign.value = saved.msgAlign;
      // Show/hide width value input based on saved width type
      msgWidthValue.style.display = msgWidthType.value === 'fixed' ? 'block' : 'none';
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
    const { container: exampleWrap, log: exampleLog, testBtn } = createExamplePreview();


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
        ],
        userColorCache
      );

      const row2 = createExampleRow(
        'AutreUser',
        'Un deuxième message avec @ExempleUser pour voir le rendu',
        [
          'https://static-cdn.jtvnw.net/emoticons/v2/emotesv2_eb49980ac4ea4585a7a0a7e5ae291fd7/default/dark/4.0',
        ],
        userColorCache
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
        frameBorderWidth: Number(frameBorderWidth.value) || 0,
        frameBorderColor: frameBorderColor.value || '#ff0000',
        frameBorderRadiusTopLeft: Number(frameBorderRadiusTopLeft.value) || 0,
        frameBorderRadiusTopRight: Number(frameBorderRadiusTopRight.value) || 0,
        frameBorderRadiusBottomRight: Number(frameBorderRadiusBottomRight.value) || 0,
        frameBorderRadiusBottomLeft: Number(frameBorderRadiusBottomLeft.value) || 0,
        framePadding: Number(framePadding.value) || 0.3,
        frameShadowBlur: Number(frameShadowBlur.value) || 0,
        frameShadowColor: frameShadowColor.value || '#000000',
        frameShadowOpacity: Number(frameShadowOpacity.value) || 100,
        frameTextColor: frameTextColor.value || '#ffffff',
        frameTextFont: frameTextFont.getValue() || '',
        frameTextBold: !!frameTextBold.input.checked,
        frameTextItalic: !!frameTextItalic.input.checked,
        frameTextUnderline: !!frameTextUnderline.input.checked,
        frameTextUppercase: !!frameTextUppercase.input.checked,
        frameTextCapitalizeFirst: !!frameTextCapitalizeFirst.input.checked,
        userColor: userColor.value || '#e5e5e4',
        userFont: userFont.getValue() || '',
        userTextBold: !!userTextBold.input.checked,
        userTextItalic: !!userTextItalic.input.checked,
        userTextUnderline: !!userTextUnderline.input.checked,
        userTextUppercase: !!userTextUppercase.input.checked,
        userCapitalizeFirst: !!userCapitalizeFirst.input.checked,
        mentionColor: mentionColor.value || '#9146ff',
        mentionFont: mentionFont.getValue() || '',
        mentionBold: !!mentionBold.input.checked,
        mentionItalic: !!mentionItalic.input.checked,
        mentionUnderline: !!mentionUnderline.input.checked,
        mentionUppercase: !!mentionUppercase.input.checked,
        msgWidthType: msgWidthType.value || 'auto',
        msgWidthValue: Number(msgWidthValue.value) || 300,
        msgAlign: msgAlign.value || 'left',
      };

      // Apply preview + hook runtime config
      window.__ducchatInterfaceOverrides = {
        limit: cfg.limit && cfg.limit >= 1 && cfg.limit <= 500 ? Math.floor(cfg.limit) : null,
        userColors: cfg.userColors,
        userColor: cfg.userColor,
        userCapitalizeFirst: cfg.userCapitalizeFirst,
        frameTextCapitalizeFirst: cfg.frameTextCapitalizeFirst,
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
        const topLeft = cfg.frameBorderRadiusTopLeft || 0;
        const topRight = cfg.frameBorderRadiusTopRight || 0;
        const bottomRight = cfg.frameBorderRadiusBottomRight || 0;
        const bottomLeft = cfg.frameBorderRadiusBottomLeft || 0;
        if (topLeft > 0 || topRight > 0 || bottomRight > 0 || bottomLeft > 0) {
          const borderRadius = `${topLeft}px ${topRight}px ${bottomRight}px ${bottomLeft}px`;
          document.documentElement.style.setProperty('--frame-border-radius', borderRadius);
        } else {
          document.documentElement.style.removeProperty('--frame-border-radius');
        }
        document.documentElement.style.setProperty('--frame-padding', `${cfg.framePadding}em`);
        if (cfg.frameShadowBlur > 0) {
          const shadowColor = cfg.frameShadowColor || '#000000';
          const opacity = (cfg.frameShadowOpacity !== undefined ? cfg.frameShadowOpacity : 100) / 100;
          // Convert hex to rgba
          const hex = shadowColor.replace('#', '');
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          const rgbaColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
          document.documentElement.style.setProperty('--frame-shadow', `inset 0 0 ${cfg.frameShadowBlur}px ${rgbaColor}`);
        } else {
          document.documentElement.style.removeProperty('--frame-shadow');
        }
        document.documentElement.style.setProperty('--frame-text-color', cfg.frameTextColor);
        document.documentElement.style.setProperty('--frame-text-weight', cfg.frameTextBold ? 'bold' : 'normal');
        document.documentElement.style.setProperty('--frame-text-style', cfg.frameTextItalic ? 'italic' : 'normal');
        document.documentElement.style.setProperty('--frame-text-decoration', cfg.frameTextUnderline ? 'underline' : 'none');
        document.documentElement.style.setProperty('--frame-text-transform', cfg.frameTextUppercase ? 'uppercase' : 'none');
        if (cfg.frameTextFont) {
          document.documentElement.style.setProperty('--frame-text-font-family', cfg.frameTextFont);
        } else {
          document.documentElement.style.removeProperty('--frame-text-font-family');
        }
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
      if (cfg.userFont) {
        document.documentElement.style.setProperty('--user-font-family', cfg.userFont);
      } else {
        document.documentElement.style.removeProperty('--user-font-family');
      }
      
      // Apply mention styles (always enabled)
      document.documentElement.style.setProperty('--mention-color', cfg.mentionColor || '#9146ff');
      document.documentElement.style.setProperty('--mention-weight', cfg.mentionBold ? 'bold' : 'normal');
      document.documentElement.style.setProperty('--mention-style', cfg.mentionItalic ? 'italic' : 'normal');
      document.documentElement.style.setProperty('--mention-decoration', cfg.mentionUnderline ? 'underline' : 'none');
      document.documentElement.style.setProperty('--mention-transform', cfg.mentionUppercase ? 'uppercase' : 'none');
      if (cfg.mentionFont) {
        document.documentElement.style.setProperty('--mention-font-family', cfg.mentionFont);
      } else {
        document.documentElement.style.removeProperty('--mention-font-family');
      }
      
      // Apply layout styles (width and alignment)
      if (cfg.msgWidthType === 'fixed') {
        document.documentElement.style.setProperty('--msg-width', `${cfg.msgWidthValue}px`);
      } else {
        document.documentElement.style.setProperty('--msg-width', 'auto');
      }
      document.documentElement.style.setProperty('--msg-align', cfg.msgAlign || 'left');
      
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
      
      // Update existing messages' user capitalization
      const { userCapitalizeFirst: newCapitalizeFirst } = getInterfaceConfig();
      Array.from(log.querySelectorAll('.chatMsg__user')).forEach((userEl) => {
        const currentText = userEl.textContent || '';
        // Remove colon and space to get the username
        const username = currentText.replace(/ :$/, '');
        if (username.length > 0) {
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
      
      // Update existing messages' text capitalization
      const { frameTextCapitalizeFirst: newTextCapitalizeFirst } = getInterfaceConfig();
      Array.from(log.querySelectorAll('.chatMsg__text')).forEach((textEl) => {
        // Get all text nodes and mentions/emotes
        const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT, null);
        let foundFirstLetter = false;
        const textNodes = [];
        while (walker.nextNode()) {
          textNodes.push(walker.currentNode);
        }
        
        for (const textNode of textNodes) {
          if (newTextCapitalizeFirst && !foundFirstLetter && textNode.textContent) {
            const text = textNode.textContent;
            const firstLetterIndex = text.search(/[a-zA-Z]/);
            if (firstLetterIndex !== -1) {
              textNode.textContent = text.slice(0, firstLetterIndex) + text.charAt(firstLetterIndex).toUpperCase() + text.slice(firstLetterIndex + 1);
              foundFirstLetter = true;
            }
          }
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
        frameBorderRadiusTopLeft: cfg.frameBorderRadiusTopLeft,
        frameBorderRadiusTopRight: cfg.frameBorderRadiusTopRight,
        frameBorderRadiusBottomRight: cfg.frameBorderRadiusBottomRight,
        frameBorderRadiusBottomLeft: cfg.frameBorderRadiusBottomLeft,
        framePadding: cfg.framePadding,
        frameShadowBlur: cfg.frameShadowBlur,
        frameShadowColor: cfg.frameShadowColor,
        frameShadowOpacity: cfg.frameShadowOpacity,
        frameTextColor: cfg.frameTextColor,
        frameTextBold: cfg.frameTextBold,
        frameTextItalic: cfg.frameTextItalic,
        frameTextUnderline: cfg.frameTextUnderline,
        frameTextUppercase: cfg.frameTextUppercase,
        frameTextCapitalizeFirst: cfg.frameTextCapitalizeFirst,
        frameTextFont: cfg.frameTextFont,
        userColor: cfg.userColor,
        userTextBold: cfg.userTextBold,
        userTextItalic: cfg.userTextItalic,
        userTextUnderline: cfg.userTextUnderline,
        userTextUppercase: cfg.userTextUppercase,
        userCapitalizeFirst: cfg.userCapitalizeFirst,
        userFont: cfg.userFont,
        mentionColor: cfg.mentionColor,
        mentionBold: cfg.mentionBold,
        mentionItalic: cfg.mentionItalic,
        mentionUnderline: cfg.mentionUnderline,
        mentionUppercase: cfg.mentionUppercase,
        mentionFont: cfg.mentionFont,
        msgWidthType: cfg.msgWidthType,
        msgWidthValue: cfg.msgWidthValue,
        msgAlign: cfg.msgAlign,
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
      frameBorderRadiusTopLeft,
      frameBorderRadiusTopRight,
      frameBorderRadiusBottomRight,
      frameBorderRadiusBottomLeft,
      framePadding,
      frameShadowBlur,
      frameShadowColor,
      frameShadowOpacity,
      frameTextColor,
      frameTextFont.select,
      frameTextFont.customInput,
      frameTextBold.input,
      frameTextItalic.input,
      frameTextUnderline.input,
      frameTextUppercase.input,
      frameTextCapitalizeFirst.input,
      userColor,
      userFont.select,
      userFont.customInput,
      userTextBold.input,
      userTextItalic.input,
      userTextUnderline.input,
      userTextUppercase.input,
      userCapitalizeFirst.input,
      mentionColor,
      mentionFont.select,
      mentionFont.customInput,
      mentionBold.input,
      mentionItalic.input,
      mentionUnderline.input,
      mentionUppercase.input,
      msgWidthType,
      msgWidthValue,
      msgAlign,
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
      layout: document.createElement('div'),
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

    // Layout category: Width type, Width value, Align
    const rowWidthType = document.createElement('div');
    rowWidthType.className = 'styleGrid__row';
    rowWidthType.append(name('Largeur'), msgWidthType, document.createElement('div'), document.createElement('div'));
    const rowWidthValue = document.createElement('div');
    rowWidthValue.className = 'styleGrid__row';
    rowWidthValue.append(name('Largeur (px)'), msgWidthValue, document.createElement('div'), document.createElement('div'));
    const rowAlign = document.createElement('div');
    rowAlign.className = 'styleGrid__row';
    rowAlign.append(name('Alignement'), msgAlign, document.createElement('div'), document.createElement('div'));
    categoryContainers.layout.append(rowWidthType, rowWidthValue, rowAlign);
    
    // Show/hide width value input based on width type
    msgWidthType.addEventListener('change', () => {
      msgWidthValue.style.display = msgWidthType.value === 'fixed' ? 'block' : 'none';
    });

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
    const rowFrameRadiusTop = document.createElement('div');
    rowFrameRadiusTop.className = 'styleGrid__row';
    rowFrameRadiusTop.append(name('Haut gauche'), frameBorderRadiusTopLeft, name('Haut droit'), frameBorderRadiusTopRight);
    const rowFrameRadiusBottom = document.createElement('div');
    rowFrameRadiusBottom.className = 'styleGrid__row';
    rowFrameRadiusBottom.append(name('Bas droit'), frameBorderRadiusBottomRight, name('Bas gauche'), frameBorderRadiusBottomLeft);
    const rowFramePadding = document.createElement('div');
    rowFramePadding.className = 'styleGrid__row';
    rowFramePadding.append(name('Padding'), framePadding, document.createElement('div'), document.createElement('div'));
    sectionBorder.append(sectionBorderTitle, rowFrameBorder, rowFrameRadiusTop, rowFrameRadiusBottom, rowFramePadding);
    
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
    const rowFrameShadowOpacity = document.createElement('div');
    rowFrameShadowOpacity.className = 'styleGrid__row';
    rowFrameShadowOpacity.append(name('Opacité (%)'), frameShadowOpacity, document.createElement('div'), document.createElement('div'));
    sectionShadow.append(sectionShadowTitle, rowFrameShadow, rowFrameShadowOpacity);
    
    // Section: Texte
    const sectionText = document.createElement('div');
    sectionText.className = 'styleSection';
    const sectionTextTitle = document.createElement('div');
    sectionTextTitle.className = 'styleSection__title';
    sectionTextTitle.textContent = 'Texte';
    const rowFrameText = document.createElement('div');
    rowFrameText.className = 'styleGrid__row';
    rowFrameText.append(name('Couleur'), frameTextColor, document.createElement('div'), document.createElement('div'));
    const rowFrameTextFont = document.createElement('div');
    rowFrameTextFont.className = 'styleGrid__row';
    rowFrameTextFont.append(name('Police'), frameTextFont.container, document.createElement('div'), document.createElement('div'));
    const checksTextStyle = document.createElement('div');
    checksTextStyle.className = 'styleChecks';
    checksTextStyle.append(frameTextBold.label, frameTextItalic.label, frameTextUnderline.label, frameTextUppercase.label);
    const checksTextCapitalize = document.createElement('div');
    checksTextCapitalize.className = 'styleChecks';
    checksTextCapitalize.append(frameTextCapitalizeFirst.label);
    sectionText.append(sectionTextTitle, rowFrameText, rowFrameTextFont, checksTextStyle, checksTextCapitalize);
    
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
    const rowUserFont = document.createElement('div');
    rowUserFont.className = 'styleGrid__row';
    rowUserFont.append(name('Police'), userFont.container, document.createElement('div'), document.createElement('div'));
    const checksUserStyle = document.createElement('div');
    checksUserStyle.className = 'styleChecks';
    checksUserStyle.append(userTextBold.label, userTextItalic.label, userTextUnderline.label, userTextUppercase.label);
    const checksUserCapitalize = document.createElement('div');
    checksUserCapitalize.className = 'styleChecks';
    checksUserCapitalize.append(userCapitalizeFirst.label);
    sectionUser.append(sectionUserTitle, checksUserColors, rowUserColor, rowUserFont, checksUserStyle, checksUserCapitalize);
    
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
    const rowMentionFont = document.createElement('div');
    rowMentionFont.className = 'styleGrid__row';
    rowMentionFont.append(name('Police'), mentionFont.container, document.createElement('div'), document.createElement('div'));
    const checksMentionStyle = document.createElement('div');
    checksMentionStyle.className = 'styleChecks';
    checksMentionStyle.append(mentionBold.label, mentionItalic.label, mentionUnderline.label, mentionUppercase.label);
    sectionMention.append(sectionMentionTitle, rowMentionColor, rowMentionFont, checksMentionStyle);
    
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
    
    // Test button functionality
    testBtn.addEventListener('click', () => {
      const { msgTimeout } = getInterfaceConfig();
      const testRow = createExampleRow(
        'TestUser',
        'Message de test avec timeout',
        [
          'https://static-cdn.jtvnw.net/emoticons/v2/emotesv2_32a19dbdb8ef4e09b13a9f239ffe910d/default/dark/4.0',
        ],
        userColorCache
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


