import { getInterfaceConfig } from '../utils/styleUtils';

/**
 * Creates and manages a chat log container
 */
export function createChatLog() {
  const log = document.createElement('div');
  log.className = 'chatLog';
  
  // In HTTP/overlay mode we don't run the preview panel, so we must apply interface classes here.
  // Compact is always enabled by default
  log.classList.add('chatLog--compact');
  log.classList.toggle('chatLog--stacked', getInterfaceConfig().stacked);
  
  return log;
}

/**
 * Applies timeout to a message element
 */
export function applyTimeoutToMessage(row, timeout, startTime) {
  if (!timeout || timeout <= 0) return;
  
  const now = startTime || Date.now();
  const elapsed = Date.now() - now;
  const remaining = Math.max(0, timeout * 1000 - elapsed);
  
  if (remaining <= 0) {
    row.remove();
    return;
  }
  
  setTimeout(() => {
    row.remove();
  }, remaining);
}

