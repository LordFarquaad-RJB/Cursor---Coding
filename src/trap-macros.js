// src/trap-macros.js
// Macro execution & export logic

import TrapUtils from './trap-utils.js';
import { Config, State } from './trap-core.js';

// Create TrapSystem reference for compatibility
const TrapSystem = {
    state: State,
    config: Config,
    utils: TrapUtils
};

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

export const macroExport = {
    // --- State Capturing ---
    captureTokenState(token) {
        const tokenType = token.get("_type");
        let state = {
            layer: token.get("layer"),
            gmnotes: token.get("gmnotes"),
            name: token.get("name")
        };

        if (tokenType === "graphic") {
            Object.assign(state, {
                left: token.get("left"),
                top: token.get("top"),
                width: token.get("width"),
                height: token.get("height"),
                rotation: token.get("rotation"),
                fliph: token.get("fliph"),
                flipv: token.get("flipv"),
                aura1_radius: token.get("aura1_radius"),
                aura1_color: token.get("aura1_color"),
                aura1_square: token.get("aura1_square"),
                aura2_radius: token.get("aura2_radius"),
                aura2_color: token.get("aura2_color"),
                aura2_square: token.get("aura2_square"),
                tint_color: token.get("tint_color"),
                statusmarkers: token.get("statusmarkers"),
                bar1_value: token.get("bar1_value"),
                bar1_max: token.get("bar1_max"),
                bar2_value: token.get("bar2_value"),
                bar2_max: token.get("bar2_max"),
                bar3_value: token.get("bar3_value"),
                bar3_max: token.get("bar3_max"),
                light_radius: token.get("light_radius"),
                light_dimradius: token.get("light_dimradius"),
                light_otherplayers: token.get("light_otherplayers"),
                light_hassight: token.get("light_hassight"),
                light_angle: token.get("light_angle"),
                light_losangle: token.get("light_losangle"),
                light_multiplier: token.get("light_multiplier"),
                adv_fow_view_distance: token.get("adv_fow_view_distance"),
                imgsrc: token.get("imgsrc")
            });
        } else if (tokenType === "pathv2") {
            Object.assign(state, {
                path: token.get("path"),
                fill: token.get("fill"),
                stroke: token.get("stroke"),
                stroke_width: token.get("stroke_width"),
                left: token.get("left"),
                top: token.get("top"),
                width: token.get("width"),
                height: token.get("height"),
                scaleX: token.get("scaleX"),
                scaleY: token.get("scaleY"),
                rotation: token.get("rotation")
            });
        }

        TrapSystem.state.macroExportStates[token.id] = state;
        TrapSystem.utils.log(`Captured state for ${tokenType} ${token.id}.`, 'debug');
    },

    captureDoorObjectState(doorObj) {
        const doorType = doorObj.get("_type");
        if (doorType === "door" || doorType === "window") {
            TrapSystem.state.macroExportDoorStates[doorObj.id] = {
                isOpen: doorObj.get("isOpen"),
                isLocked: doorObj.get("isLocked"),
                isSecret: doorObj.get("isSecret")
            };
            TrapSystem.utils.log(`Captured door/window state for ${doorType} ${doorObj.id}.`, 'debug');
        }
    },

    // --- Macro Export ---
    exportMacros() {
        TrapSystem.utils.log("Starting macro export and state capture...", 'info');
        let macros = findObjs({ _type: "macro" });
        if (macros.length === 0) {
            TrapSystem.utils.log("No macros found to export.", 'warn');
            sendChat("TrapSystem", "/w gm ⚠️ No macros found to export.");
            return;
        }

        TrapSystem.state.macroExportedMacros = [];
        TrapSystem.state.macroExportStates = {}; // Clear previous states
        TrapSystem.state.macroExportDoorStates = {}; // Clear previous door states
        TrapSystem.state.macroExportTokensOrderedToFront = [];
        TrapSystem.state.macroExportTokensOrderedToBack = [];

        macros.forEach(macro => {
            let action = macro.get("action");
            if (!action) return;

            // Save macro info
            TrapSystem.state.macroExportedMacros.push({
                id: macro.id, // Store ID for easier lookup
                name: macro.get("name"),
                action: action
            });

            // Extract token IDs from TokenMod commands within macros
            // New regex to correctly handle token IDs that may contain '--'
            // and stop before the next TokenMod option (e.g., --set, --on) or end of string.
            const tokenModRegex = /!token-mod\s+--ids\s+([-\w\s]*?)(?=\s+--[a-zA-Z][-\w]*|$)/g;
            let match;
            while ((match = tokenModRegex.exec(action)) !== null) {
                const tokenIdsStr = match[1];
                if (tokenIdsStr) {
                    const tokenIDs = tokenIdsStr.split(/\s+/);
                    tokenIDs.forEach(id => {
                        // Check if it's a @{selected|token_id} or similar placeholder
                        if (id.startsWith("@{") && id.endsWith("}")) {
                            TrapSystem.utils.log(`Skipping placeholder ID in macro export: ${id}`, 'debug');
                            // Optionally, could try to resolve if 'selected' is known at export time, but risky.
                        } else {
                            const token = TrapSystem.utils.getObjectById(id);
                            if (token) {
                                this.captureTokenState(token);
                            } else {
                                TrapSystem.utils.log(`Token ID ${id} from macro not found during export.`, 'warn');
                            }
                        }
                    });
                }
            }

            // Extract door/window IDs from !door or !window commands
            const doorWindowRegex = /!(?:door|window)\s+([^\s]+)\s+(open|close|lock|unlock|reveal|hide|togglelock|togglesecret|toggleopen)/g;
            while ((match = doorWindowRegex.exec(action)) !== null) {
                const doorId = match[1];
                 if (doorId.startsWith("@{") && doorId.endsWith("}")) {
                    TrapSystem.utils.log(`Skipping placeholder ID in door/window command: ${doorId}`, 'debug');
                } else {
                    const doorObj = TrapSystem.utils.getObjectById(doorId);
                    if (doorObj && (doorObj.get("_type") === "door" || doorObj.get("_type") === "window")) {
                        this.captureDoorObjectState(doorObj);
                    } else {
                         TrapSystem.utils.log(`Door/Window ID ${doorId} from macro not found or not a door/window object.`, 'warn');
                    }
                }
            }
        });

        TrapSystem.state.macroExportRecordOrdering = true; // Start listening for manual ordering commands
        TrapSystem.utils.log("Macros exported and initial states captured.", 'success');
        sendChat("TrapSystem", "/w gm ✅ **Macros exported & initial states captured!** Subsequent `!token-mod --order` commands will be tracked for reset.");
    },

    // --- State Resetting ---
    resetTokenStates() {
        if (Object.keys(TrapSystem.state.macroExportStates).length === 0 &&
            Object.keys(TrapSystem.state.macroExportDoorStates).length === 0) {
            TrapSystem.utils.log("No token or door/window states to reset.", 'info');
            return false;
        }
        TrapSystem.utils.log("Resetting token and door/window states...", 'info');
        let resetCount = 0;

        // Reset general tokens and paths
        Object.keys(TrapSystem.state.macroExportStates).forEach(tokenID => {
            let token = TrapSystem.utils.getObjectById(tokenID);
            if (token) {
                let savedState = TrapSystem.state.macroExportStates[tokenID];
                let type = token.get("_type");
                let changes = {};
                // Common properties
                if (savedState.layer !== undefined) changes.layer = savedState.layer;
                if (savedState.gmnotes !== undefined) changes.gmnotes = savedState.gmnotes; // Restore GM notes
                if (savedState.name !== undefined) changes.name = savedState.name;

                if (type === "graphic") {
                    Object.assign(changes, {
                        left: savedState.left,
                        top: savedState.top,
                        width: savedState.width,
                        height: savedState.height,
                        rotation: savedState.rotation,
                        fliph: savedState.fliph,
                        flipv: savedState.flipv,
                        aura1_radius: savedState.aura1_radius ?? "",
                        aura1_color: savedState.aura1_color ?? "transparent",
                        aura1_square: savedState.aura1_square ?? false,
                        aura2_radius: savedState.aura2_radius ?? "",
                        aura2_color: savedState.aura2_color ?? "transparent",
                        aura2_square: savedState.aura2_square ?? false,
                        tint_color: savedState.tint_color ?? "transparent",
                        statusmarkers: savedState.statusmarkers ?? "",
                        bar1_value: savedState.bar1_value ?? null,
                        bar1_max: savedState.bar1_max ?? null,
                        bar2_value: savedState.bar2_value ?? null,
                        bar2_max: savedState.bar2_max ?? null,
                        bar3_value: savedState.bar3_value ?? null,
                        bar3_max: savedState.bar3_max ?? null,
                        light_radius: savedState.light_radius ?? "",
                        light_dimradius: savedState.light_dimradius ?? "",
                        light_otherplayers: savedState.light_otherplayers ?? false,
                        light_hassight: savedState.light_hassight ?? false,
                        light_angle: savedState.light_angle ?? "360",
                        light_losangle: savedState.light_losangle ?? "360",
                        light_multiplier: savedState.light_multiplier ?? "1",
                        adv_fow_view_distance: savedState.adv_fow_view_distance ?? "",
                       // imgsrc: savedState.imgsrc // Be cautious with imgsrc if tokens might be deleted/recreated
                    });
                     if (savedState.imgsrc && token.get('imgsrc') !== savedState.imgsrc) {
                        changes.imgsrc = savedState.imgsrc; // Only set if different to avoid unnecessary changes
                    }
                } else if (type === "pathv2") {
                    Object.assign(changes, {
                        path: savedState.path,
                        fill: savedState.fill ?? "transparent",
                        stroke: savedState.stroke ?? "#000000",
                        stroke_width: savedState.stroke_width ?? 2,
                        // Path position/size needs to be handled by TokenMod or direct left/top/width/height
                        left: savedState.left, // Assuming these were captured for pathv2 as well
                        top: savedState.top,
                        width: savedState.width,
                        height: savedState.height,
                        scaleX: savedState.scaleX ?? 1,
                        scaleY: savedState.scaleY ?? 1,
                        rotation: savedState.rotation ?? 0
                    });
                }
                token.set(changes);
                TrapSystem.utils.log(`Reset ${type} ${tokenID} to saved state.`, 'debug');
                resetCount++;
            } else {
                TrapSystem.utils.log(`Token ${tokenID} not found during state reset.`, 'warn');
            }
        });

        // Reset Doors/Windows (which are also captured in macroExportStates now if they were in macros)
        // but we also have macroExportDoorStates for doors manipulated by !door commands specifically.
        // Let's ensure these are also reset if they exist.
        Object.keys(TrapSystem.state.macroExportDoorStates).forEach(doorID => {
            let door = TrapSystem.utils.getObjectById(doorID);
             if (door && (door.get("_type") === "door" || door.get("_type") === "window")) {
                let savedState = TrapSystem.state.macroExportDoorStates[doorID];
                // Only reset properties that were specifically captured for doors/windows
                let changes = {
                    isOpen: savedState.isOpen,
                    isLocked: savedState.isLocked,
                    isSecret: savedState.isSecret
                    // DO NOT attempt to set layer or other graphic-like properties here
                    // as they were not captured for doors/windows in getObjectState to avoid errors.
                };
                door.set(changes);
                TrapSystem.utils.log(`Reset ${door.get("_type")} ${doorID} to saved minimal state (open/locked/secret).`, 'debug');
                resetCount++;
            } else {
                TrapSystem.utils.log(`Door/Window ${doorID} not found during state reset.`, 'warn');
            }
        });


        // Restore Z-ordering
        if (TrapSystem.state.macroExportTokensOrderedToBack.length > 0) {
            sendChat("API", `!token-mod --ids ${TrapSystem.state.macroExportTokensOrderedToBack.join(" ")} --order toback`);
            TrapSystem.utils.log(`Sent TokenMod command to move ${TrapSystem.state.macroExportTokensOrderedToBack.length} token(s) to back.`, 'info');
            resetCount++; // Count as one operation
        }
        if (TrapSystem.state.macroExportTokensOrderedToFront.length > 0) {
            sendChat("API", `!token-mod --ids ${TrapSystem.state.macroExportTokensOrderedToFront.join(" ")} --order tofront`);
            TrapSystem.utils.log(`Sent TokenMod command to move ${TrapSystem.state.macroExportTokensOrderedToFront.length} token(s) to front.`, 'info');
            resetCount++; // Count as one operation
        }

        if (resetCount > 0) {
            TrapSystem.utils.log(`Successfully reset ${resetCount} token/door states.`, 'success');
        }
        
        // Clear the stored states after reset, similar to the old MacroExport script
        TrapSystem.state.macroExportStates = {};
        TrapSystem.state.macroExportDoorStates = {};
        TrapSystem.state.macroExportTokensOrderedToFront = [];
        TrapSystem.state.macroExportTokensOrderedToBack = [];
        TrapSystem.state.macroExportRecordOrdering = false;
        TrapSystem.utils.log("Cleared macro export states and stopped order recording after resetStates.", 'info');

        return resetCount > 0;
    },

    resetMacros() {
        if (TrapSystem.state.macroExportedMacros.length === 0) {
            TrapSystem.utils.log("No exported macros to reset.", 'info');
            return false;
        }
        TrapSystem.utils.log("Resetting macros to exported state...", 'info');
        let resetCount = 0;
        TrapSystem.state.macroExportedMacros.forEach(savedMacro => {
            const currentMacro = getObj("macro", savedMacro.id); // Find by ID
            if (currentMacro) {
                if (currentMacro.get("action") !== savedMacro.action) {
                    currentMacro.set({ action: savedMacro.action });
                    TrapSystem.utils.log(`Reset macro "${savedMacro.name}" (ID: ${savedMacro.id}).`, 'debug');
                    resetCount++;
                }
            } else {
                // Optionally, recreate the macro if it was deleted
                // createObj('macro', { name: savedMacro.name, action: savedMacro.action, playerid: /* GM's ID or original player */ });
                // For now, just log if not found.
                TrapSystem.utils.log(`Macro "${savedMacro.name}" (ID: ${savedMacro.id}) not found during reset. It might have been deleted.`, 'warn');
            }
        });
        if (resetCount > 0) {
            TrapSystem.utils.log(`Successfully reset ${resetCount} macros.`, 'success');
        }
        return resetCount > 0;
    },

    fullReset() {
        TrapSystem.utils.log("Performing full reset of states and macros...", 'info');
        const statesReset = this.resetTokenStates(); // This will now clear its specific states
        const macrosReset = this.resetMacros();

        // Also clear the exported macros themselves on a full reset
        TrapSystem.state.macroExportedMacros = []; // Ensure this line is present
        TrapSystem.utils.log("Cleared stored macro action list after full reset.", 'info'); // Clarified log

        if (statesReset || macrosReset) {
            sendChat("TrapSystem", "/w gm ✅ **Full reset complete!** States and macros restored to exported versions.");
        } else {
            sendChat("TrapSystem", "/w gm ℹ️ Full reset: No states or macros needed resetting or were available to reset.");
        }
        // resetTokenStates now handles setting macroExportRecordOrdering to false.
        // The log about stopping recording is also fine here as a summary for fullReset.
        TrapSystem.utils.log("Full reset concluded. Order recording is off.", 'info');
    },

    // --- Token Order Listening ---
    processOrderCommand(msgContent) {
        if (!TrapSystem.state.macroExportRecordOrdering) return;

        let orderType = null;
        if (msgContent.includes("--order tofront")) orderType = 'tofront';
        else if (msgContent.includes("--order toback")) orderType = 'toback';

        if (orderType) {
            TrapSystem.utils.log(`Detected token-mod ${orderType} command: ${msgContent}`, 'debug');
            const idsMatch = msgContent.match(/--ids\s+([^\s]+(?:\s+[^\s]+)*)/);
            if (idsMatch && idsMatch[1]) {
                const tokenIDs = idsMatch[1].split(/\s+/);
                let targetArray = orderType === 'tofront' ?
                    TrapSystem.state.macroExportTokensOrderedToFront :
                    TrapSystem.state.macroExportTokensOrderedToBack;

                tokenIDs.forEach(id => {
                    if (id.startsWith("@{") && id.endsWith("}")) return; // Skip placeholders

                    // Add to the correct array, ensuring no duplicates within that array for this session
                    if (targetArray.indexOf(id) === -1) {
                        targetArray.push(id);
                        TrapSystem.utils.log(`Marked token ${id} as moved ${orderType}.`, 'debug');
                    }
                    // Remove from the other array if it was there (e.g., moved to back then to front)
                    let otherArray = orderType === 'tofront' ?
                        TrapSystem.state.macroExportTokensOrderedToBack :
                        TrapSystem.state.macroExportTokensOrderedToFront;
                    const indexInOther = otherArray.indexOf(id);
                    if (indexInOther > -1) {
                        otherArray.splice(indexInOther, 1);
                    }
                });
            }
        }
    }
};

export const macros = {
  buildTagToIdMap,
  replaceMacroPlaceholdersWithTags,
  executeMacro,
  executeTrapMacros,
  exportTrapAsMacro,
  exportMultipleTraps
};

export default macros;