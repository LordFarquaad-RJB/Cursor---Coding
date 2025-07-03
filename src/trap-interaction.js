// src/trap-interaction.js
// Interaction logic (menus, skill checks) for trap system

import TrapUtils from './trap-utils.js';
import { Config, State } from './trap-core.js';

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

// Handle main interaction commands (trigger, explain, fail)
function handleInteraction(token, action, playerid, triggeredTokenId = null) {
  TrapUtils.log(`handleInteraction: ${token.id}, action:${action}, playerid:${playerid}, victim:${triggeredTokenId}`, 'debug');
  const config = TrapUtils.parseTrapNotes(token.get('gmnotes'), token);
  if (!config || config.type !== 'interaction') {
    TrapUtils.log('Invalid config or not interaction type', 'debug');
    return;
  }

  const trappedToken = getObj('graphic', triggeredTokenId);
  const tagToIdMap = TrapUtils.buildTagToIdMap(token, trappedToken, null);

  switch (action) {
    case 'trigger':
      if (config.primaryMacro && config.primaryMacro.macro) {
        if (trappedToken) {
          // Mark triggered for later use depletion
          markTriggered(trappedToken.id, token.id, 'primary');
        } else {
          // Manual trigger - just execute macro
          TrapUtils.executeMacro(config.primaryMacro.macro, tagToIdMap);
        }
      } else {
        TrapUtils.chat('⚠️ No Primary Macro defined. Proceeding to skill check menu.');
      }
      
      // Check if this is a simple fire-and-forget trap
      if (config.primaryMacro && !config.successMacro && !config.failureMacro) {
        TrapUtils.log(`Primary-only interaction trap triggered. Resolving immediately.`, 'info');
        if (trappedToken) {
          allowMovement(triggeredTokenId, true);
          TrapUtils.chat(`✅ Trap '${token.get('name')}' triggered and resolved.`);
        } else {
          // Manual trigger - deplete use directly
          const newUses = Math.max(0, config.currentUses - 1);
          TrapUtils.updateTrapUses(token, newUses, config.maxUses, newUses > 0);
          if (newUses <= 0) {
            TrapUtils.chat('💥 Trap depleted.');
          }
        }
        return;
      }
      
      if (trappedToken) {
        showGMResponseMenu(token, playerid, triggeredTokenId);
      } else {
        showCharacterSelectionMenu(token, playerid, triggeredTokenId);
      }
      break;

    case 'fail':
      TrapUtils.log(`Executing failure macro: ${config.failureMacro}`, 'debug');
      if (config.failureMacro) {
        TrapUtils.executeMacro(config.failureMacro, tagToIdMap);
      }
      break;

    case 'explain':
      // Smart path - try to auto-detect character
      if (trappedToken) {
        const charId = trappedToken.get('represents');
        if (charId) {
          const success = prepareSkillCheckState(token, playerid, triggeredTokenId, charId);
          if (success) {
            showGMResponseMenu(token, playerid, triggeredTokenId);
            return;
          }
        }
      }
      // Fallback to manual character selection
      showCharacterSelectionMenu(token, playerid, triggeredTokenId);
      break;
  }
}

// Prepare skill check state for a character
function prepareSkillCheckState(trapToken, gmPlayerId, triggeredTokenId, characterId) {
  if (!trapToken || !gmPlayerId || !triggeredTokenId || !characterId) {
    TrapUtils.log('prepareSkillCheckState: missing arguments', 'error');
    return false;
  }

  const char = getObj('character', characterId);
  if (!char) {
    TrapUtils.log(`Character ${characterId} not found`, 'error');
    return false;
  }

  if (!State.pendingChecks[gmPlayerId]) {
    State.pendingChecks[gmPlayerId] = {};
  }
  
  State.pendingChecks[gmPlayerId].token = trapToken;
  State.pendingChecks[gmPlayerId].playerid = gmPlayerId;
  State.pendingChecks[gmPlayerId].characterId = characterId;
  State.pendingChecks[gmPlayerId].characterName = char.get('name');
  State.pendingChecks[gmPlayerId].triggeredTokenId = triggeredTokenId;
  
  if (State.pendingChecksByChar) {
    State.pendingChecksByChar[characterId] = { ...State.pendingChecks[gmPlayerId] };
  }

  TrapUtils.log(`Skill check state prepared for ${char.get('name')}`, 'debug');
  return true;
}

