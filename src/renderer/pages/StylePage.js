const STORE_KEY = 'ducchat.chatStyle';

const STYLE_KEYS = [
  { key: '--chat-font-size', label: 'Font size', type: 'text', placeholder: '14px (ex: 18px)' },
  { key: '--chat-line-height', label: 'Line height', type: 'text', placeholder: '1.45' },
  { key: '--chat-gap', label: 'Espacement (gap)', type: 'text', placeholder: '0.6em' },
  { key: '--chat-padding-y', label: 'Padding vertical', type: 'text', placeholder: '0.2em' },
  { key: '--chat-emote-size', label: 'Taille emotes', type: 'text', placeholder: '22px' },
  { key: '--chat-text-color', label: 'Couleur message', type: 'color', placeholder: '#f2f2f2' },
  { key: '--chat-user-weight', label: 'Poids pseudo', type: 'text', placeholder: '800' },
];

function safeLoad() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

function save(obj) {
  localStorage.setItem(STORE_KEY, JSON.stringify(obj));
}

export function StylePage() {
  const wrap = document.createElement('div');
  wrap.className = 'card';

  const h2 = document.createElement('h2');
  h2.textContent = 'Style';

  const p = document.createElement('p');
  p.className = 'muted';
  p.textContent = 'Ici tu stylises uniquement les messages du chat (OBS + app). Sauvegardé localement.';

  const grid = document.createElement('div');
  grid.className = 'styleGrid';

  const saved = safeLoad();

  function apply(key, value) {
    if (!value) {
      document.documentElement.style.removeProperty(key);
      return;
    }
    document.documentElement.style.setProperty(key, value);
  }

  for (const item of STYLE_KEYS) {
    const row = document.createElement('div');
    row.className = 'styleRow';

    const label = document.createElement('div');
    label.className = 'urlLabel';
    label.textContent = item.label;

    const input = document.createElement('input');
    input.className = 'textInput';
    input.placeholder = item.placeholder || '';

    if (item.type === 'color') {
      input.type = 'color';
      // Use saved value, otherwise fallback to current computed value, otherwise placeholder
      const current = getComputedStyle(document.documentElement).getPropertyValue(item.key).trim();
      input.value = (saved[item.key] || current || item.placeholder || '#000000').trim();
    } else {
      input.type = 'text';
      const current = getComputedStyle(document.documentElement).getPropertyValue(item.key).trim();
      input.value = (saved[item.key] || current || '').trim();
    }

    input.addEventListener('input', () => {
      const next = { ...safeLoad(), [item.key]: input.value.trim() };
      save(next);
      apply(item.key, input.value.trim());
    });

    row.append(label, input);
    grid.append(row);
  }

  const actions = document.createElement('div');
  actions.className = 'formActions';

  const reset = document.createElement('button');
  reset.className = 'btn btn--ghost';
  reset.type = 'button';
  reset.textContent = 'Reset';
  reset.addEventListener('click', () => {
    localStorage.removeItem(STORE_KEY);
    // remove only our keys
    for (const { key } of STYLE_KEYS) document.documentElement.style.removeProperty(key);
    // refresh inputs quickly
    window.location.reload();
  });

  actions.append(reset);

  wrap.append(h2, p, grid, actions);
  return wrap;
}


