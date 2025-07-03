// src/trap-interaction.js
// Interaction logic (menus, skill checks) for trap system

import TrapUtils from './trap-utils.js';
import { Config } from './trap-core.js';

// Perform a skill check against a trap
function performSkillCheck(characterToken, trapToken, skillType, rollResult = null) {
  if (!characterToken || !trapToken) {
    TrapUtils.log('Invalid tokens for skill check', 'error');
    return { success: false, message: 'Invalid parameters' };
  }
  
  const legacyUtils = globalThis.TrapSystem && globalThis.TrapSystem.utils;
  if (!legacyUtils || typeof legacyUtils.parseTrapNotes !== 'function') {
    return { success: false, message: 'Legacy utilities not available' };
  }
  
  const trapData = legacyUtils.parseTrapNotes(trapToken.get('gmnotes'), trapToken);
  if (!trapData) {
    return { success: false, message: 'Invalid trap configuration' };
  }
  
  // Get the appropriate DC for this skill type
  let dc = 15; // default
  switch (skillType.toLowerCase()) {
    case 'perception':
      dc = trapData.passivePerception || trapData.dc || 15;
      break;
    case 'investigation':
      dc = trapData.investigationDC || trapData.dc || 15;
      break;
    case 'sleight of hand':
    case 'thieves tools':
      dc = trapData.disarmDC || trapData.dc || 15;
      break;
    default:
      dc = trapData.dc || 15;
  }
  
  // If no roll result provided, we're just setting up the check
  if (rollResult === null) {
    return {
      success: true,
      dc: dc,
      skillType: skillType,
      message: `${skillType} check required (DC ${dc})`
    };
  }
  
  const success = rollResult >= dc;
  const margin = rollResult - dc;
  
  return {
    success: success,
    rollResult: rollResult,
    dc: dc,
    margin: margin,
    skillType: skillType,
    message: success 
      ? `${skillType} check succeeded! (${rollResult} vs DC ${dc}, margin: +${margin})`
      : `${skillType} check failed. (${rollResult} vs DC ${dc}, margin: ${margin})`
  };
}

// Handle trap detection attempt
function handleDetectionAttempt(characterToken, trapToken, rollResult = null) {
  const result = performSkillCheck(characterToken, trapToken, 'Perception', rollResult);
  
  if (result.success && rollResult !== null) {
    // Character successfully detected the trap
    const legacyUtils = globalThis.TrapSystem && globalThis.TrapSystem.utils;
    if (legacyUtils && typeof legacyUtils.updateTrapAura === 'function') {
      legacyUtils.updateTrapAura(trapToken, { isDetected: true });
    }
    
    TrapUtils.log(`${characterToken.get('name')} detected a trap!`, 'success');
    return { ...result, detected: true };
  }
  
  return { ...result, detected: false };
}

// Handle trap disarm attempt
function handleDisarmAttempt(characterToken, trapToken, rollResult = null) {
  const result = performSkillCheck(characterToken, trapToken, 'Sleight of Hand', rollResult);
  
  if (result.success && rollResult !== null) {
    // Character successfully disarmed the trap
    const legacyUtils = globalThis.TrapSystem && globalThis.TrapSystem.utils;
    if (legacyUtils && typeof legacyUtils.toggleTrap === 'function') {
      legacyUtils.toggleTrap(trapToken); // Disarm the trap
    }
    
    TrapUtils.log(`${characterToken.get('name')} disarmed the trap!`, 'success');
    return { ...result, disarmed: true };
  } else if (rollResult !== null && result.margin < -5) {
    // Critical failure - trigger the trap
    TrapUtils.log(`${characterToken.get('name')} triggered the trap while trying to disarm it!`, 'warning');
    
    const legacyUtils = globalThis.TrapSystem && globalThis.TrapSystem.utils;
    if (legacyUtils && typeof legacyUtils.triggerTrap === 'function') {
      legacyUtils.triggerTrap(trapToken, characterToken);
    }
    
    return { ...result, triggered: true };
  }
  
  return { ...result, disarmed: false, triggered: false };
}

// Get nearby characters for interaction
function getNearbyCharacters(trapToken, maxDistance = 30) {
  if (!trapToken) return [];
  
  const pageId = trapToken.get('_pageid');
  const allTokens = findObjs({ _type: 'graphic', _pageid: pageId });
  
  return allTokens.filter(token => {
    // Filter for character tokens (have represents field)
    if (!token.get('represents')) return false;
    
    // Check distance
    const distance = TrapUtils.geometry.calculateTokenDistance(trapToken, token);
    return distance.mapUnitDistance <= maxDistance;
  });
}

