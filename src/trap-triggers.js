// src/trap-triggers.js
// Initial migration of trigger-control helpers (wrapper around legacy for now)

import TrapUtils from './trap-utils.js';
import { Config } from './trap-core.js';
import { ui } from './trap-ui.js';

function toggleTrap(token) {
  if (!TrapUtils.validateTrapToken(token, 'toggleTrap')) return;
  const legacyUtils = globalThis.TrapSystem && globalThis.TrapSystem.utils;
  if (!legacyUtils || typeof legacyUtils.parseTrapNotes !== 'function') {
    TrapUtils.chat('❌ toggleTrap: legacy utilities not available yet.');
    return;
  }
  const data = legacyUtils.parseTrapNotes(token.get('gmnotes'), token);
  if (!data) {
    TrapUtils.chat('❌ Invalid trap configuration.');
    return;
  }
  const newArmedState = !data.isArmed;
  let newUses = data.currentUses;
  if (newArmedState && newUses <= 0) newUses = 1;
  if (typeof legacyUtils.updateTrapUses === 'function') {
    legacyUtils.updateTrapUses(token, newUses, data.maxUses, newArmedState);
  }
  TrapUtils.chat(`${newArmedState ? '🎯' : '🔴'} Trap ${newArmedState ? 'ARMED' : 'DISARMED'}`);
}

function getTrapStatus(token) {
  if (!TrapUtils.validateTrapToken(token, 'status')) return;
  const legacyUtils = globalThis.TrapSystem && globalThis.TrapSystem.utils;
  if (!legacyUtils || typeof legacyUtils.parseTrapNotes !== 'function') {
    TrapUtils.chat('❌ status: legacy utilities not available yet.');
    return;
  }
  const data = legacyUtils.parseTrapNotes(token.get('gmnotes'), token);
  if (!data) {
    TrapUtils.chat('❌ Invalid trap configuration.');
    return;
  }
  const sections = [
    `name=Trap Status`,
    `State=${data.isArmed ? '🎯 ARMED' : '🔴 DISARMED'}`,
    `Uses=${data.currentUses}/${data.maxUses}`
  ];
  ui.sendGM(ui.buildDefaultTemplate(sections));
}

export const triggers = {
  toggleTrap,
  getTrapStatus
};

export default triggers;