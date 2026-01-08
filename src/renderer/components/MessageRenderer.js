import { normUserKey, fallbackUserColor, ensureColorVisibility } from '../utils/messageUtils';
import { getInterfaceConfig } from '../utils/styleUtils';

/**
 * Renders a single chat message
 */
export function renderMessage(m, pseudosCfg, userColorCache) {
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
  
  // Apply animation if configured
  const { animationType } = getInterfaceConfig();
  if (animationType && animationType !== 'none') {
    row.dataset.animation = animationType;
  }

  const user = document.createElement('span');
  user.className = 'chatMsg__user';
  user.textContent = `${displayUser} :`;
  const { userColors, userColor: customUserColor } = getInterfaceConfig();
  if (userColors) {
    const c = String(m.userColor || '').trim();
    if (c) {
      // Use Twitch color if available, but ensure it's visible on dark background
      const safeColor = ensureColorVisibility(c, origUser, userColorCache);
      row.style.setProperty('--user-color', safeColor);
    } else {
      // No Twitch color defined, use random color based on username
      const randomColor = userColorCache 
        ? fallbackUserColor(origUser, userColorCache)
        : fallbackUserColor(origUser, new Map());
      row.style.setProperty('--user-color', randomColor);
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