// Show character selection menu
function showCharacterSelectionMenu(token, playerid, triggeredTokenId = null) {
  const characters = findObjs({ _type: 'character' });
  const tokenName = token.get('name') || 'Unknown Token';
  const iconUrl = TrapUtils.getTokenImageURL(token);
  const tokenIcon = iconUrl === '👤' ? '👤' : `<img src="${iconUrl}" width="20" height="20">`;

  let menu = `&{template:default} {{name=Select Character for Skill Check}}`;
  menu += `{{Token=${tokenIcon} **${tokenName}**}}`;
  menu += `{{Characters=`;

  // Filter to player-controlled characters only
  const filtered = characters.filter(char => {
    const controlledBy = (char.get('controlledby') || '').split(',');
    return controlledBy.some(pid => pid && !TrapUtils.playerIsGM(pid));
  });

  filtered.forEach(char => {
    const charName = char.get('name');
    const charId = char.id;
    menu += `[${charName}](!trapsystem selectcharacter ${token.id} ${charId} ${playerid} ${triggeredTokenId || ''}) `;
  });

  menu += `}}`;
  TrapUtils.chat(menu);
}

// Handle skill check setup and display
function handleSkillCheck(token, checkIndex, playerid, hideDisplayDCButton = false, hideSetDCButton = false, whisperTo = 'gm', triggeredTokenId = null) {
  TrapUtils.log(`handleSkillCheck: ${token.id}, checkIndex:${checkIndex}, playerid:${playerid}`, 'debug');
  const config = TrapUtils.parseTrapNotes(token.get('gmnotes'), token);
  if (!config || !config.checks || (checkIndex !== 'custom' && checkIndex >= config.checks.length)) {
    TrapUtils.log('Invalid config or checkIndex', 'debug');
    return;
  }

  const check = (checkIndex === 'custom' && State.pendingChecks[playerid]?.config?.checks[0])
    ? State.pendingChecks[playerid].config.checks[0]
    : config.checks[checkIndex];

  if (!check) {
    TrapUtils.log('Check object not found', 'debug');
    return;
  }

  const tokenName = token.get('name') || 'Unknown Token';
  const iconUrl = TrapUtils.getTokenImageURL(token);
  const tokenIcon = iconUrl === '👤' ? '👤' : `<img src="${iconUrl}" width="20" height="20">`;
  const emoji = Config.SKILL_TYPES[check.type] || '🎲';
  const skillType = check.type.replace(/_/g, ' ');

  const existingCheck = State.pendingChecks[playerid] || {};

  // Get character details from triggered token
  let charId = existingCheck.characterId || null;
  let charName = existingCheck.characterName || null;
  if (triggeredTokenId && !charId) {
    const victimToken = getObj('graphic', triggeredTokenId);
    if (victimToken) {
      const victimCharId = victimToken.get('represents');
      if (victimCharId) {
        const victimChar = getObj('character', victimCharId);
        if (victimChar) {
          charId = victimChar.id;
          charName = victimChar.get('name');
        }
      }
    }
  }

  const pendingCheck = {
    token: token,
    checkIndex: checkIndex,
    config: { ...config, checks: [check] },
    advantage: null,
    firstRoll: null,
    playerid: playerid,
    characterId: charId,
    characterName: charName,
    triggeredTokenId: triggeredTokenId || existingCheck.triggeredTokenId
  };
  
  State.pendingChecks[playerid] = pendingCheck;
  if (pendingCheck.characterId) {
    State.pendingChecksByChar[pendingCheck.characterId] = pendingCheck;
  }

  const triggeredTokenParam = pendingCheck.triggeredTokenId ? ` ${pendingCheck.triggeredTokenId}` : '';

  let menu = `&{template:default} {{name=${emoji} ${skillType} Check (DC ${check.dc})}}`;
  menu += `{{Token=${tokenIcon} **${tokenName}**}}`;
  menu += `{{Roll=`;
  menu += `[Advantage](!trapsystem rollcheck ${token.id} ${checkIndex} advantage ${playerid}${triggeredTokenParam}) | `;
  menu += `[Normal](!trapsystem rollcheck ${token.id} ${checkIndex} normal ${playerid}${triggeredTokenParam}) | `;
  menu += `[Disadvantage](!trapsystem rollcheck ${token.id} ${checkIndex} disadvantage ${playerid}${triggeredTokenParam})`;

  if (!hideSetDCButton && checkIndex !== 'custom') {
    menu += ` | [Set DC](!trapsystem setdc ${token.id} ?{New DC|${check.dc}} ${playerid} ${check.type.replace(/ /g, '_')}${triggeredTokenParam})`;
  }
  if (!hideDisplayDCButton && !State.displayDCForCheck[playerid]) {
    menu += ` | [Display DC](!trapsystem displaydc ${token.id} ${checkIndex} ${playerid})`;
  }
  menu += `}}`;
  
  if (whisperTo === 'gm') {
    TrapUtils.chat(menu);
  } else {
    sendChat('TrapSystem', menu);
  }
}

