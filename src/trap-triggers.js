// src/trap-triggers.js
// Initial migration of trigger-control helpers (wrapper around legacy for now)

import TrapUtils from './trap-utils.js';
import { Config } from './trap-core.js';
import { ui } from './trap-ui.js';

function toggleTrap(token) {
  if (!TrapUtils.validateTrapToken(token, 'toggleTrap')) return;
  const data = TrapUtils.parseTrapNotes(token.get('gmnotes'), token);
  if (!data) {
    TrapUtils.chat('❌ Invalid trap configuration.');
    return;
  }
  const newArmed = !data.isArmed;
  let newUses = data.currentUses;
  if (newArmed && newUses <= 0) newUses = 1;
  TrapUtils.updateTrapUses(token, newUses, data.maxUses, newArmed);
  TrapUtils.chat(`${newArmed ? '🎯 Armed' : '🔴 Disarmed'} (uses ${newUses}/${data.maxUses})`);
}

function getTrapStatus(token) {
  if (!token) return;
  const d = TrapUtils.parseTrapNotes(token.get('gmnotes'), token);
  if (!d) {
    TrapUtils.chat('❌ Invalid trap config.');
    return;
  }
  const msg = [];
  msg.push('&{template:default} {{name=Trap Status}}');
  msg.push(`{{State=${d.isArmed ? '🎯 ARMED' : '🔴 DISARMED'}}}`);
  msg.push(`{{Uses=${d.currentUses}/${d.maxUses}}}`);
  if (d.type === 'interaction') {
    if (d.primaryMacro && d.primaryMacro.macro) msg.push(`{{Primary=${TrapUtils.getSafeMacroDisplayName(d.primaryMacro.macro)}}}`);
    if (d.successMacro) msg.push(`{{Success=${TrapUtils.getSafeMacroDisplayName(d.successMacro)}}}`);
    if (d.failureMacro) msg.push(`{{Failure=${TrapUtils.getSafeMacroDisplayName(d.failureMacro)}}}`);
    if (d.checks && d.checks.length) {
      const checkInfo = d.checks.map(c => `${Config.SKILL_TYPES[c.type] || '🎲'} ${c.type} (DC ${c.dc})`).join('<br>');
      msg.push(`{{Checks=${checkInfo}}}`);
    }
  }
  msg.push(`{{Movement Trigger=${d.movementTrigger ? 'On' : 'Off'}}}`);
  msg.push(`{{Auto Trigger=${d.autoTrigger ? 'On' : 'Off'}}}`);
  msg.push(`{{Position=${typeof d.position === 'object' ? `(${d.position.x},${d.position.y})` : d.position}}}`);
  sendChat('TrapSystem', `/w gm ${msg.join(' ')}`);
}

export const triggers = {
  toggleTrap,
  getTrapStatus
};

export default triggers;