// Build and send interaction menu
function showInteractionMenu(trapToken, triggeredTokenId = null) {
  if (!trapToken) return;
  
  try {
    const tokenImgUrl = TrapUtils.getTokenImageURL(trapToken);
    const tokenImage = tokenImgUrl === '👤' 
      ? '👤' 
      : `<img src="${tokenImgUrl}" width="100" height="100" style="display: block; margin: 5px auto;">`;
    const tokenName = trapToken.get('name') || 'Unknown Object';
    const trapData = TrapUtils.parseTrapNotes(trapToken.get('gmnotes'));

    if (!trapData) {
      TrapUtils.log('Invalid trap configuration', 'error');
      return;
    }

    const menu = [
      '&{template:default}',
      `{{name=${tokenName}}}`,
      `{{Description=${tokenImage}}}`,
      `{{State=🎯 ${trapData.isArmed ? 'ARMED' : 'DISARMED'} (${trapData.currentUses}/${trapData.maxUses} uses)}}`
    ];

    // Action buttons section
    if (trapData.isArmed) {
      const triggerCmd = `!trapsystem interact ${trapToken.id} trigger ${triggeredTokenId || ''}`.trim();
      const explainCmd = `!trapsystem interact ${trapToken.id} explain ${triggeredTokenId || ''}`.trim();
      
      let actionButtons = [
        `[🎯 Trigger Action](${triggerCmd})`,
        `[💭 Explain Action](${explainCmd})`
      ];

      // Add "Allow Movement" button if token is locked by this trap
      if (triggeredTokenId) {
        // Check if token is locked (this will need to reference global state when available)
        const lockRecord = globalThis.TrapSystem?.state?.lockedTokens?.[triggeredTokenId];
        if (lockRecord && lockRecord.trapToken === trapToken.id && lockRecord.locked) {
          actionButtons.push(`[⏭️ Allow Move](!trapsystem allowmovement ${triggeredTokenId})`);
        }
      }
      menu.push(`{{Actions=${actionButtons.join(' | ')}}}`);
    }

    // Show trap info if checks exist
    if (trapData.checks && trapData.checks.length > 0) {
      const checkInfo = trapData.checks.map(check => 
        `${Config.SKILL_TYPES[check.type] || '🎲'} ${check.type} (DC ${check.dc})`
      ).join('<br>');
      menu.push(`{{Trap Info=Skill Check:<br>${checkInfo}}}`);
    }

    menu.push(`{{Management=[📊 Status](!trapsystem status ${trapToken.id}) | [🔄 Toggle](!trapsystem toggle ${trapToken.id})}}`);
    sendChat('TrapSystem', `/w gm ${menu.join(' ')}`);
  } catch (err) {
    TrapUtils.log(`Error showing interaction menu: ${err.message}`, 'error');
  }
}

// Process interaction command
function processInteractionCommand(command, args = []) {
  if (!TrapUtils.validateCommandArgs(args, 1, command)) return;
  
  const tokenId = args[0];
  const token = getObj('graphic', tokenId);
  
  if (!token) {
    TrapUtils.log(`Token ${tokenId} not found`, 'error');
    return;
  }
  
  switch (command.toLowerCase()) {
    case 'perception-check':
    case 'detect':
      if (args.length >= 2) {
        const trapId = args[1];
        const trapToken = getObj('graphic', trapId);
        if (trapToken) {
          const result = handleDetectionAttempt(token, trapToken);
          TrapUtils.log(result.message, result.success ? 'success' : 'info');
        }
      }
      break;
      
    case 'disable-check':
    case 'disarm':
      if (args.length >= 2) {
        const trapId = args[1];
        const trapToken = getObj('graphic', trapId);
        if (trapToken) {
          const result = handleDisarmAttempt(token, trapToken);
          TrapUtils.log(result.message, result.success ? 'success' : 'warning');
        }
      }
      break;
      
    case 'interact':
      if (TrapUtils.isTrap(token)) {
        showInteractionMenu(token);
      } else {
        TrapUtils.log('Selected token is not a trap', 'error');
      }
      break;
      
    default:
      TrapUtils.log(`Unknown interaction command: ${command}`, 'error');
  }
}

export const interaction = {
  performSkillCheck,
  handleDetectionAttempt,
  handleDisarmAttempt,
  getNearbyCharacters,
  showInteractionMenu,
  processInteractionCommand
};

export default interaction;