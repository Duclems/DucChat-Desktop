import fs from 'node:fs/promises';
import path from 'node:path';

export function createSettingsStore({ userDataDir }) {
  const filePath = path.join(userDataDir, 'ducchat.settings.json');

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

  return { getChannel, setChannel };
}


