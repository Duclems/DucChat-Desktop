import { getInterfaceConfig } from '../utils/styleUtils';
import { fallbackUserColor } from '../utils/messageUtils';

/**
 * Creates an example message preview component
 */
export function createExamplePreview(onTestClick) {
  const exampleWrap = document.createElement('div');
  exampleWrap.className = 'examplePreview';
  
  const exampleLabelRow = document.createElement('div');
  exampleLabelRow.style.display = 'flex';
  exampleLabelRow.style.justifyContent = 'space-between';
  exampleLabelRow.style.alignItems = 'center';
  exampleLabelRow.style.marginBottom = 'var(--space-8)';
  
  const exampleLabel = document.createElement('div');
  exampleLabel.className = 'examplePreview__label';
  exampleLabel.textContent = 'Exemple de rendu:';
  
  const testBtn = document.createElement('button');
  testBtn.className = 'btn btn--ghost';
  testBtn.type = 'button';
  testBtn.textContent = 'Test';
  testBtn.style.fontSize = '12px';
  testBtn.style.padding = '0.3em 0.8em';
  if (onTestClick) {
    testBtn.addEventListener('click', onTestClick);
  }
  
  exampleLabelRow.append(exampleLabel, testBtn);
  
  const exampleLog = document.createElement('div');
  exampleLog.className = 'chatLog examplePreview__log';
  exampleLog.style.height = 'auto';
  exampleLog.style.maxHeight = '120px';
  exampleLog.style.marginTop = 'var(--space-8)';
  
  exampleWrap.append(exampleLabelRow, exampleLog);
  
  return { container: exampleWrap, log: exampleLog, testBtn };
}

/**
 * Creates an example message row
 */
export function createExampleRow(userName, textContent, emotes = [], userColorCache) {
  const { userColors, userColor: customUserColor, userCapitalizeFirst, frameTextCapitalizeFirst } = getInterfaceConfig();
  
  let displayName = userName;
  if (userCapitalizeFirst && displayName.length > 0) {
    displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1).toLowerCase();
  }
  
  const row = document.createElement('div');
  row.className = 'chatMsg';

  const user = document.createElement('span');
  user.className = 'chatMsg__user';
  user.textContent = `${displayName} :`;
  if (userColors) {
    // In example, simulate Twitch color with random color
    row.style.setProperty('--user-color', fallbackUserColor(userName, userColorCache));
  } else if (customUserColor) {
    row.style.setProperty('--user-color', customUserColor);
  } else {
    row.style.removeProperty('--user-color');
  }

  const content = document.createElement('span');
  content.className = 'chatMsg__text';
  
  // Parse mentions in example text (before emotes)
  const mentionRegex = /(@[a-zA-Z0-9_]+)/g;
  const parts = textContent.split(mentionRegex);
  const frag = document.createDocumentFragment();
  let foundFirstLetter = false;
  for (const part of parts) {
    if (part.startsWith('@')) {
      const mentionName = part.slice(1);
      const mentionSpan = document.createElement('span');
      mentionSpan.className = 'chatMsg__mention';
      mentionSpan.textContent = part;
      frag.append(mentionSpan);
    } else if (part) {
      let text = part;
      // Capitalize first letter of first word if option is enabled and we haven't found it yet
      if (frameTextCapitalizeFirst && !foundFirstLetter && text.length > 0) {
        const firstLetterIndex = text.search(/[a-zA-Z]/);
        if (firstLetterIndex !== -1) {
          text = text.slice(0, firstLetterIndex) + text.charAt(firstLetterIndex).toUpperCase() + text.slice(firstLetterIndex + 1);
          foundFirstLetter = true;
        }
      }
      frag.append(document.createTextNode(text));
    }
  }
  
  // Add emotes after text
  for (const emoteUrl of emotes) {
    const emote = document.createElement('img');
    emote.className = 'chatEmote';
    emote.src = emoteUrl;
    emote.alt = 'Emote';
    emote.title = 'Emote';
    emote.loading = 'lazy';
    emote.decoding = 'async';
    frag.append(' ', emote);
  }
  
  content.append(frag);
  row.append(user, content);
  return row;
}

