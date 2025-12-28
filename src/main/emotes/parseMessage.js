function twitchEmoteUrl(emoteId) {
  // v2 CDN
  return `https://static-cdn.jtvnw.net/emoticons/v2/${emoteId}/default/dark/4.0`;
}

function toRanges(tagsEmotes) {
  // tags.emotes format: { emoteId: [ "start-end", ... ], ... }
  const out = [];
  if (!tagsEmotes || typeof tagsEmotes !== 'object') return out;
  for (const [id, ranges] of Object.entries(tagsEmotes)) {
    for (const r of ranges || []) {
      const [a, b] = String(r).split('-').map((x) => Number(x));
      if (Number.isFinite(a) && Number.isFinite(b) && a >= 0 && b >= a) {
        out.push({ start: a, end: b, id: String(id) });
      }
    }
  }
  out.sort((x, y) => x.start - y.start);
  return out;
}

function splitWithTwitchEmotes(message, tagsEmotes) {
  const ranges = toRanges(tagsEmotes);
  if (ranges.length === 0) return [{ type: 'text', text: message }];

  const segs = [];
  let i = 0;
  for (const r of ranges) {
    if (r.start > i) segs.push({ type: 'text', text: message.slice(i, r.start) });
    const text = message.slice(r.start, r.end + 1);
    segs.push({
      type: 'emote',
      provider: 'twitch',
      id: r.id,
      url: twitchEmoteUrl(r.id),
      alt: text,
      name: text,
    });
    i = r.end + 1;
  }
  if (i < message.length) segs.push({ type: 'text', text: message.slice(i) });
  return segs;
}

function splitTextWithCustomEmotes(text, emoteMap) {
  // Replace tokens separated by whitespace, keeping whitespace as text segments.
  // Custom emotes usually come as standalone tokens.
  if (!emoteMap || emoteMap.size === 0) return [{ type: 'text', text }];

  const parts = text.split(/(\s+)/); // keep spaces
  const segs = [];
  for (const p of parts) {
    if (!p) continue;
    if (/^\s+$/.test(p)) {
      segs.push({ type: 'text', text: p });
      continue;
    }

    // Strip simple punctuation around token (common in chat)
    const m = p.match(/^([([{<"'`.,!?]*)(.*?)([)\]}>\"'`.,!?]*)$/);
    const pre = m?.[1] || '';
    const token = m?.[2] || p;
    const post = m?.[3] || '';

    if (pre) segs.push({ type: 'text', text: pre });

    const em = emoteMap.get(token);
    if (em) {
      segs.push({
        type: 'emote',
        provider: em.provider,
        id: em.id,
        url: em.url,
        alt: token,
        name: token,
      });
    } else {
      segs.push({ type: 'text', text: token });
    }

    if (post) segs.push({ type: 'text', text: post });
  }
  return segs;
}

export function parseChatMessageToSegments({ message, tagsEmotes, customEmotes }) {
  const base = splitWithTwitchEmotes(message, tagsEmotes);
  const out = [];
  for (const seg of base) {
    if (seg.type === 'text') out.push(...splitTextWithCustomEmotes(seg.text, customEmotes));
    else out.push(seg);
  }
  return out;
}


