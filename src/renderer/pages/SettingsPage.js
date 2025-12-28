export function SettingsPage() {
  const wrap = document.createElement('div');
  wrap.className = 'card';

  const h2 = document.createElement('h2');
  h2.textContent = 'Settings Twitch';

  const status = document.createElement('p');
  status.className = 'muted';
  status.textContent = 'Choisis une chaîne Twitch à écouter.';

  const row = document.createElement('div');
  row.className = 'formRow';

  const input = document.createElement('input');
  input.className = 'textInput';
  input.placeholder = 'Pseudo de chaîne (ex: xqc)';
  input.autocomplete = 'off';
  input.spellcheck = false;

  const save = document.createElement('button');
  save.className = 'btn';
  save.type = 'button';
  save.textContent = 'Enregistrer';

  const disconnect = document.createElement('button');
  disconnect.className = 'btn btn--ghost';
  disconnect.type = 'button';
  disconnect.textContent = 'Déconnecter';

  const actions = document.createElement('div');
  actions.className = 'formActions';
  actions.append(save, disconnect);

  row.append(input);

  async function loadCurrent() {
    if (!window.twitch?.getChannel) return;
    const ch = await window.twitch.getChannel();
    input.value = ch || '';
  }

  async function saveChannel() {
    const value = input.value.trim();
    status.textContent = 'Connexion...';
    const res = await window.twitch?.setChannel?.(value);
    if (!res?.ok) {
      status.textContent = res?.error || 'Erreur';
      return;
    }
    status.textContent = res.channel ? `Connecté à ${res.channel}` : 'Déconnecté';
  }

  save.addEventListener('click', saveChannel);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveChannel();
  });

  disconnect.addEventListener('click', async () => {
    await window.twitch?.disconnect?.();
    status.textContent = 'Déconnecté';
    input.value = '';
  });

  if (window.twitch?.onStatus) {
    window.twitch.onStatus((s) => {
      if (!s?.state) return;
      if (s.state === 'connected') status.textContent = `Connecté à ${s.channel}`;
      else if (s.state === 'connecting') status.textContent = `Connexion à ${s.channel}...`;
      else if (s.state === 'reconnecting') status.textContent = `Reconnexion à ${s.channel}...`;
      else if (s.state === 'disconnected') status.textContent = 'Déconnecté';
    });
  }

  loadCurrent().catch(() => {});

  wrap.append(h2, status, row, actions);
  return wrap;
}


