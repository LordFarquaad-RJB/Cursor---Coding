// src/trap-ui.js
// Chat/menu rendering utilities.

import TrapUtils from './trap-utils.js';
import { Config } from './trap-core.js';

function buildDefaultTemplate(sections) {
  // sections: array of strings already formatted like "name=..." or "Token=..."
  return `&{template:default} {{${sections.join('}} {{')}}}`;
}

function sendGM(menuString) {
  TrapUtils.chat(menuString);
}

// Build a trap status menu with current configuration
function buildTrapStatusMenu(trapToken) {
  if (!trapToken) return null;
  
  const legacyUtils = globalThis.TrapSystem && globalThis.TrapSystem.utils;
  if (!legacyUtils || typeof legacyUtils.parseTrapNotes !== 'function') {
    return 'Legacy utilities not available';
  }
  
  const trapData = legacyUtils.parseTrapNotes(trapToken.get('gmnotes'), trapToken);
  if (!trapData) return 'Invalid trap configuration';
  
  const tokenImage = TrapUtils.getTokenImageURL(trapToken, 'thumb');
  const statusEmoji = trapData.isArmed ? '🔴' : '🟢';
  const usesText = trapData.currentUses > 0 ? `${trapData.currentUses}/${trapData.maxUses}` : 'Depleted';
  
  const sections = [
    `name=${statusEmoji} ${trapData.name || 'Unnamed Trap'}`,
    `Token=<img src="${tokenImage}" style="width:40px;height:40px;">`,
    `Status=${trapData.isArmed ? 'Armed' : 'Disarmed'}`,
    `Uses=${usesText}`,
    `DC=${trapData.dc || 'N/A'}`,
    `Type=${trapData.triggerType || 'Unknown'}`,
    `Actions=[Toggle](!trapsystem toggle @{selected|token_id}) [Edit](!trapsystem edit @{selected|token_id})`
  ];
  
  return buildDefaultTemplate(sections);
}

// Build a skill check menu
function buildSkillCheckMenu(characterToken, trapToken, skillType = 'Investigation') {
  if (!characterToken || !trapToken) return null;
  
  const charImage = TrapUtils.getTokenImageURL(characterToken, 'thumb');
  const trapImage = TrapUtils.getTokenImageURL(trapToken, 'thumb');
  const skillEmoji = Config.SKILL_TYPES[skillType] || '🎲';
  
  const sections = [
    `name=${skillEmoji} ${skillType} Check`,
    `Character=<img src="${charImage}" style="width:30px;height:30px;"> ${characterToken.get('name')}`,
    `Target=<img src="${trapImage}" style="width:30px;height:30px;"> Trap`,
    `Roll=[${skillType}](!roll 1d20+@{selected|${skillType.toLowerCase()}_mod} vs DC ?{DC|15})`,
    `Actions=[Auto-Resolve](!trapsystem skill-check ${characterToken.id} ${trapToken.id} ${skillType})`
  ];
  
  return buildDefaultTemplate(sections);
}

// Build an interaction menu for a trap
function buildInteractionMenu(trapToken, characterTokens = []) {
  if (!trapToken) return null;
  
  const legacyUtils = globalThis.TrapSystem && globalThis.TrapSystem.utils;
  if (!legacyUtils || typeof legacyUtils.parseTrapNotes !== 'function') {
    return 'Legacy utilities not available';
  }
  
  const trapData = legacyUtils.parseTrapNotes(trapToken.get('gmnotes'), trapToken);
  if (!trapData) return 'Invalid trap configuration';
  
  const trapImage = TrapUtils.getTokenImageURL(trapToken, 'thumb');
  const statusEmoji = trapData.isArmed ? '🔴' : '🟢';
  
  const characterList = characterTokens.map(token => 
    `<img src="${TrapUtils.getTokenImageURL(token, 'thumb')}" style="width:20px;height:20px;"> ${token.get('name')}`
  ).join('<br>');
  
  const sections = [
    `name=${statusEmoji} Trap Interaction`,
    `Trap=<img src="${trapImage}" style="width:40px;height:40px;"> ${trapData.name || 'Unnamed'}`,
    `Characters=${characterList || 'None nearby'}`,
    `Detection=[Perception Check](!trapsystem perception-check @{selected|token_id} ${trapToken.id})`,
    `Disarm=[Disable Check](!trapsystem disable-check @{selected|token_id} ${trapToken.id})`,
    `Actions=[Trigger Manually](!trapsystem trigger ${trapToken.id}) [Reset](!trapsystem reset ${trapToken.id})`
  ];
  
  return buildDefaultTemplate(sections);
}

// Send a formatted error message
function sendError(message, recipient = 'gm') {
  const errorMsg = `❌ **Error:** ${message}`;
  if (recipient === 'gm') {
    TrapUtils.chat(errorMsg);
  } else {
    TrapUtils.whisper(recipient, errorMsg);
  }
}

// Send a formatted success message
function sendSuccess(message, recipient = 'gm') {
  const successMsg = `✅ **Success:** ${message}`;
  if (recipient === 'gm') {
    TrapUtils.chat(successMsg);
  } else {
    TrapUtils.whisper(recipient, successMsg);
  }
}

// Send a formatted info message
function sendInfo(message, recipient = 'gm') {
  const infoMsg = `ℹ️ **Info:** ${message}`;
  if (recipient === 'gm') {
    TrapUtils.chat(infoMsg);
  } else {
    TrapUtils.whisper(recipient, infoMsg);
  }
}

export const ui = {
  buildDefaultTemplate,
  sendGM,
  buildTrapStatusMenu,
  buildSkillCheckMenu,
  buildInteractionMenu,
  sendError,
  sendSuccess,
  sendInfo
};

export default ui;