// Handle roll check (advantage/normal/disadvantage)
function handleRollCheck(token, checkIndex, advantage, playerid, modifier = 0, triggeredTokenId = null) {
  TrapUtils.log(`handleRollCheck: ${token.id}, advantage:${advantage}, playerid:${playerid}`, 'debug');
  const config = TrapUtils.parseTrapNotes(token.get('gmnotes'), token);
  if (!config) return;

  const check = checkIndex === 'custom'
    ? State.pendingChecks[playerid]?.config.checks[0]
    : config.checks[checkIndex];
  if (!check) return;

  const tokenName = token.get('name') || 'Unknown Token';
  const iconUrl = TrapUtils.getTokenImageURL(token);
  const tokenIcon = iconUrl === '👤' ? '👤' : `<img src="${iconUrl}" width="20" height="20">`;
  const emoji = Config.SKILL_TYPES[check.type] || '🎲';
  const skillType = check.type.replace(/_/g, ' ');

  const existingCheck = State.pendingChecks[playerid] || {};

  const pendingCheck = {
    token: token,
    checkIndex: checkIndex,
    config: { ...config, checks: [check] },
    advantage: advantage,
    firstRoll: null,
    playerid: playerid,
    characterId: existingCheck.characterId,
    characterName: existingCheck.characterName,
    triggeredTokenId: triggeredTokenId
  };

  State.pendingChecks[playerid] = pendingCheck;
  if (pendingCheck.characterId) {
    State.pendingChecksByChar[pendingCheck.characterId] = pendingCheck;
  }

  let rollInstructions = '';
  let rollNote = '';
  if (advantage === 'advantage') {
    rollInstructions = 'Roll with advantage';
    rollNote = 'Using the higher of two rolls';
  } else if (advantage === 'disadvantage') {
    rollInstructions = 'Roll with disadvantage';
    rollNote = 'Using the lower of two rolls';
  } else {
    rollInstructions = 'Roll normally';
  }

  const showDC = State.displayDCForCheck[playerid] === true;
  let menu = `&{template:default} {{name=${emoji} Skill Check Required}}`;
  menu += `{{Token=${tokenIcon} **${tokenName}**}}`;
  menu += `{{Skill=${skillType}}}`;
  if (showDC) menu += `{{DC=${check.dc}}}`;
  menu += `{{Roll Type=${advantage.charAt(0).toUpperCase() + advantage.slice(1)}}}`;
  if (advantage !== 'normal') {
    menu += `{{Instructions=${rollInstructions}}}`;
    menu += `{{Note=${rollNote}}}`;
  } else {
    menu += `{{Instructions=Roll 1d20 using your character sheet or /roll 1d20}}`;
  }
  sendChat('TrapSystem', menu);
}

// Show GM response menu after action
function showGMResponseMenu(token, playerid, triggeredTokenId = null) {
  const config = TrapUtils.parseTrapNotes(token.get('gmnotes'), token);
  const tokenName = token.get('name') || 'Unknown Token';
  const iconUrl = TrapUtils.getTokenImageURL(token);
  const tokenIcon = iconUrl === '👤' ? '👤' : `<img src="${iconUrl}" width="20" height="20">`;
  
  let menu = `&{template:default} {{name=GM Response}}`;
  menu += `{{Token=${tokenIcon} **${tokenName}**}}`;
  menu += `{{Action=💭 Explained Action}}`;

  let quickActions = [
    `[✅ Allow Action](!trapsystem allow ${token.id} ${playerid} ${triggeredTokenId || ''})`
  ];

  if (config.failureMacro) {
    quickActions.push(`[❌ Fail Action](!trapsystem fail ${token.id} ${playerid} ${triggeredTokenId || ''})`);
  }

  if (config.checks && config.checks.length > 0) {
    config.checks.forEach((check, index) => {
      const emoji = Config.SKILL_TYPES[check.type] || '🎲';
      quickActions.push(`[${emoji} ${check.type}](!trapsystem check ${token.id} ${index} ${playerid} ${triggeredTokenId || ''})`);
    });
  }

  menu += `{{Quick Actions=${quickActions.join(' | ')}}}`;
  TrapUtils.chat(menu);
}

