export function PseudosPage() {
  const wrap = document.createElement('div');
  wrap.className = 'card';

  const h2 = document.createElement('h2');
  h2.textContent = 'Pseudos';

  const p = document.createElement('p');
  p.className = 'muted';
  p.textContent = 'Gère les pseudos: masquer certains utilisateurs, et renommer des personnes.';

  /** @type {{blocked: string[], renames: Record<string,string>}} */
  let cfg = { blocked: [], renames: {} };

  function normKey(x) {
    return String(x || '').trim().toLowerCase();
  }

  function uniq(arr) {
    return Array.from(new Set(arr));
  }

  function cfgToStoreShape(c) {
    const blocked = uniq((c?.blocked || []).map(normKey).filter(Boolean));
    const renames = {};
    for (const [k, v] of Object.entries(c?.renames || {})) {
      const key = normKey(k);
      const val = String(v || '').trim();
      if (!key || !val) continue;
      renames[key] = val;
    }
    return { blocked, renames };
  }

  async function loadCfg() {
    // Prefer main-process store in Electron.
    const res = await window.pseudos?.getConfig?.();
    if (res?.ok && res.config) {
      cfg = cfgToStoreShape(res.config);
      return cfg;
    }
    // Browser fallback (dev/debug)
    try {
      cfg = cfgToStoreShape(JSON.parse(localStorage.getItem('ducchat.pseudosConfig') || 'null') || {});
    } catch {
      cfg = { blocked: [], renames: {} };
    }
    return cfg;
  }

  async function saveCfg(next) {
    cfg = cfgToStoreShape(next);
    const res = await window.pseudos?.setConfig?.(cfg);
    if (res?.ok && res.config) {
      cfg = cfgToStoreShape(res.config);
      return cfg;
    }
    // Browser fallback (dev/debug)
    localStorage.setItem('ducchat.pseudosConfig', JSON.stringify(cfg));
    return cfg;
  }

  const section1 = document.createElement('div');
  section1.className = 'ifaceForm';

  const s1Title = document.createElement('div');
  s1Title.className = 'ifaceItem__title';
  s1Title.textContent = 'Masquer des pseudos';

  const blockRow = document.createElement('div');
  blockRow.className = 'ifaceForm__row';
  const blockLabel = document.createElement('div');
  blockLabel.className = 'urlLabel';
  blockLabel.textContent = 'Masquer';
  const blockInput = document.createElement('input');
  blockInput.className = 'textInput';
  blockInput.placeholder = 'Ex: noctumemortis';
  const blockBtn = document.createElement('button');
  blockBtn.className = 'btn btn--ghost';
  blockBtn.type = 'button';
  blockBtn.textContent = 'Ajouter';
  blockRow.append(blockLabel, blockInput);

  const blockList = document.createElement('div');
  blockList.className = 'ifaceList';

  const blockActions = document.createElement('div');
  blockActions.className = 'formActions';
  blockActions.append(blockBtn);

  const section2 = document.createElement('div');
  section2.className = 'ifaceForm';

  const s2Title = document.createElement('div');
  s2Title.className = 'ifaceItem__title';
  s2Title.textContent = 'Renommer des pseudos';

  const renameFromRow = document.createElement('div');
  renameFromRow.className = 'ifaceForm__row';
  const renameFromLabel = document.createElement('div');
  renameFromLabel.className = 'urlLabel';
  renameFromLabel.textContent = 'Pseudo';
  const renameFromInput = document.createElement('input');
  renameFromInput.className = 'textInput';
  renameFromInput.placeholder = 'Ex: yan369';
  renameFromRow.append(renameFromLabel, renameFromInput);

  const renameToRow = document.createElement('div');
  renameToRow.className = 'ifaceForm__row';
  const renameToLabel = document.createElement('div');
  renameToLabel.className = 'urlLabel';
  renameToLabel.textContent = 'Nom';
  const renameToInput = document.createElement('input');
  renameToInput.className = 'textInput';
  renameToInput.placeholder = 'Ex: Yan';
  renameToRow.append(renameToLabel, renameToInput);

  const renameBtn = document.createElement('button');
  renameBtn.className = 'btn btn--ghost';
  renameBtn.type = 'button';
  renameBtn.textContent = 'Ajouter';

  const renameActions = document.createElement('div');
  renameActions.className = 'formActions';
  renameActions.append(renameBtn);

  const renameList = document.createElement('div');
  renameList.className = 'ifaceList';

  function renderBlocked() {
    blockList.replaceChildren();
    if (!cfg.blocked.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'Aucun pseudo masqué.';
      blockList.append(empty);
      return;
    }
    for (const u of cfg.blocked) {
      const row = document.createElement('div');
      row.className = 'ifaceItem';
      const title = document.createElement('div');
      title.className = 'ifaceItem__title';
      title.textContent = u;
      const right = document.createElement('div');
      right.className = 'ifaceItem__right';
      right.style.gridTemplateColumns = '1fr auto';

      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn--ghost';
      delBtn.type = 'button';
      delBtn.textContent = 'Supprimer';
      delBtn.addEventListener('click', async () => {
        const next = { ...cfg, blocked: cfg.blocked.filter((x) => x !== u) };
        await saveCfg(next);
        renderBlocked();
      });
      right.append(document.createElement('div'), delBtn);
      row.append(title, right);
      blockList.append(row);
    }
  }

  function renderRenames() {
    renameList.replaceChildren();
    const entries = Object.entries(cfg.renames || {});
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'Aucun renommage.';
      renameList.append(empty);
      return;
    }
    for (const [from, to] of entries.sort((a, b) => a[0].localeCompare(b[0]))) {
      const row = document.createElement('div');
      row.className = 'ifaceItem';

      const title = document.createElement('div');
      title.className = 'ifaceItem__title';
      title.textContent = `${from} → ${to}`;

      const right = document.createElement('div');
      right.className = 'ifaceItem__right';
      right.style.gridTemplateColumns = '1fr auto';

      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn--ghost';
      delBtn.type = 'button';
      delBtn.textContent = 'Supprimer';
      delBtn.addEventListener('click', async () => {
        const nextRenames = { ...(cfg.renames || {}) };
        delete nextRenames[from];
        await saveCfg({ ...cfg, renames: nextRenames });
        renderRenames();
      });

      right.append(document.createElement('div'), delBtn);
      row.append(title, right);
      renameList.append(row);
    }
  }

  blockBtn.addEventListener('click', async () => {
    const key = normKey(blockInput.value);
    if (!key) return;
    const next = { ...cfg, blocked: uniq([...cfg.blocked, key]) };
    await saveCfg(next);
    blockInput.value = '';
    renderBlocked();
  });

  renameBtn.addEventListener('click', async () => {
    const from = normKey(renameFromInput.value);
    const to = String(renameToInput.value || '').trim();
    if (!from || !to) return;
    const nextRenames = { ...(cfg.renames || {}), [from]: to };
    await saveCfg({ ...cfg, renames: nextRenames });
    renameFromInput.value = '';
    renameToInput.value = '';
    renderRenames();
  });

  // Live updates (Electron)
  if (window.pseudos?.onConfig) {
    window.pseudos.onConfig((nextCfg) => {
      cfg = cfgToStoreShape(nextCfg);
      renderBlocked();
      renderRenames();
    });
  }

  async function init() {
    await loadCfg();
    renderBlocked();
    renderRenames();
  }

  init().catch(() => {});

  section1.append(s1Title, blockRow, blockActions, blockList);
  section2.append(s2Title, renameFromRow, renameToRow, renameActions, renameList);

  wrap.append(h2, p, section1, section2);
  return wrap;
}


