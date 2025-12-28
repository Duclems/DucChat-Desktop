export function InterfacePage() {
  const wrap = document.createElement('div');
  wrap.className = 'card';

  const h2 = document.createElement('h2');
  h2.textContent = 'Interfaces';

  const p = document.createElement('p');
  p.className = 'muted';
  p.textContent = 'Crée une interface (URL) avec tes paramètres, puis colle-la dans OBS (Source Navigateur).';

  const form = document.createElement('div');
  form.className = 'ifaceForm';

  const nameRow = document.createElement('div');
  nameRow.className = 'ifaceForm__row';
  const nameLabel = document.createElement('div');
  nameLabel.className = 'urlLabel';
  nameLabel.textContent = 'Nom';
  const nameInput = document.createElement('input');
  nameInput.className = 'textInput';
  nameInput.placeholder = 'Ex: Chat compact';
  nameRow.append(nameLabel, nameInput);

  const fontRow = document.createElement('div');
  fontRow.className = 'ifaceForm__row';
  const fontLabel = document.createElement('div');
  fontLabel.className = 'urlLabel';
  fontLabel.textContent = 'Font';
  const fontInput = document.createElement('input');
  fontInput.className = 'textInput';
  fontInput.type = 'number';
  fontInput.min = '8';
  fontInput.max = '72';
  fontInput.placeholder = '18';
  fontRow.append(fontLabel, fontInput);

  const limitRow = document.createElement('div');
  limitRow.className = 'ifaceForm__row';
  const limitLabel = document.createElement('div');
  limitLabel.className = 'urlLabel';
  limitLabel.textContent = 'Limit';
  const limitInput = document.createElement('input');
  limitInput.className = 'textInput';
  limitInput.type = 'number';
  limitInput.min = '1';
  limitInput.max = '500';
  limitInput.placeholder = '100';
  limitRow.append(limitLabel, limitInput);

  const showRow = document.createElement('div');
  showRow.className = 'ifaceForm__row';
  const showLabel = document.createElement('div');
  showLabel.className = 'urlLabel';
  showLabel.textContent = 'Streamer';
  const showWrap = document.createElement('label');
  showWrap.className = 'checkRow';
  const showInput = document.createElement('input');
  showInput.type = 'checkbox';
  showInput.checked = true;
  const showText = document.createElement('span');
  showText.textContent = 'Afficher les messages du streamer';
  showWrap.append(showInput, showText);
  showRow.append(showLabel, showWrap);

  const addBtn = document.createElement('button');
  addBtn.className = 'btn';
  addBtn.type = 'button';
  addBtn.textContent = 'Ajouter';

  const list = document.createElement('div');
  list.className = 'ifaceList';

  function getStore() {
    try {
      return JSON.parse(localStorage.getItem('ducchat.interfaces') || '[]');
    } catch {
      return [];
    }
  }

  function setStore(items) {
    localStorage.setItem('ducchat.interfaces', JSON.stringify(items));
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  }

  function buildUrl(baseUrl, { fontSize, limit, showStreamer }) {
    const u = new URL(baseUrl);
    u.searchParams.set('overlay', '1');
    if (fontSize) u.searchParams.set('fontSize', String(fontSize));
    if (limit) u.searchParams.set('limit', String(limit));
    u.searchParams.set('showStreamer', showStreamer ? '1' : '0');
    u.hash = '#/';
    return u.toString();
  }

  function renderList(items, baseUrl) {
    list.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'Aucune interface pour le moment.';
      list.append(empty);
      return;
    }

    for (const it of items) {
      const row = document.createElement('div');
      row.className = 'ifaceItem';

      const title = document.createElement('div');
      title.className = 'ifaceItem__title';
      title.textContent = it.name || 'Sans nom';

      const url = buildUrl(baseUrl, it);

      const right = document.createElement('div');
      right.className = 'ifaceItem__right';

      const input = document.createElement('input');
      input.className = 'textInput';
      input.readOnly = true;
      input.value = url;

      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn btn--ghost';
      copyBtn.type = 'button';
      copyBtn.textContent = 'Copier';
      copyBtn.addEventListener('click', () => copy(url));

      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn--ghost';
      delBtn.type = 'button';
      delBtn.textContent = 'Supprimer';
      delBtn.addEventListener('click', () => {
        const next = getStore().filter((x) => x.id !== it.id);
        setStore(next);
        renderList(next, baseUrl);
      });

      right.append(input, copyBtn, delBtn);

      row.append(title, right);
      list.append(row);
    }
  }

  async function loadBaseUrl() {
    const res = await window.ui?.getUrls?.();
    if (!res?.ok) return null;
    // Prefer local HTTP URL in production; dev server in dev
    return String(res.url || '').replace(/\/+$/, '/') || null;
  }

  async function init() {
    const baseUrl = await loadBaseUrl();
    if (!baseUrl) {
      const err = document.createElement('p');
      err.className = 'muted';
      err.textContent = "Impossible de récupérer l'URL de base.";
      list.replaceChildren(err);
      return;
    }

    const items = getStore();
    renderList(items, baseUrl);

    addBtn.addEventListener('click', () => {
      const name = nameInput.value.trim();
      const fontSize = Number(fontInput.value) || null;
      const limit = Number(limitInput.value) || null;
      const showStreamer = !!showInput.checked;

      const item = {
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        name,
        fontSize: fontSize && fontSize >= 8 && fontSize <= 72 ? Math.floor(fontSize) : null,
        limit: limit && limit >= 1 && limit <= 500 ? Math.floor(limit) : null,
        showStreamer,
      };

      const next = [item, ...getStore()];
      setStore(next);
      renderList(next, baseUrl);

      // small UX reset
      nameInput.value = '';
    });
  }

  form.append(nameRow, fontRow, limitRow, showRow, addBtn);
  init().catch(() => {});

  wrap.append(h2, p, form, list);
  return wrap;
}