// Handle allow action (success)
function handleAllowAction(token, playerid, triggeredTokenId = null) {
  const config = TrapUtils.parseTrapNotes(token.get('gmnotes'), token);
  if (config && config.successMacro) {
    const trappedToken = getObj('graphic', triggeredTokenId);
    const tagToIdMap = TrapUtils.buildTagToIdMap(token, trappedToken);
    TrapUtils.executeMacro(config.successMacro, tagToIdMap);
    
    const macroString = config.successMacro.trim();
    if (macroString.startsWith('!') || macroString.startsWith('$') || macroString.startsWith('#')) {
      TrapUtils.whisper(playerid, `✅ Success macro executed.`);
    }
  } else {
    TrapUtils.whisper(playerid, '⚠️ No success macro defined.');
  }

  // Resolve trap state
  if (triggeredTokenId && State.lockedTokens[triggeredTokenId]) {
    State.lockedTokens[triggeredTokenId].macroTriggered = true;
    allowMovement(triggeredTokenId);
  } else {
    // Manual interaction - deplete use
    const trapData = TrapUtils.parseTrapNotes(token.get('gmnotes'), token);
    if (trapData && trapData.currentUses > 0) {
      const newUses = trapData.currentUses - 1;
      TrapUtils.updateTrapUses(token, newUses, trapData.maxUses, newUses > 0);
      if (newUses <= 0) {
        TrapUtils.chat('💥 Trap depleted.');
      }
    }
  }
}

// Handle fail action
function handleFailAction(token, playerid, triggeredTokenId = null) {
  const config = TrapUtils.parseTrapNotes(token.get('gmnotes'), token);
  if (config && config.failureMacro) {
    const trappedToken = getObj('graphic', triggeredTokenId);
    const tagToIdMap = TrapUtils.buildTagToIdMap(token, trappedToken);
    TrapUtils.executeMacro(config.failureMacro, tagToIdMap);
    
    const macroString = config.failureMacro.trim();
    if (macroString.startsWith('!') || macroString.startsWith('$') || macroString.startsWith('#')) {
      TrapUtils.whisper(playerid, `❌ Failure macro executed.`);
    }
  } else {
    TrapUtils.whisper(playerid, '⚠️ No failure macro defined.');
  }

  // Resolve trap state
  if (triggeredTokenId && State.lockedTokens[triggeredTokenId]) {
    State.lockedTokens[triggeredTokenId].macroTriggered = true;
    allowMovement(triggeredTokenId);
  } else {
    // Manual interaction - deplete use
    const trapData = TrapUtils.parseTrapNotes(token.get('gmnotes'), token);
    if (trapData && trapData.currentUses > 0) {
      const newUses = trapData.currentUses - 1;
      TrapUtils.updateTrapUses(token, newUses, trapData.maxUses, newUses > 0);
      if (newUses <= 0) {
        TrapUtils.chat('💥 Trap depleted.');
      }
    }
  }
}

// Stub functions for movement/lock management (will be migrated later)
function markTriggered(tokenId, trapId, macroIdentifier) {
  TrapUtils.log(`markTriggered: ${tokenId}, ${trapId}, ${macroIdentifier}`, 'debug');
  // This will be fully implemented when we migrate the movement system
}

function allowMovement(tokenId, suppressMessage = false) {
  TrapUtils.log(`allowMovement: ${tokenId}`, 'debug');
  // This will be fully implemented when we migrate the movement system
}

export const interaction = {
  performSkillCheck,
  handleDetectionAttempt,
  handleDisarmAttempt,
  getNearbyCharacters,
  showInteractionMenu,
  processInteractionCommand,
  handleInteraction,
  prepareSkillCheckState,
  showCharacterSelectionMenu,
  handleSkillCheck,
  handleRollCheck,
  showGMResponseMenu,
  handleAllowAction,
  handleFailAction
};

export default interaction;