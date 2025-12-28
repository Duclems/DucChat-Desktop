import tmi from 'tmi.js';
import { loadCustomEmotesForChannel } from './emotes/providers';
import { parseChatMessageToSegments } from './emotes/parseMessage';

function normalizeChannel(input) {
  const raw = String(input ?? '').trim();
  const noHash = raw.replace(/^#/, '').toLowerCase();
  // Twitch username/channel rules: letters, numbers, underscore (max 25)
  if (!noHash) return '';
  if (!/^[a-z0-9_]{1,25}$/.test(noHash)) return null;
  return noHash;
}

export function createTwitchChat({ onMessage, onStatus }) {
  let client = null;
  let currentChannel = '';
  let customEmotes = new Map();

  async function disconnect() {
    if (!client) return;
    try {
      onStatus?.({ state: 'disconnecting', channel: currentChannel });
      await client.disconnect();
    } catch {
      // ignore
    } finally {
      client = null;
      onStatus?.({ state: 'disconnected', channel: currentChannel });
      currentChannel = '';
    }
  }

  async function connect(channelInput) {
    const channel = normalizeChannel(channelInput);
    if (channel === null) throw new Error('Nom de chaîne invalide (a-z, 0-9, underscore).');

    if (!channel) {
      await disconnect();
      return '';
    }

    // If already connected to same channel, no-op
    if (client && currentChannel === channel) return channel;

    await disconnect();
    currentChannel = channel;

    onStatus?.({ state: 'connecting', channel });

    // Load custom emotes (FFZ/BTTV/7TV). Fail silently if APIs are down.
    try {
      customEmotes = await loadCustomEmotesForChannel(channel);
      onStatus?.({ state: 'emotesLoaded', channel, count: customEmotes.size });
    } catch {
      customEmotes = new Map();
    }

    client = new tmi.Client({
      connection: { secure: true, reconnect: true },
      channels: [channel],
    });

    client.on('message', (_channel, tags, message, self) => {
      if (self) return;
      const msgText = String(message ?? '');
      const segments = parseChatMessageToSegments({
        message: msgText,
        tagsEmotes: tags?.emotes,
        customEmotes,
      });
      onMessage?.({
        channel: currentChannel,
        user: tags?.['display-name'] || tags?.username || 'unknown',
        userColor: tags?.color || '',
        message: msgText,
        segments,
        isBroadcaster: tags?.badges?.broadcaster === '1',
        id: tags?.id,
        ts: Date.now(),
      });
    });

    client.on('connected', () => onStatus?.({ state: 'connected', channel }));
    client.on('disconnected', (_reason) => onStatus?.({ state: 'disconnected', channel }));
    client.on('reconnect', () => onStatus?.({ state: 'reconnecting', channel }));

    await client.connect();
    return channel;
  }

  function getChannel() {
    return currentChannel;
  }

  return { connect, disconnect, getChannel, normalizeChannel };
}


