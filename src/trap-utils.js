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