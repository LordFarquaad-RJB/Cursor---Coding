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

function manualTrigger(trapToken) {
  if (!trapToken) {
    TrapUtils.chat('❌ No trap token selected.');
    return;
  }
  const data = TrapUtils.parseTrapNotes(trapToken.get('gmnotes'), trapToken);
  if (!data) {
    TrapUtils.chat('❌ Invalid trap configuration.');
    return;
  }

  // Auto-trigger shortcut
  if (data.autoTrigger && data.primaryMacro && data.primaryMacro.macro) {
    manualMacroTrigger(trapToken.id, 'primary');
    return;
  }

  // Interaction trap shows menu
  if (data.type === 'interaction') {
    // Use the migrated interaction menu system
    const interactionSystem = globalThis.TrapSystem && globalThis.TrapSystem.interaction;
    if (interactionSystem && typeof interactionSystem.showInteractionMenu === 'function') {
      interactionSystem.showInteractionMenu(trapToken);
    } else {
      TrapUtils.chat('🔧 Interaction menu system not available');
      getTrapStatus(trapToken);
    }
    return;
  }

  // Standard trap control panel
  const panel = [];
  panel.push('&{template:default} {{name=Trap Control Panel}}');
  panel.push(`{{State=🎯 ${data.isArmed ? 'ARMED' : '🔴 DISARMED'} Uses: ${data.currentUses}/${data.maxUses}}}`);
  panel.push(`{{Management=[🔄 Toggle](!trapsystem toggle ${trapToken.id}) [📊 Status](!trapsystem status ${trapToken.id})}}`);

  if (data.isArmed && data.currentUses > 0) {
    panel.push(`{{Reminder=⚠️ Ensure correct trap token selected for macros!}}`);
    panel.push(`{{After Trigger=${data.currentUses > 1 ? '🎯 ARMED' : '🔴 AUTO-DISARMED'} Uses: ${data.currentUses - 1}/${data.maxUses}}}`);
    
    let triggerOpts = '';
    if (data.primaryMacro && data.primaryMacro.macro) {
      triggerOpts += `[🎯 ${TrapUtils.getSafeMacroDisplayName(data.primaryMacro.macro)}](!trapsystem manualtrigger ${trapToken.id} primary)`;
    }
    if (data.options && data.options.length > 0) {
      data.options.forEach((opt, i) => {
        if (triggerOpts) triggerOpts += ' ';
        triggerOpts += `[🎯 ${TrapUtils.getSafeMacroDisplayName(opt.macro)}](!trapsystem manualtrigger ${trapToken.id} option ${i})`;
      });
    }
    panel.push(`{{Trigger Options=${triggerOpts || '(DE)'}}}`);
  } else {
    panel.push(`{{Note=Trap disarmed or out of uses. Toggle to enable triggers.}}`);
  }
  
  panel.push('}}');
  sendChat('API', `/w gm ${panel.join(' ')}`);
}

function manualMacroTrigger(trapId, macroIdentifier) {
  const trapToken = getObj('graphic', trapId);
  if (!trapToken) {
    TrapUtils.chat('❌ Trap token not found.');
    return;
  }
  const data = TrapUtils.parseTrapNotes(trapToken.get('gmnotes'), trapToken);
  if (!data || !data.isArmed || data.currentUses <= 0) {
    TrapUtils.chat('❌ Trap cannot be triggered (disarmed or no uses).');
    return;
  }

  const tagMap = TrapUtils.buildTagToIdMap(trapToken, null, []);
  let macroToExecute = null;
  
  if (macroIdentifier === 'primary') {
    macroToExecute = data.primaryMacro?.macro;
  } else if (macroIdentifier.startsWith('option')) {
    const optIndex = parseInt(macroIdentifier.split(' ')[1], 10);
    macroToExecute = data.options?.[optIndex]?.macro;
  }
  
  if (macroToExecute) {
    const executed = TrapUtils.executeMacro(macroToExecute, tagMap);
    if (executed) {
      const newUses = data.currentUses - 1;
      const stillArmed = newUses > 0;
      TrapUtils.updateTrapUses(trapToken, newUses, data.maxUses, stillArmed);
      if (!stillArmed) {
        TrapUtils.chat('💥 Trap depleted and disarmed.');
      }
    } else {
      TrapUtils.chat('❌ Macro execution failed.');
    }
  } else {
    TrapUtils.chat('❌ Invalid macro identifier.');
  }
}

