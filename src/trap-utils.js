// src/trap-utils.js
// Shared helper functions used across TrapSystem modules.
// Initially contains only a subset (quick-win helpers) – we will migrate
// the rest of the giant utils object here piece-by-piece.

/* eslint-disable no-console */

export function log(message, type = 'info') {
  const prefix = {
    info: '📜',
    error: '❌',
    success: '✅',
    warning: '⚠️',
    debug: '🔍'
  }[type] || '📜';
  console.log(`${prefix} TrapSystem: ${message}`);
}

// Quick-win utility #1 – centralised trap-token validation
export function validateTrapToken(token, actionName = 'action') {
  if (!token) {
    log(`Error: No token supplied for ${actionName}.`, 'error');
    return false;
  }
  if (!globalThis.TrapSystem || !globalThis.TrapSystem.utils || typeof globalThis.TrapSystem.utils.isTrap !== 'function') {
    // During early bootstrap the monolith may not be loaded. We simply assume OK.
    return true;
  }
  if (!globalThis.TrapSystem.utils.isTrap(token)) {
    log(`Error: Selected token is not a trap. (${actionName})`, 'error');
    return false;
  }
  return true;
}

// Quick-win utility #2 – parameter length guard for chat commands
export function validateCommandArgs(args, minLength, commandName = 'command') {
  if (args.length < minLength) {
    log(`Error: Missing parameters for ${commandName}.`, 'error');
    return false;
  }
  return true;
}

export const TrapUtils = {
  log,
  validateTrapToken,
  validateCommandArgs
};

export default TrapUtils;

// ------------------------------------------------------------------
// Legacy util functions migrated from v1 (minimal initial subset)
// ------------------------------------------------------------------

// NOTE: These still rely on Roll20 API globals (getObj, sendChat, etc.) –
// that is OK because after bundling they run inside the Roll-20 sandbox.

export function playerIsGM(playerId) {
  const player = getObj && getObj('player', playerId);
  if (!player) return false;
  return player.get('_online') && player.get('_type') === 'player' && player.get('_isGM');
}

export function chat(message) {
  if (typeof message !== 'string') return;
  sendChat('TrapSystem', `/w gm ${message}`);
}

export function getGMPlayerIds() {
  const allPlayers = findObjs ? findObjs({ _type: 'player' }) : [];
  return allPlayers.filter(p => playerIsGM(p.id)).map(p => p.id);
}

export function whisper(recipientId, message) {
  if (!recipientId || !message) return;
  // First assume playerId
  const player = getObj && getObj('player', recipientId);
  if (player) {
    sendChat('TrapSystem', `/w "${player.get('displayname')}" ${message}`);
    return;
  }
  // Maybe a token representing a character → whisper to controllers.
  const token = getObj && getObj('graphic', recipientId);
  if (token && token.get('represents')) {
    const char = getObj('character', token.get('represents'));
    if (char) {
      const controllers = (char.get('controlledby') || '').split(',').map(s => s.trim()).filter(Boolean);
      controllers.forEach(pid => {
        const p = getObj('player', pid);
        if (p) sendChat('TrapSystem', `/w "${p.get('displayname')}" ${message}`);
      });
      return;
    }
  }
  // Fallback to GM
  chat(`Could not find a valid recipient for ID ${recipientId}. Msg: ${message}`);
}

export function decodeHtml(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Quick check to see if a token is a trap (based on gmnotes)
export function isTrap(token) {
  if (!token) return false;
  const notes = token.get ? token.get('gmnotes') : '';
  if (!notes) return false;
  let decoded = '';
  try { decoded = decodeURIComponent(notes); } catch (e) { decoded = notes; }
  return decoded.includes('!traptrigger');
}

// Utility for images (used by menus)
export function getTokenImageURL(token, size = 'med') {
  if (!token) return '👤';
  const sanitize = url => {
    if (!url) return null;
    let processed = url.replace(/(thumb|max)(?=\.[^/]+$)/, size);
    processed = processed.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/'/g, '%27').replace(/"/g, '%22');
    return processed;
  };
  let img = token.get('imgsrc');
  if (!img) {
    const charId = token.get('represents');
    if (charId) {
      const char = getObj('character', charId);
      if (char) {
        img = char.get('avatar') || char.get('imgsrc');
      }
    }
  }
  const sanitized = sanitize(img);
  return sanitized || '👤';
}

// Merge into export object
Object.assign(TrapUtils, {
  playerIsGM,
  chat,
  getGMPlayerIds,
  whisper,
  decodeHtml,
  isTrap,
  getTokenImageURL
});