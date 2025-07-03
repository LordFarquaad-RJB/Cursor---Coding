// Entry point that stitches the modular files together.
// For now we export an empty scaffold TrapSystem with utilities.

import { Config } from './trap-core.js';
import TrapUtils from './trap-utils.js';
import { triggers } from './trap-triggers.js';
import { MovementDetector } from './trap-detector.js';
import { PassiveDetection } from './trap-detection.js';
import { Commands } from './trap-commands.js';

// Placeholder imports – these modules will gradually be filled out.
import './trap-core.js';
import './trap-utils.js';
import detector from './trap-detector.js';
import interactionSystem from './trap-interaction.js';
import macroSystem from './trap-macros.js';
import uiSystem from './trap-ui.js';

const TrapSystem = {
  utils: TrapUtils,
  config: Config,
  state: Config.state,
  // Namespaces to be wired up in later phases
  core: { Config, state: Config.state },
  detection: {
    movement: detector,
    passive: PassiveDetection
  },
  macros: macroSystem,
  ui: uiSystem
};

// Global state for the TrapSystem v2
globalThis.TrapSystemV2 = {
    Config,
    TrapUtils,
    triggers,
    PassiveDetection,
    interactionSystem,
    MovementDetector,
    Commands
};

// Expose main API for Roll20
globalThis.TrapSystem = {
    state: Config.state,
    config: Config,
    utils: TrapUtils,
    triggers: triggers,
    menu: interactionSystem,
    detector: MovementDetector,
    passive: PassiveDetection,
    commands: Commands
};

// =====================================================================
// EVENT HANDLERS
// =====================================================================