// Helper to process macro strings for trap setup
function processMacro(macroCmd) {
  if (!macroCmd || typeof macroCmd !== 'string' || macroCmd.trim().toLowerCase() === 'none' || macroCmd.trim() === '') {
    return null;
  }

  let content = macroCmd.trim();

  // Handle disguised templates like ^{template:...}
  if (content.startsWith('^')) {
    content = '&' + content.substring(1);
  }

  if (content.startsWith('"') && content.endsWith('"')) {
    content = content.substring(1, content.length - 1).trim();
  }

  if (content.startsWith('&{')) { // Roll template
    return `"${content.replace(/"/g, '\\"')}"`;
  }
  if (content.startsWith('!')) {
    return `"$${content.substring(1)}"`;
  }
  if (content.startsWith('$')) {
    return `"${content}"`;
  }
  if (content.startsWith('#')) {
    const macroName = content.substring(1).trim();
    if (findObjs({ _type: 'macro', name: macroName }).length === 0) {
      TrapUtils.chat(`⚠️ Warning: Macro "${macroName}" not found.`);
    }
    return content;
  }
  if (findObjs({ _type: 'macro', name: content }).length > 0) {
    return '#' + content;
  }
  return `"${content.replace(/"/g, '\\"')}"`;
}

function setupTrap(token, uses, mainMacro, optionalMacro2, optionalMacro3, movement, autoTrigger) {
  if (!token) {
    TrapUtils.chat('❌ No token selected.');
    return;
  }

  // Preserve existing detection block if any
  const existingNotes = token.get('gmnotes') || '';
  let decoded = '';
  try { decoded = decodeURIComponent(existingNotes); } catch (_) { decoded = existingNotes; }
  const detectionMatch = decoded.match(/(\{!trapdetection\s+(?:(?!\{!}).)*\})/);
  const existingDetection = detectionMatch ? detectionMatch[0] : '';

  const maxUses = parseInt(uses, 10);
  if (isNaN(maxUses) || maxUses < 1) {
    TrapUtils.chat('❌ Uses must be a positive number.');
    return;
  }

  const primaryProcessed = processMacro(mainMacro);
  if (!primaryProcessed) {
    TrapUtils.chat('❌ Primary macro required for standard trap.');
    return;
  }

  let parts = [
    'type:[standard]',
    `uses:[${maxUses}/${maxUses}]`,
    'armed:[on]',
    `primaryMacro:[${primaryProcessed}]`
  ];

  // Process optional macros
  const options = [];
  const opt2 = processMacro(optionalMacro2);
  if (opt2) options.push(opt2);
  const opt3 = processMacro(optionalMacro3);
  if (opt3) options.push(opt3);
  if (options.length > 0) {
    parts.push(`options:[${options.join(';')}]`);
  }

  // Movement setting
  let movementSetting = 'intersection';
  if (movement) {
    const movLower = movement.toLowerCase();
    if (movLower === 'center' || movLower === 'grid') {
      movementSetting = movLower === 'grid' ? '0,0' : 'center';
    } else if (movLower.match(/^\d+,\d+$/)) {
      movementSetting = movLower;
    }
  }
  parts.push(`position:[${movementSetting}]`);
  parts.push('movementTrigger:[on]');
  parts.push(`autoTrigger:[${autoTrigger && (autoTrigger.toString().toLowerCase() === 'true' || autoTrigger === true) ? 'on' : 'off'}]`);

  const newBlock = `{!traptrigger ${parts.join(' ')}}`;
  const finalNotes = `${newBlock} ${existingDetection}`.trim();

  try {
    const encoded = encodeURIComponent(finalNotes);
    token.set({
      gmnotes: encoded,
      bar1_value: maxUses,
      bar1_max: maxUses,
      showplayers_bar1: false,
      aura1_radius: TrapUtils.calculateDynamicAuraRadius(token),
      aura1_color: Config.AURA_COLORS.ARMED,
      showplayers_aura1: false
    });
    getTrapStatus(token);
  } catch (e) {
    TrapUtils.chat('❌ Error setting trap properties.');
    TrapUtils.log(`setupTrap error: ${e.message}`, 'error');
  }
}

