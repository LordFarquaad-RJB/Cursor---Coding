// src/trap-macros.js
// Macro execution & export logic

import TrapUtils from './trap-utils.js';
import { Config } from './trap-core.js';

// Build a tag-to-ID mapping for macro placeholder replacement
function buildTagToIdMap(tokens = []) {
  const tagMap = {};
  tokens.forEach(token => {
    if (!token) return;
    const name = token.get('name') || '';
    if (name.trim()) {
      const tag = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (tag) tagMap[tag] = token.id;
    }
  });
  return tagMap;
}

// Replace macro placeholders with actual token IDs
function replaceMacroPlaceholdersWithTags(macroString, tagMap = {}) {
  if (!macroString || typeof macroString !== 'string') return macroString;
  
  let processed = macroString;
  
  // Replace @{target|...} patterns
  processed = processed.replace(/@\{target\|([^}]+)\}/g, (match, property) => {
    return `@{target|${property}}`;
  });
  
  // Replace @{selected|...} patterns  
  processed = processed.replace(/@\{selected\|([^}]+)\}/g, (match, property) => {
    return `@{selected|${property}}`;
  });
  
  // Replace custom tags like @{goblin|token_id}
  Object.keys(tagMap).forEach(tag => {
    const regex = new RegExp(`@\\{${tag}\\|([^}]+)\\}`, 'gi');
    processed = processed.replace(regex, (match, property) => {
      if (property === 'token_id') {
        return tagMap[tag];
      }
      return `@{${tagMap[tag]}|${property}}`;
    });
  });
  
  return processed;
}

// Execute a macro string (delegates to Roll20's sendChat)
function executeMacro(macroString, characterName = 'TrapSystem') {
  if (!macroString || typeof macroString !== 'string') {
    TrapUtils.log('Cannot execute empty macro', 'error');
    return false;
  }
  
  try {
    // Handle different macro types
    if (macroString.startsWith('#')) {
      // Roll20 macro - remove # and execute
      const macroName = macroString.slice(1);
      sendChat(characterName, `#${macroName}`);
    } else if (macroString.startsWith('!')) {
      // API command
      sendChat(characterName, macroString);
    } else if (macroString.startsWith('&{')) {
      // Roll template
      sendChat(characterName, macroString);
    } else {
      // Regular chat message
      sendChat(characterName, macroString);
    }
    
    TrapUtils.log(`Executed macro: ${TrapUtils.getSafeMacroDisplayName(macroString)}`, 'success');
    return true;
  } catch (error) {
    TrapUtils.log(`Macro execution failed: ${error.message}`, 'error');
    return false;
  }
}

// Process and execute trap macros with token context
function executeTrapMacros(trapToken, macroList = [], targetTokens = []) {
  if (!trapToken || !Array.isArray(macroList)) return;
  
  const tagMap = buildTagToIdMap([trapToken, ...targetTokens]);
  
  macroList.forEach((macro, index) => {
    if (!macro) return;
    
    const processedMacro = replaceMacroPlaceholdersWithTags(macro, tagMap);
    
    // Add a small delay between macros to prevent spam
    setTimeout(() => {
      executeMacro(processedMacro, trapToken.get('name') || 'Trap');
    }, index * 100);
  });
}

// Export trap configuration as a macro
function exportTrapAsMacro(trapToken) {
  if (!TrapUtils.validateTrapToken(trapToken, 'exportTrapAsMacro')) return null;
  
  const legacyUtils = globalThis.TrapSystem && globalThis.TrapSystem.utils;
  if (!legacyUtils || typeof legacyUtils.parseTrapNotes !== 'function') {
    TrapUtils.log('Legacy utilities not available for export', 'error');
    return null;
  }
  
  const trapData = legacyUtils.parseTrapNotes(trapToken.get('gmnotes'), trapToken);
  if (!trapData) {
    TrapUtils.log('Invalid trap configuration for export', 'error');
    return null;
  }
  
  // Generate macro command to recreate this trap
  const macroCommand = `!trapsystem create-trap --name "${trapData.name || 'Exported Trap'}" --trigger "${trapData.triggerType || 'movement'}" --dc ${trapData.dc || 15}`;
  
  return {
    name: `Create: ${trapData.name || 'Trap'}`,
    command: macroCommand,
    description: `Creates a trap: ${trapData.name || 'Unnamed'}`
  };
}

// Batch export multiple traps
function exportMultipleTraps(trapTokens = []) {
  const exports = [];
  
  trapTokens.forEach(token => {
    const exported = exportTrapAsMacro(token);
    if (exported) exports.push(exported);
  });
  
  return exports;
}

export const macros = {
  buildTagToIdMap,
  replaceMacroPlaceholdersWithTags,
  executeMacro,
  executeTrapMacros,
  exportTrapAsMacro,
  exportMultipleTraps
};

export default macros;