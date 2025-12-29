import fs from 'node:fs/promises';
import path from 'node:path';

export function createSettingsStore({ userDataDir }) {
  const filePath = path.join(userDataDir, 'ducchat.settings.json');

  function normalizePseudosConfig(input) {
    const cfg = input && typeof input === 'object' ? input : {};
    const blockedRaw = Array.isArray(cfg.blocked) ? cfg.blocked : [];
    const renamesRaw = cfg.renames && typeof cfg.renames === 'object' ? cfg.renames : {};

    const blocked = Array.from(
      new Set(
        blockedRaw
          .map((x) => String(x || '').trim().toLowerCase())
          .filter(Boolean)
      )
    );

    /** @type {Record<string, string>} */
    const renames = {};
    for (const [k, v] of Object.entries(renamesRaw)) {
      const key = String(k || '').trim().toLowerCase();
      const val = String(v || '').trim();
      if (!key || !val) continue;
      renames[key] = val;
    }

    return { blocked, renames };
  }

  async function readAll() {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  async function writeAll(next) {
    const payload = JSON.stringify(next ?? {}, null, 2);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, payload, 'utf8');
  }

  async function getChannel() {
    const all = await readAll();
    return typeof all.twitchChannel === 'string' ? all.twitchChannel : '';
  }

  async function setChannel(channel) {
    const all = await readAll();
    await writeAll({ ...all, twitchChannel: channel });
  }

  async function getPseudosConfig() {
    const all = await readAll();
    return normalizePseudosConfig(all.pseudos);
  }

  async function setPseudosConfig(nextConfig) {
    const all = await readAll();
    const pseudos = normalizePseudosConfig(nextConfig);
    await writeAll({ ...all, pseudos });
    return pseudos;
  }

  return { getChannel, setChannel, getPseudosConfig, setPseudosConfig };
}


