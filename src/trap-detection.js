// src/trap-detection.js
// Passive detection system for automatic trap discovery via perception checks

import TrapUtils from './trap-utils.js';
import { Config } from './trap-core.js';

export const PassiveDetection = {
    /**
     * Handle when a character notices a trap passively
     * @param {object} triggeringToken - The token that noticed the trap
     * @param {object} noticedTrap - The trap token that was noticed
     * @param {object} perceptionData - Object with finalPP, basePP, luckBonus
     * @param {object} trapConfig - The trap configuration
     * @param {number} distanceToTrap - Distance to the trap in map units
     */
    handlePassiveNotice(triggeringToken, noticedTrap, perceptionData, trapConfig, distanceToTrap) {
        const charId = triggeringToken.get('represents');
        const observerId = charId || triggeringToken.id;

        // Ensure passivelyNoticedTraps is initialized
        if (typeof Config.state.passivelyNoticedTraps !== 'object' || Config.state.passivelyNoticedTraps === null) {
            Config.state.passivelyNoticedTraps = {};
        }

        // Update state that this character has noticed this trap
        if (!Config.state.passivelyNoticedTraps[noticedTrap.id]) {
            Config.state.passivelyNoticedTraps[noticedTrap.id] = {};
        }
        Config.state.passivelyNoticedTraps[noticedTrap.id][observerId] = true;

        // Persistently mark the trap as detected in its notes
        let notes = noticedTrap.get("gmnotes");
        let decodedNotes = "";
        try { 
            decodedNotes = decodeURIComponent(notes); 
        } catch (e) { 
            decodedNotes = notes; 
        }

        // Update detection block to mark as detected
        const detectionBlockRegex = /\{!trapdetection\s+((?:(?!\{!}).)*)\}/;
        const match = decodedNotes.match(detectionBlockRegex);

        if (match && match[1] && !/detected:\s*\[on\]/.test(match[1])) {
            const originalFullBlock = match[0];
            const originalBlockContent = match[1];
            
            // Add the detected flag to the content
            const newBlockContent = originalBlockContent.trim() + ' detected:[on]';
            const newFullBlock = `{!trapdetection ${newBlockContent}}`;
            
            // Replace the old block with the new one in the notes
            const updatedNotes = decodedNotes.replace(originalFullBlock, newFullBlock);
            
            noticedTrap.set("gmnotes", encodeURIComponent(updatedNotes));
            // Re-parse the notes to get the most up-to-date config
            trapConfig = TrapUtils.parseTrapNotes(updatedNotes, noticedTrap, false);
        }

        // Update the trap's aura2 color to show it's been detected
        noticedTrap.set({
            aura2_color: Config.AURA_COLORS.DETECTED
        });

        const character = charId ? getObj('character', charId) : null;
        const observerName = character ? character.get('name') : triggeringToken.get('name') || "Unnamed Token";
        const trapName = noticedTrap.get('name') || 'Unnamed Trap';

        // Build placeholder replacements
        const placeholders = {
            '{charName}': observerName,
            '{trapName}': trapName,
            '{charPP}': String(perceptionData.finalPP),
            '{trapDC}': String(trapConfig.passiveSpotDC),
            '{distanceToTrap}': distanceToTrap.toFixed(1),
            '{luckBonus}': String(perceptionData.luckBonus),
            '{basePP}': String(perceptionData.basePP)
        };

        // Replace all placeholders in the message
        const replacePlaceholders = (str) => {
            if (!str) return '';
            let result = str;
            for (const [key, value] of Object.entries(placeholders)) {
                const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                result = result.replace(new RegExp(escapedKey, 'g'), value);
            }
            return result;
        };

        // Define message templates
        const PLAYER_MSG_TEMPLATE_NAME = "⚠️ Alert!";
        const PLAYER_MSG_PREFIX = `&{template:default} {{name=${PLAYER_MSG_TEMPLATE_NAME}}} {{message=`;
        
        // Get player's token image for GM message header
        const playerTokenImgUrl = TrapUtils.getTokenImageURL(triggeringToken, 'thumb');
        const playerTokenImage = playerTokenImgUrl === '👤' ? '' : `<img src='${playerTokenImgUrl}' width='30' height='30' style='vertical-align: middle; margin-left: 5px;'>`;
        const GM_MSG_TEMPLATE_NAME = `🎯 Passive Spot ${playerTokenImage}`;

        const GM_MSG_PREFIX = `&{template:default} {{name=${GM_MSG_TEMPLATE_NAME}}} {{message=`;
        const MSG_SUFFIX = "}}";

        const defaultPlayerMsgContent = Config.messages.defaults.playerNotice;
        const defaultGmMsgContent = Config.messages.defaults.gmNotice;

        // Build player message
        let playerMsgContent = trapConfig.passiveNoticePlayer || defaultPlayerMsgContent;
        let finalPlayerMsg = PLAYER_MSG_PREFIX + replacePlaceholders(playerMsgContent) + MSG_SUFFIX;
        
        // Get controlling players
        let controllingPlayerIds = [];
        if (character) {
            controllingPlayerIds = (character.get('controlledby') || "").split(',')
                .map(pid => pid.trim())
                .filter(pid => pid && !TrapUtils.playerIsGM(pid));
        } else {
            controllingPlayerIds = (triggeringToken.get('controlledby') || "").split(',')
                .map(pid => pid.trim())
                .filter(pid => pid && !TrapUtils.playerIsGM(pid));
        }

        // Debounce player messages
        const currentTime = Date.now();
        const debounceTime = Config.messages.passiveNoticeDebounceTime || 100000; // Default 100s

        if (!Config.state.recentlyNoticedPlayerMessages[charId]) {
            Config.state.recentlyNoticedPlayerMessages[charId] = [];
        }

        // Filter out old messages
        Config.state.recentlyNoticedPlayerMessages[charId] = Config.state.recentlyNoticedPlayerMessages[charId].filter(
            entry => (currentTime - entry.timestamp) < debounceTime
        );

        const alreadySentRecently = Config.state.recentlyNoticedPlayerMessages[charId].some(
            entry => entry.messageContent === finalPlayerMsg
        );

        if (alreadySentRecently) {
            TrapUtils.log(`Passive Notice SUPPRESSED for player(s) of ${observerName} (charId: ${charId}) - identical message sent recently`, 'debug');
        } else if (controllingPlayerIds.length > 0) {
            controllingPlayerIds.forEach(pid => {
                const player = getObj("player", pid);
                if (player) {
                    sendChat("TrapSystem", `/w "${player.get("displayname") || pid}" ${finalPlayerMsg}`);
                } else {
                    TrapUtils.log(`Passive Notice: Could not find player object for ID ${pid}`, 'warn');
                }
            });
            // Record this message as sent
            Config.state.recentlyNoticedPlayerMessages[charId].push({ 
                messageContent: finalPlayerMsg, 
                timestamp: currentTime 
            });
        } else {
            TrapUtils.chat(`⚠️ No players control '${observerName}', which would have spotted '${trapName}'.`);
            TrapUtils.log(`Passive Notice: No non-GM players control observer ${observerName} to send notice.`, 'info');
        }

        // Send GM message
        let gmMsgContent = trapConfig.passiveNoticeGM || defaultGmMsgContent;
        let finalGmMsg = GM_MSG_PREFIX + replacePlaceholders(gmMsgContent) + MSG_SUFFIX;
        TrapUtils.chat(finalGmMsg);

        TrapUtils.log(`Passive Notice: ${observerName} (BasePP ${perceptionData.basePP}, Luck ${perceptionData.luckBonus}, FinalPP ${perceptionData.finalPP}) spotted ${trapName} (DC ${trapConfig.passiveSpotDC}) at ${distanceToTrap.toFixed(1)}ft.`, 'info');
    },

    /**
     * Get a character's passive perception with luck bonuses
     * @param {object} token - The token to check
     * @param {object} trapConfig - The trap configuration for luck roll settings
     * @returns {object} Object with finalPP, basePP, luckBonus
     */
    async getCharacterPassivePerception(token, trapConfig) {
        if (Config.DEBUG) {
            TrapUtils.log(`[getCharacterPassivePerception] Received trapConfig: ${JSON.stringify(trapConfig)}`, 'debug');
        }
        
        const charId = token.get('represents');
        let basePP = null;
        let luckBonus = 0;

        // 1. Try Beacon API (getSheetItem) first
        if (typeof getSheetItem === 'function') {
            try {
                const item = await getSheetItem(charId, "passive_wisdom");
                const ppRaw = (item && typeof item.value !== 'undefined') ? item.value : item;
                if (ppRaw !== undefined && ppRaw !== null && ppRaw !== "") {
                    const parsedPP = parseInt(ppRaw, 10);
                    if (!isNaN(parsedPP)) {
                        TrapUtils.log(`Got PP ${parsedPP} from 'passive_wisdom' (getSheetItem) for char ${charId}.`, 'debug');
                        basePP = parsedPP;
                    }
                }
                if (basePP === null) {
                    TrapUtils.log(`'passive_wisdom' (getSheetItem) for char ${charId} was empty or not a number: '${ppRaw}'.`, 'debug');
                }
            } catch (err) {
                TrapUtils.log(`Error with getSheetItem for 'passive_wisdom' on char ${charId}: ${err}. Falling back.`, 'warn');
            }
        }

        // 2. Try to get 'passive_wisdom' attribute directly using getAttrByName
        if (basePP === null && typeof getAttrByName === 'function') {
            const passiveWisdomRaw = getAttrByName(charId, "passive_wisdom");
            if (passiveWisdomRaw !== undefined && passiveWisdomRaw !== null && passiveWisdomRaw !== "") {
                const parsedPP = parseInt(passiveWisdomRaw, 10);
                if (!isNaN(parsedPP)) {
                    TrapUtils.log(`Got PP ${parsedPP} from 'passive_wisdom' (getAttrByName) for char ${charId}.`, 'debug');
                    basePP = parsedPP;
                } else {
                    TrapUtils.log(`'passive_wisdom' (getAttrByName) for char ${charId} ('${passiveWisdomRaw}') is not a valid number.`, 'warn');
                }
            } else {
                TrapUtils.log(`'passive_wisdom' (getAttrByName) not found or empty for char ${charId}.`, 'debug');
            }
        }
        
        // 3. Try Token Bar Fallback
        if (basePP === null && trapConfig && trapConfig.ppTokenBarFallback && trapConfig.ppTokenBarFallback !== "none") {
            const barKey = trapConfig.ppTokenBarFallback.endsWith('_value') 
                ? trapConfig.ppTokenBarFallback 
                : `${trapConfig.ppTokenBarFallback}_value`;
            const barValue = token.get(barKey);
            if (barValue !== undefined && barValue !== null && barValue !== "") {
                const parsedBarPP = parseInt(barValue, 10);
                if (!isNaN(parsedBarPP)) {
                    TrapUtils.log(`Got PP ${parsedBarPP} from token bar '${barKey}' for char ${charId} (fallback).`, 'debug');
                    basePP = parsedBarPP;
                } else {
                    TrapUtils.log(`Value from token bar '${barKey}' for char ${charId} is not a number: '${barValue}'`, 'warn');
                }
            } else {
                TrapUtils.log(`Token bar '${barKey}' not found or empty for char ${charId} (fallback).`, 'debug');
            }
        }

        if (basePP === null) {
            TrapUtils.log(`Could not determine Passive Perception for char ${charId} after all methods.`, 'warn');
            return { finalPP: null, basePP: null, luckBonus: 0 };
        }

        // Check for luck roll properties
        if (trapConfig && trapConfig.enableLuckRoll) {
            const dieString = trapConfig.luckRollDie || '1d6';
            luckBonus = this.parseAndRollLuckDie(dieString);
        }
        
        const finalPP = basePP + luckBonus;
        TrapUtils.log(`PP Calcs: BasePP=${basePP}, LuckBonus=${luckBonus}, FinalPP=${finalPP} for char ${charId}`, 'debug');
        return { finalPP, basePP, luckBonus };
    },

    /**
     * Parse and roll a luck die string (e.g., "1d6")
     * @param {string} dieString - The die string to parse and roll
     * @returns {number} The rolled result
     */
    parseAndRollLuckDie(dieString) {
        if (!dieString || typeof dieString !== 'string') return 0;
        
        const match = dieString.match(/(\d+)d(\d+)([+-]\d+)?/i);
        if (!match) return 0;
        
        const numDice = parseInt(match[1], 10);
        const dieSize = parseInt(match[2], 10);
        const modifier = match[3] ? parseInt(match[3], 10) : 0;
        
        let total = 0;
        for (let i = 0; i < numDice; i++) {
            total += Math.floor(Math.random() * dieSize) + 1;
        }
        total += modifier;
        
        TrapUtils.log(`Luck roll: ${dieString} = ${total}`, 'debug');
        return total;
    },

    /**
     * Update the detection aura for a trap token
     * @param {object} trapToken - The trap token to update
     */
    updateAuraForDetectionRange(trapToken) {
        if (!trapToken || !TrapUtils.isTrap(trapToken)) return;

        // Check for global hide
        if (Config.state.detectionAurasTemporarilyHidden) {
            trapToken.set({ aura2_radius: '' });
            return;
        }

        const trapData = TrapUtils.parseTrapNotes(trapToken.get("gmnotes"), trapToken, false);
        if (!trapData) {
            // If it's not a valid trap, ensure the aura is off
            trapToken.set({ aura2_radius: '', aura2_color: '#000000' });
            return;
        }

        // Only show the aura if showDetectionAura is explicitly true
        if (trapData.showDetectionAura !== true) {
            trapToken.set({ aura2_radius: '' });
            TrapUtils.log(`Hiding detection aura for ${trapToken.id} because showDetectionAura is not explicitly true.`, 'debug');
            return;
        }
        
        // Determine the correct color and radius based on trap state
        const isArmedAndHasUses = trapData.isArmed && trapData.currentUses > 0;
        const isDetected = trapData.detected;
        let aura2Color = '#000000';
        let aura2Radius = '';

        if (isArmedAndHasUses) {
            aura2Color = isDetected ? Config.AURA_COLORS.DETECTED : Config.AURA_COLORS.DETECTION;
            // Calculate radius based on range
            const pageSettings = TrapUtils.geometry.getPageSettings(trapToken.get('_pageid'));
            if (pageSettings.valid && trapData.passiveMaxRange > 0) {
                const pixelsPerFoot = pageSettings.gridSize / pageSettings.scale;
                const tokenRadiusPixels = Math.max(trapToken.get('width'), trapToken.get('height')) / 2;
                const tokenRadiusFt = tokenRadiusPixels / pixelsPerFoot;
                aura2Radius = Math.max(0, trapData.passiveMaxRange - tokenRadiusFt);
            }
        } else { // Disarmed or no uses
            aura2Radius = 0; // Show a visible dot to indicate state
            aura2Color = isDetected ? Config.AURA_COLORS.DISARMED_DETECTED : Config.AURA_COLORS.DISARMED_UNDETECTED;
        }
        
        // Override color if passive detection is manually disabled for the trap
        if (trapData.passiveEnabled === false) {
            aura2Color = Config.AURA_COLORS.PASSIVE_DISABLED;
        }

        trapToken.set({
            aura2_color: aura2Color,
            aura2_radius: aura2Radius
        });

        TrapUtils.log(`Detection Aura Recalculated for ${trapToken.id}: Range ${trapData.passiveMaxRange || 0}ft, Radius ${aura2Radius}, Color ${aura2Color}`, 'debug');
    },

    /**
     * Run a single passive check between an observer and a trap
     * @param {object} observerToken - The token making the check
     * @param {object} trapToken - The trap token being checked against
     */
    async runSinglePassiveCheck(observerToken, trapToken) {
        if (!observerToken || !trapToken) return;

        // Ensure the trap token is actually a trap
        if (!TrapUtils.isTrap(trapToken)) return;

        const trapData = TrapUtils.parseTrapNotes(trapToken.get("gmnotes"), trapToken, false);

        // Check if trap has passive detection enabled
        if (!trapData || !trapData.isPassive || trapData.passiveEnabled === false) {
            return; // No passive detection configured
        }

        // Use character ID if available, otherwise use token ID
        const observerId = observerToken.get('represents') || observerToken.id;

        // Check if observer has already noticed this trap
        const alreadyNoticed = Config.state.passivelyNoticedTraps[trapToken.id] && 
                              Config.state.passivelyNoticedTraps[trapToken.id][observerId];
        if (alreadyNoticed) {
            if (Config.DEBUG) {
                TrapUtils.log(`Passive Notice SKIPPED for trap ${trapToken.id}: Observer ${observerId} has already noticed it.`, 'debug');
            }
            return;
        }

        // Check for Line of Sight
        const hasLOS = this.hasLineOfSight(observerToken, trapToken);
        if (!hasLOS) {
            if (Config.DEBUG) {
                TrapUtils.log(`Passive detection of trap ${trapToken.id} by ${observerToken.id} failed: No Line of Sight.`, 'debug');
            }
            return;
        }
        
        if (Config.DEBUG) {
            TrapUtils.log(`Passive detection check for trap ${trapToken.id} by ${observerToken.id}: Has Line of Sight.`, 'debug');
        }
        
        // Check distance vs max range
        const { mapUnitDistance } = TrapUtils.geometry.calculateTokenDistance(observerToken, trapToken);
        if (trapData.passiveMaxRange && mapUnitDistance > trapData.passiveMaxRange) {
            if (Config.DEBUG) {
                TrapUtils.log(`Passive detection of trap ${trapToken.id} by ${observerToken.id} failed: Out of max range (${mapUnitDistance.toFixed(1)}ft > ${trapData.passiveMaxRange}ft).`, 'debug');
            }
            return;
        }

        // Perform perception check
        const perceptionResult = await this.getCharacterPassivePerception(observerToken, trapData);
        if (perceptionResult.finalPP !== null && perceptionResult.finalPP >= trapData.passiveSpotDC) {
            this.handlePassiveNotice(observerToken, trapToken, perceptionResult, trapData, mapUnitDistance);
        }
    },

    /**
     * Basic line of sight check (placeholder - can be enhanced)
     * @param {object} observerToken - The observing token
     * @param {object} targetToken - The target token
     * @returns {boolean} True if line of sight exists
     */
    hasLineOfSight(observerToken, targetToken) {
        // For now, just check if they're on the same page
        // This can be enhanced with actual line-of-sight calculations
        return observerToken.get('_pageid') === targetToken.get('_pageid');
    },

    /**
     * Run passive checks for a token against all traps on the page
     * @param {object} observerToken - The token to run checks for
     */
    async runPassiveChecksForToken(observerToken) {
        if (!observerToken) return;

        const pageId = observerToken.get('_pageid');
        const trapTokens = findObjs({ _type: "graphic", _pageid: pageId }).filter(t => TrapUtils.isTrap(t));

        if (trapTokens.length === 0) {
            return; // No traps on the page
        }
        
        if (Config.DEBUG) {
            TrapUtils.log(`[DEBUG] Running passive checks for moving token '${observerToken.get('name')}' against ${trapTokens.length} traps.`, 'debug');
        }

        const checkPromises = trapTokens.map(trap => {
            return this.runSinglePassiveCheck(observerToken, trap);
        });
        await Promise.all(checkPromises);
    },

    /**
     * Run page-wide passive checks for all player tokens against all traps
     * @param {string} pageId - The page ID to run checks on
     */
    runPageWidePassiveChecks(pageId) {
        if (!pageId) return;
        TrapUtils.log(`Running page-wide passive checks for page ${pageId}.`, 'info');

        // Find all tokens on the page that represent a character
        const allTokensOnPage = findObjs({ _type: 'graphic', _pageid: pageId, layer: 'objects' });
        const playerTokens = allTokensOnPage.filter(t => t.get('represents'));

        // Find all traps on the page
        const trapTokens = allTokensOnPage.filter(t => TrapUtils.isTrap(t));

        if (playerTokens.length > 0 && trapTokens.length > 0) {
            TrapUtils.log(`Found ${playerTokens.length} player tokens and ${trapTokens.length} traps. Checking LOS for all pairs.`, 'debug');
            // For each token, check against each trap
            playerTokens.forEach(pToken => {
                trapTokens.forEach(tToken => {
                    // Fire-and-forget the async check for each pair
                    this.runSinglePassiveCheck(pToken, tToken);
                });
            });
        }
    },

    /**
     * Reset detection state for traps
     * @param {object} selectedToken - Optional specific trap token to reset
     * @param {string} playerId - Player ID for messaging
     */
    handleResetDetection(selectedToken, playerId) {
        TrapUtils.log('handleResetDetection called.', 'debug');
        let message = '';

        if (selectedToken && TrapUtils.isTrap(selectedToken)) {
            const trapId = selectedToken.id;
            const trapName = selectedToken.get("name") || `Trap ID ${trapId}`;
            
            if (Config.state.passivelyNoticedTraps && Config.state.passivelyNoticedTraps[trapId]) {
                // Remove the persistent 'detected' flag from notes
                let notes = selectedToken.get("gmnotes");
                let decodedNotes = "";
                try { 
                    decodedNotes = decodeURIComponent(notes); 
                } catch (e) { 
                    decodedNotes = notes; 
                }
                
                if (decodedNotes.includes("detected:[on]")) {
                    const updatedNotes = decodedNotes.replace(/\s*detected:\s*\[on\]/, '');
                    selectedToken.set("gmnotes", encodeURIComponent(updatedNotes));
                    TrapUtils.parseTrapNotes(updatedNotes, selectedToken);
                }
                
                delete Config.state.passivelyNoticedTraps[trapId];
                TrapUtils.log(`Passively noticed state for trap ID '${trapId}' has been cleared.`, 'info');
                message = `✅ Passive detection state for selected trap '${trapName}' has been reset.`;
            } else {
                TrapUtils.log(`No passively noticed state found for specific trap ID '${trapId}' to clear.`, 'info');
                message = `ℹ️ No passive detection state to reset for selected trap '${trapName}'.`;
            }
        } else {
            // Clear the entire passively noticed traps state
            if (Object.keys(Config.state.passivelyNoticedTraps).length > 0) {
                // Find all traps and reset their auras if they were previously detected
                const allTraps = findObjs({ _type: "graphic" }).filter(t => TrapUtils.isTrap(t));
                allTraps.forEach(trapToken => {
                    // Remove persistent flags from all traps
                    let notes = trapToken.get("gmnotes");
                    let decodedNotes = "";
                    try { 
                        decodedNotes = decodeURIComponent(notes); 
                    } catch (e) { 
                        decodedNotes = notes; 
                    }
                    
                    if (decodedNotes.includes("detected:[on]")) {
                        const updatedNotes = decodedNotes.replace(/\s*detected:\s*\[on\]/, '');
                        trapToken.set("gmnotes", encodeURIComponent(updatedNotes));
                        TrapUtils.parseTrapNotes(updatedNotes, trapToken);
                    }
                });
                
                Config.state.passivelyNoticedTraps = {};
                TrapUtils.log('All passivelyNoticedTraps have been cleared.', 'info');
                message = '✅ All passive detection states have been reset. Characters will need to re-detect all traps.';
            } else {
                TrapUtils.log('passivelyNoticedTraps was already empty.', 'info');
                message = 'ℹ️ No passive detection states were active to reset.';
            }
        }

        // Notify the GM
        if (playerId) {
            TrapUtils.whisper(playerId, message);
        } else {
            TrapUtils.chat(message);
        }
    },

    /**
     * Hide all detection auras temporarily
     * @param {number} durationMinutes - Duration to hide auras (0 for indefinite)
     * @param {string} playerId - Player ID for messaging
     */
    hideAllAuras(durationMinutes, playerId) {
        if (Config.state.hideAurasTimeout) {
            clearTimeout(Config.state.hideAurasTimeout);
            Config.state.hideAurasTimeout = null;
        }

        Config.state.detectionAurasTemporarilyHidden = true;

        const allTraps = findObjs({ _type: "graphic" }).filter(t => TrapUtils.isTrap(t));
        allTraps.forEach(trapToken => {
            this.updateAuraForDetectionRange(trapToken);
        });

        let message = "👁️ All detection auras are now hidden.";
        
        const durationMs = parseFloat(durationMinutes) * 60 * 1000;
        if (!isNaN(durationMs) && durationMs > 0) {
            Config.state.hideAurasTimeout = setTimeout(() => {
                this.showAllAuras(playerId, true);
            }, durationMs);
            message += ` They will automatically reappear in ${durationMinutes} minute(s).`;
        }

        TrapUtils.whisper(playerId, message);
    },

    /**
     * Show all detection auras
     * @param {string} playerId - Player ID for messaging
     * @param {boolean} isAuto - Whether this was called automatically
     */
    showAllAuras(playerId, isAuto = false) {
        if (Config.state.hideAurasTimeout) {
            clearTimeout(Config.state.hideAurasTimeout);
            Config.state.hideAurasTimeout = null;
        }

        Config.state.detectionAurasTemporarilyHidden = false;

        const allTraps = findObjs({ _type: "graphic" }).filter(t => TrapUtils.isTrap(t));
        allTraps.forEach(trapToken => {
            this.updateAuraForDetectionRange(trapToken);
        });
        
        const message = isAuto 
            ? "⏰ Timer expired. All detection auras have been restored."
            : "👁️ All detection auras are now restored.";

        TrapUtils.whisper(playerId, message);
    }
};

export default PassiveDetection;