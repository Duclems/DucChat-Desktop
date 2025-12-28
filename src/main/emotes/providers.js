import { fetchJson } from './fetchJson';

const twitchIdCache = new Map(); // login -> id (string)
const emoteCache = new Map(); // channel -> { at:number, map:Map }

async function getTwitchUserId(login) {
  const key = String(login || '').toLowerCase();
  if (!key) return '';
  if (twitchIdCache.has(key)) return twitchIdCache.get(key);

  // Public endpoint (no OAuth) that returns Twitch user info, including id.
  const data = await fetchJson(`https://api.ivr.fi/v2/twitch/user?login=${encodeURIComponent(key)}`);
  const id = String(data?.id || '');
  if (id) twitchIdCache.set(key, id);
  return id;
}

function pickFirstUrl(urlsObj) {
  // FFZ urls are like { "1": "//...", "2": "//...", "4": "//..." }
  const url = urlsObj?.['4'] || urlsObj?.['2'] || urlsObj?.['1'] || '';
  if (!url) return '';
  return url.startsWith('//') ? `https:${url}` : url;
}

async function getFfzEmotes(login) {
  const data = await fetchJson(`https://api.frankerfacez.com/v1/room/${encodeURIComponent(login)}`);
  const sets = data?.sets || {};
  const map = new Map();
  for (const set of Object.values(sets)) {
    for (const emote of set?.emoticons || []) {
      const name = emote?.name;
      const url = pickFirstUrl(emote?.urls);
      if (name && url) map.set(name, { provider: 'ffz', id: String(emote?.id || ''), url, name });
    }
  }
  return map;
}

async function getBttvEmotes(twitchId) {
  if (!twitchId) return new Map();
  const data = await fetchJson(`https://api.betterttv.net/3/cached/users/twitch/${encodeURIComponent(twitchId)}`);
  const all = [...(data?.channelEmotes || []), ...(data?.sharedEmotes || [])];
  const map = new Map();
  for (const e of all) {
    const name = e?.code;
    const id = e?.id;
    if (!name || !id) continue;
    // BTTV max is 3x (no 4x)
    const url = `https://cdn.betterttv.net/emote/${id}/3x`;
    map.set(name, { provider: 'bttv', id: String(id), url, name });
  }
  return map;
}

async function get7tvEmotes(twitchId) {
  if (!twitchId) return new Map();
  const data = await fetchJson(`https://7tv.io/v3/users/twitch/${encodeURIComponent(twitchId)}`);
  const emotes = data?.emote_set?.emotes || [];
  const map = new Map();
  for (const e of emotes) {
    const name = e?.name;
    const host = e?.data?.host;
    const base = host?.url; // like "//cdn.7tv.app/emote/<id>"
    const files = host?.files || [];
    const file =
      files.find((f) => f?.name === '4x.webp') ||
      files.find((f) => f?.name === '3x.webp') ||
      files.find((f) => f?.name === '2x.webp') ||
      files.find((f) => f?.name === '1x.webp') ||
      files[0];
    if (!name || !base || !file?.name) continue;
    const url = `${base.startsWith('//') ? `https:${base}` : base}/${file.name}`;
    map.set(name, { provider: '7tv', id: String(e?.id || ''), url, name });
  }
  return map;
}

export async function loadCustomEmotesForChannel(login, { cacheTtlMs = 5 * 60 * 1000 } = {}) {
  const channel = String(login || '').toLowerCase();
  if (!channel) return new Map();

  const cached = emoteCache.get(channel);
  if (cached && Date.now() - cached.at < cacheTtlMs) return cached.map;

  let twitchId = '';
  try {
    twitchId = await getTwitchUserId(channel);
  } catch {
    // ignore (FFZ can work without id)
  }

  const [ffz, bttv, sevenTv] = await Promise.allSettled([
    getFfzEmotes(channel),
    getBttvEmotes(twitchId),
    get7tvEmotes(twitchId),
  ]);

  const map = new Map();
  for (const r of [ffz, bttv, sevenTv]) {
    if (r.status !== 'fulfilled') continue;
    for (const [k, v] of r.value.entries()) {
      // precedence: FFZ < BTTV < 7TV (last wins)
      map.set(k, v);
    }
  }

  emoteCache.set(channel, { at: Date.now(), map });
  return map;
}