function setupInteractionTrap(token, uses, primaryMacro, successMacro, failureMacro, check1Type, check1DC, check2Type, check2DC, movementTriggerEnabled = true, movement = 'intersection', autoTriggerEnabled = false) {
  if (!token) {
    TrapUtils.chat('❌ No token selected.');
    return;
  }

  // Preserve existing detection block
  const existingNotes = token.get('gmnotes') || '';
  let decoded = '';
  try { decoded = decodeURIComponent(existingNotes); } catch (_) { decoded = existingNotes; }
  const detectionMatch = decoded.match(/(\{!trapdetection\s+(?:(?!\{!}).)*\})/);
  const existingDetection = detectionMatch ? detectionMatch[0] : '';

  let positionValue = movement ? movement.toLowerCase() : 'intersection';
  if (positionValue === 'grid') positionValue = '0,0';

  const maxUses = parseInt(uses, 10);
  if (isNaN(maxUses) || maxUses < 1) {
    TrapUtils.chat('❌ Uses must be a positive number.');
    return;
  }

  let parts = [
    'type:[interaction]',
    `uses:[${maxUses}/${maxUses}]`,
    'armed:[on]'
  ];

  // Process macros
  const primaryProcessed = processMacro(primaryMacro);
  if (primaryProcessed) parts.push(`primaryMacro:[${primaryProcessed}]`);
  
  const successProcessed = processMacro(successMacro);
  if (successProcessed) parts.push(`successMacro:[${successProcessed}]`);
  
  const failureProcessed = processMacro(failureMacro);
  if (failureProcessed) parts.push(`failureMacro:[${failureProcessed}]`);

  // Process checks
  const checks = [];
  if (check1Type && check1Type.toLowerCase() !== 'none') {
    const dc1 = parseInt(check1DC, 10);
    if (isNaN(dc1)) {
      TrapUtils.chat('❌ First check DC must be a number.');
      return;
    }
    checks.push(`${check1Type.trim()}:${dc1}`);
  }
  if (check2Type && check2Type.toLowerCase() !== 'none') {
    const dc2 = parseInt(check2DC, 10);
    if (isNaN(dc2)) {
      TrapUtils.chat('❌ Second check DC must be a number.');
      return;
    }
    checks.push(`${check2Type.trim()}:${dc2}`);
  }
  if (checks.length > 0) {
    parts.push(`checks:[${checks.join(';')}]`);
  }

  const movementEnabled = (typeof movementTriggerEnabled === 'string' && movementTriggerEnabled.toLowerCase() === 'true') || movementTriggerEnabled === true;
  parts.push(`movementTrigger:[${movementEnabled ? 'on' : 'off'}]`);
  
  const autoEnabled = (typeof autoTriggerEnabled === 'string' && autoTriggerEnabled.toLowerCase() === 'true') || autoTriggerEnabled === true;
  parts.push(`autoTrigger:[${autoEnabled ? 'on' : 'off'}]`);
  parts.push(`position:[${positionValue}]`);

  const newBlock = `{!traptrigger ${parts.join(' ')}}`;
  const finalNotes = `${newBlock} ${existingDetection}`.trim();

  try {
    const encoded = encodeURIComponent(finalNotes);
    token.set({
      gmnotes: encoded,
      aura1_radius: TrapUtils.calculateDynamicAuraRadius(token),
      aura1_color: Config.AURA_COLORS.ARMED,
      showplayers_aura1: false,
      bar1_value: maxUses,
      bar1_max: maxUses,
      showplayers_bar1: false
    });
    getTrapStatus(token);
  } catch (e) {
    TrapUtils.chat('❌ Error setting trap properties.');
    TrapUtils.log(`setupInteractionTrap error: ${e.message}`, 'error');
  }
}

export const triggers = {
  toggleTrap,
  getTrapStatus,
  manualTrigger,
  manualMacroTrigger,
  setupTrap,
  setupInteractionTrap
};

export default triggers;