// Main chat message handler
if (typeof on !== 'undefined') {
    on("chat:message", (msg) => {
        try {
            Commands.handleChatMessage(msg);
        } catch (error) {
            TrapUtils.log(`Error in chat message handler: ${error.message}`, 'error');
        }
    });

    // Token movement and change handler
    on("change:graphic", async (obj, prev) => {
        if (!obj || !prev) return;
        try {
            // Token Locking Logic - prevent locked tokens from moving
            if (Config.state.lockedTokens[obj.id] && (obj.get("left") !== prev.left || obj.get("top") !== prev.top)) {
                obj.set({ left: prev.left, top: prev.top });
                return;
            }

            // Movement Trigger Logic - check for trap triggers and passive detection
            if ((obj.get("left") !== prev.left || obj.get("top") !== prev.top) && !TrapUtils.isTrap(obj)) {
                // Run passive detection checks
                await PassiveDetection.runPassiveChecksForToken(obj);
                // Check for trap triggers
                await MovementDetector.checkTrapTrigger(obj, prev.left, prev.top);
            }

            // Ignore Traps Status Change - handle blue marker removal
            if (obj.get("statusmarkers") !== prev.statusmarkers) {
                const curMarkers = obj.get("statusmarkers") || "";
                const prevMarkers = prev.statusmarkers || "";
                if (prevMarkers.includes("blue") && !curMarkers.includes("blue")) {
                    let notes = obj.get("gmnotes") || "";
                    if (notes.includes("{ignoretraps}")) {
                        obj.set("gmnotes", notes.replace(/\{ignoretraps\}/g, ''));
                        TrapUtils.chat(`Removed ignoretraps tag from ${obj.get("name")||"token"} (blue marker removed)`);
                    }
                }
            }

            // Trap Token Changes - handle GM notes changes, movement, resizing
            const currentNotesRaw = obj.get("gmnotes") || "";
            const prevNotesRaw = prev.gmnotes || "";

            // Decode both notes to normalize them before comparison
            let currentNotes, prevNotes;
            try { currentNotes = decodeURIComponent(currentNotesRaw); } catch(e) { currentNotes = currentNotesRaw; }
            try { prevNotes = decodeURIComponent(prevNotesRaw); } catch(e) { prevNotes = prevNotesRaw; }

            const notesHaveChanged = prev.hasOwnProperty('gmnotes') && currentNotes !== prevNotes;
            const isCurrentlyTrap = currentNotes.includes("!traptrigger");
            const wasPreviouslyTrap = prevNotes ? prevNotes.includes("!traptrigger") : false;

            // GM Notes were changed
            if (notesHaveChanged) {
                if (wasPreviouslyTrap && !isCurrentlyTrap) {
                    // Trap config removed - clean up visuals
                    TrapUtils.log(`Trap config removed from ${obj.id}. Clearing visuals.`, 'info');
                    obj.set({
                        bar1_value: null, bar1_max: null, showplayers_bar1: false,
                        aura1_color: "transparent", aura1_radius: "", showplayers_aura1: false,
                        bar2_value: null, bar2_max: null, showplayers_bar2: false,
                        aura2_color: "transparent", aura2_radius: "", showplayers_aura2: false
                    });
                } else if (isCurrentlyTrap) {
                    // Parse and update trap visuals
                    TrapUtils.parseTrapNotes(currentNotesRaw, obj);
                    PassiveDetection.updateAuraForDetectionRange(obj);
                }
            }
            
            // Trap token movement, resizing, or rotation
            if (isCurrentlyTrap) {
                const sizeChanged = obj.get("width") !== prev.width || obj.get("height") !== prev.height;
                const positionOrRotationChanged = obj.get("left") !== prev.left || obj.get("top") !== prev.top || obj.get("rotation") !== prev.rotation;

                if (sizeChanged) {
                    // Recalculate auras for resized trap
                    obj.set({ aura1_radius: TrapUtils.calculateDynamicAuraRadius(obj) });
                    PassiveDetection.updateAuraForDetectionRange(obj);
                }

                if ((sizeChanged || positionOrRotationChanged) && Object.values(Config.state.lockedTokens).some(lock => lock.trapToken === obj.id)) {
                    // Update positions of tokens locked to this trap
                    for (const lockedTokenId in Config.state.lockedTokens) {
                        const lockData = Config.state.lockedTokens[lockedTokenId];
                        if (lockData.trapToken === obj.id) {
                            const lockedToken = getObj("graphic", lockedTokenId);
                            if (lockedToken && lockData.relativeOffset) {
                                const newTrapCenter = { x: obj.get('left'), y: obj.get('top') };
                                const newTrapRotationRad = (obj.get('rotation') || 0) * (Math.PI / 180);
                                const cosRad = Math.cos(newTrapRotationRad);
                                const sinRad = Math.sin(newTrapRotationRad);

                                const rotatedOffsetX = lockData.relativeOffset.x * cosRad - lockData.relativeOffset.y * sinRad;
                                const rotatedOffsetY = lockData.relativeOffset.x * sinRad + lockData.relativeOffset.y * cosRad;

                                lockedToken.set({
                                    left: newTrapCenter.x + rotatedOffsetX,
                                    top: newTrapCenter.y + rotatedOffsetY
                                });
                            }
                        }
                    }
                }
            }
        } catch (err) {
            TrapUtils.log(`Error in change:graphic handler: ${err.message}`, 'error');
        }
    });

    // Door opening events for passive detection
    on("change:door", (obj, prev) => {
        try {
            const wasJustOpened = obj.get('isOpen') && !prev.isOpen;
            if (wasJustOpened) {
                TrapUtils.log(`Modern door ${obj.id} was opened. Running passive checks for all tokens on page.`, 'info');
                PassiveDetection.runPageWidePassiveChecks(obj.get('_pageid'));
            }
        } catch (err) {
            TrapUtils.log(`Error in change:door handler: ${err.message}`, 'error');
        }
    });

    // Legacy door opening events
    on("change:path", (obj, prev) => {
        try {
            const isLegacyDoor = obj.get('layer') === 'walls' && typeof obj.get('door_open') !== 'undefined';
            if (isLegacyDoor) {
                const wasLegacyDoorOpened = obj.get('door_open') && !prev.door_open;
                if (wasLegacyDoorOpened) {
                    TrapUtils.log(`Legacy door ${obj.id} was opened. Running passive checks for all tokens on page.`, 'info');
                    PassiveDetection.runPageWidePassiveChecks(obj.get('_pageid'));
                }
            }
        } catch (err) {
            TrapUtils.log(`Error in change:path handler: ${err.message}`, 'error');
        }
    });

    // System ready handler
    on("ready", () => {
        TrapUtils.log("TrapSystem v2.0 Ready!", 'success');
        
        // Register with CommandMenu if available
        if (typeof CommandMenu !== 'undefined' && CommandMenu.utils && CommandMenu.utils.addInitStatus) {
            CommandMenu.utils.addInitStatus('TrapSystem', 'success', null, 'success');
        }
    });
}

console.log('📦 TrapSystem v2 scaffold loaded');
console.log('🔧 Config loaded:', Config.AURA_COLORS ? 'Complete' : 'Incomplete');
console.log('TrapSystem v2.0 loaded successfully!');

export { TrapSystem };