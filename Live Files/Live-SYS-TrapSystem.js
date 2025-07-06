/**
 * TrapSystem.js
 * 
 * A Trap & Interaction system for the Roll20 API.
 * 
 * This script manages trap detection, trigger systems, and an interaction menu. It supports:
 * - Precise grid-based movement and positioning.
 * - Overlap detection for triggering traps.
 * - Armed/disarmed states with visual indicators.
 * - A robust interaction menu system, allowing for success/failure macros.
 * - Support for advantage/disadvantage skill checks and further expansions.
 *
 */

// ---------------------------------------------------
// A) Main TrapSystem
// ---------------------------------------------------

const TrapSystem = {
    
    //----------------------------------------------------------------------
    // 1) CONFIG & STATE
    //----------------------------------------------------------------------
    
    config: {
        DEBUG: false, 
        DEFAULT_GRID_SIZE: 70,
        DEFAULT_SCALE: 5,
        MIN_MOVEMENT_FACTOR: 0.3, // Minimum movement distance as a factor of grid size to trigger check
        AURA_COLORS: {
            ARMED: "#00ff00",                   // Green
            ARMED_INTERACTION: "#6aa84f",       // Light Green (for interactive traps)
            DISARMED: "#ff0000",                // Red
            DISARMED_INTERACTION: "#a61c00",    // Dark Red (for interactive traps)
            PAUSED: "#ffa500",                  // Orange
            DETECTION: "#808080",               // Subtle gray for detection range
            DETECTED: "#c0c0c0",                // Lighter gray when detected
            DISARMED_UNDETECTED: "#00008B",     // Dark Blue for disarmed, undetected traps
            DISARMED_DETECTED: "#A9A9A9",       // Dark Silver for disarmed, detected traps
            DETECTION_OFF: "#222222",           // Very dark gray for when detection is off (trap disabled/depleted)
            PASSIVE_DISABLED: "#5b0f00"         // Purple for when passive detection is toggled off
        },

        defaults: {
            trap: {
                type: "standard",
                currentUses: 0,
                maxUses: 0,
                isArmed: true,
                primaryMacro: null,
                options: [],
                successMacro: null,
                failureMacro: null,
                checks: [],
                movementTrigger: true,
                autoTrigger: false,
                position: "intersection",
                passiveSpotDC: null,
                passiveMaxRange: null,
                passiveNoticePlayer: null,
                passiveNoticeGM: null,
                ppTokenBarFallback: null,
                enableLuckRoll: false,
                luckRollDie: "1d6"
            }
        },
        aura: {
            TARGET_RADIUS_GRID_UNITS: 1,    // Target visual radius in grid units (e.g., 1.5 for 3-grid diameter)
            VISIBILITY_BOOST_GU: 0.3,       // Amount in Grid Units to boost the visual target radius if the original target would be at or within the token's edge.
        },
        messages: {
            templates: {
                PLAYER_ALERT: "⚠️ Alert!",
                GM_SPOT: "🎯 Passive Spot"
            },
            defaults: {
                playerNotice: "{charName} has spotted {trapName} from {distanceToTrap}ft away! Watch out!",
                gmNotice: "Character {charName}, PP {charPP}, (base {basePP} + luck {luckBonus}), Trap {trapName}, Spot DC {trapDC}, Spotted at: {distanceToTrap}ft."
            },
            placeholders: {
                charName: "Character's name",
                charPP: "Character's passive perception",
                trapName: "Trap's name",
                trapDC: "Trap's spot DC",
                distanceToTrap: "Distance to trap in feet",
                luckBonus: "Luck roll bonus",
                basePP: "Base passive perception before luck"
            },
            passiveNoticeDebounceTime: 100000 // Milliseconds: Time window to suppress identical passive notices to players
        },
        TEST_TRAP: {
            notes: "{!traptrigger uses: 1/1 macro: #TEST_MACRO effects: []}",
            uses: 1,
            maxUses: 1,
            macroName: "TEST_MACRO"
        },
        // Skill icons
        SKILL_TYPES: {
            "Flat Roll": "🎲",
            "Acrobatics": "🤸",
            "Animal Handling": "🐎",
            "Arcana": "✨",
            "Athletics": "💪",
            "Deception": "🎭",
            "History": "📚",
            "Insight": "👁️",
            "Intimidation": "😠",
            "Investigation": "🔍",
            "Medicine": "⚕️",
            "Nature": "🌿",
            "Perception": "👀",
            "Performance": "🎪",
            "Persuasion": "💬",
            "Religion": "⛪",
            "Sleight of Hand": "🎯",
            "Stealth": "👥",
            "Survival": "🏕️",
            "Strength Check": "💪",
            "Strength Saving Throw": "🛡️💪",
            "Dexterity Check": "🤸",
            "Dexterity Saving Throw": "🛡️🤸",
            "Constitution Check": "🏋️",
            "Constitution Saving Throw": "🛡️🏋️",
            "Intelligence Check": "🧠",
            "Intelligence Saving Throw": "🛡️🧠",
            "Wisdom Check": "👁️",
            "Wisdom Saving Throw": "🛡️👁️",
            "Charisma Check": "💬",
            "Charisma Saving Throw": "🛡️💬"
        },
        MACRO_TAGS: {
            trap: "The trap token itself (the object representing the trap)",   // formatted as <&trap>
            trapped: "The token that is currently trapped (the victim/target)", // formatted as <&trapped>
            // Add more as needed, e.g.:
            // bystander: "A token affected by splash/area effects",
            // victim2: "A second trapped token, if multi-trap is supported",
        },
    },

    state: {
        lockedTokens: {},           // Movement-locked tokens
        testTrapTokens: new Set(),  // If using test traps
        safeMoveTokens: new Set(),  // Tokens that get a free move after unlocking
        triggersEnabled: true,      // Global on/off
        originalMacros: {},         // If you had any macro backups
        warnedInvalidGridPages: {}, // [NEW] To track pages already warned for invalid grid

        // From InteractionMenu:
        activeInteractions: {},     // Not used heavily, but included
        pendingChecks: {},          // For advantage/disadv checks
        pendingChecksByChar: {},    // New: Lookup by character ID
        displayDCForCheck: {},      // key: playerid, value: true/false

        // [NEW] From MacroExport
        macroExportStates: {},               // Stores state for tokens (graphic, door/window, or pathv2)
        macroExportDoorStates: {},           // Stores door states before changes
        macroExportedMacros: [],             // Stores exported macro info
        macroExportTokensOrderedToFront: [], // Tokens moved to front
        macroExportTokensOrderedToBack: [],  // Tokens moved to back
        macroExportRecordOrdering: false,    // Flag for ordering listeners

        // State for passive perception
        passivelyNoticedTraps: {},          // Initialized here
        recentlyNoticedPlayerMessages: {},  // { charId: [{ messageContent: string, timestamp: number }] }

        // State for hiding detection auras
        detectionAurasTemporarilyHidden: false,
        hideAurasTimeout: null
    },

    //----------------------------------------------------------------------
    // 2) UTILS
    //----------------------------------------------------------------------
    utils: {
        // Unified log helper
        log(message, type='info') {
            if (!TrapSystem.config.DEBUG && type === 'debug') return;
            const prefix = {
                info: '📜',
                error: '❌',
                success: '✅',
                warning: '⚠️',
                debug: '🔍'
            }[type] || '📜';
            log(`${prefix} TrapSystem: ${message}`);
        },

        playerIsGM: function(playerId) {
            const player = getObj("player", playerId);
            if (!player) return false;
            return player.get("_online") && player.get("_type") === "player" && player.get("_isGM");
        },

        // GM whisper
        chat(message) {
            if (typeof message !== 'string') {
                this.log('Error: Invalid message type', 'error');
                return;
            }
            sendChat('TrapSystem', `/w gm ${message}`);
        },
        
        // Get all GM player IDs
        getGMPlayerIds() {
            return findObjs({ _type: "player" })
                .filter(p => TrapSystem.utils.playerIsGM(p.id))
                .map(p => p.id);
        },

        whisper(recipientId, message) {
            if (!recipientId || recipientId === 'null' || !message) return;
    
            // First, assume recipientId is a Player ID
            let player = getObj("player", recipientId);
            if (player) {
                const playerName = player.get("displayname");
                sendChat('TrapSystem', `/w "${playerName}" ${message}`);
                return;
            }
    
            // If not a valid Player ID, assume it might be a Token ID
            let character = null;
            const token = getObj("graphic", recipientId);
            if (token && token.get('represents')) {
                character = getObj("character", token.get('represents'));
            }
    
            if (character) {
                const controlledBy = (character.get('controlledby') || "").split(',').map(s => s.trim()).filter(s => s);
                const playerIds = [...new Set(controlledBy.filter(pid => pid !== 'all'))];
    
                if (playerIds.length > 0) {
                    const players = playerIds.map(pid => getObj('player', pid)).filter(p => p);
                    
                    if (players.length > 0) {
                        const onlinePlayers = players.filter(p => p.get('_online'));
                        
                        // Prefer online players. If none are online, whisper to all controllers and let Roll20 queue it.
                        const targetPlayers = onlinePlayers.length > 0 ? onlinePlayers : players;
    
                        targetPlayers.forEach(p => {
                            sendChat('TrapSystem', `/w "${p.get("displayname")}" ${message}`);
                        });
                        return; // Message sent.
                    }
                }
            }
            
            // Fallback: If we couldn't find a player or controllers for the token, inform the GM.
            TrapSystem.utils.log(`Whisper could not find a recipient for ID ${recipientId}, falling back to GM.`, 'info');
            sendChat('TrapSystem', `/w gm Could not find a valid recipient for ID [${recipientId}]. Msg: ${message}`);
        },

        decodeHtml(text) {
            if (typeof text !== 'string') return text;
            return text.replace(/&amp;/g, '&')
                       .replace(/&lt;/g, '<')
                       .replace(/&gt;/g, '>')
                       .replace(/&quot;/g, '"')
                       .replace(/&#39;/g, "'");
        },

        // Return a sanitized token image URL or a fallback icon
        getTokenImageURL(token, size = 'med') {
            if (!token) return '👤';

            const sanitize = (url) => {
                if (!url) return null;
                let processed = url.replace(/(thumb|max)(?=\.[^/]+$)/, size);
                processed = processed.replace(/\(/g, '%28')
                                 .replace(/\)/g, '%29')
                                 .replace(/'/g, '%27')
                                 .replace(/"/g, '%22');
                return processed;
            };

            let img = token.get('imgsrc');
            if (!img) {
                const charId = token.get('represents');
                if (charId) {
                    const char = getObj('character', charId);
                    if (char) {
                        img = char.get('avatar');
                        if (!img) img = char.get('imgsrc');
                    }
                }
            }

            const sanitized = sanitize(img);
            return sanitized || '👤';
        },

        // Execute a macro by name
        executeMacro(commandString, tagToIdMap = {}) {
            try {
                let macroText;
                commandString = (commandString || '').trim();

                if (!commandString) {
                    this.log('executeMacro called with an empty command string.', 'info');
                    return true; // No action to take
                }

                if (commandString.startsWith('#')) {
                    const macroName = commandString.substring(1);
                    const macro = findObjs({_type: "macro", name: macroName})[0];
                    if (!macro) {
                        this.log(`Macro not found: ${macroName}`, 'error');
                        this.whisper(this.getGMPlayerIds()[0], `Error: Macro named '${macroName}' not found.`);
                        return false;
                    }
                    macroText = macro.get("action");
                    if (!macroText) {
                        this.log(`Macro has no action: ${macroName}`, 'error');
                        return false;
                    }
                } else if (commandString.startsWith('!') || commandString.startsWith('$') || commandString.startsWith('&{')) {
                    macroText = commandString;
                } else {
                    // It's a plain text message, send it to chat and we're done.
                    sendChat('TrapSystem', commandString);
                    return true;
                }
        
                let triggerByTagCommand = null;
                const lines = macroText.split('\n');
                const triggerLineIndex = lines.findIndex(line => line.trim().startsWith('!triggerByTag'));

                if (triggerLineIndex !== -1) {
                    triggerByTagCommand = lines[triggerLineIndex].trim();
                    lines.splice(triggerLineIndex, 1); // Remove the line from the array
                    macroText = lines.join('\n');
                    this.log(`Separated !triggerByTag command: "${triggerByTagCommand}"`, 'debug');
                }
        
                // Process placeholders on the initial part of the macro
                const processedText = this.replaceMacroPlaceholdersWithTags(macroText, tagToIdMap);
        
                // Execute the initial part of the macro
                if (processedText.trim().startsWith('&{')) {
                    sendChat('', processedText);
                } else {
                    const remainingLines = processedText.split('\n');
                    const isApiCommand = line => line.trim().startsWith('!') || line.trim().startsWith('$');
                    const isTemplateCommand = line => line.trim().startsWith('&{');
                    
                    const apiCommands = remainingLines.filter(isApiCommand);
                    const templateCommands = remainingLines.filter(isTemplateCommand);
                    const chatMessage = remainingLines.filter(line => !isApiCommand(line) && !isTemplateCommand(line)).join('\n');

                    // Send the combined chat message, if it exists
                    if (chatMessage.trim()) {
                        sendChat('TrapSystem', chatMessage);
                    }

                    // Send each template command separately as the GM to ensure it's parsed
                    templateCommands.forEach(templateCmd => {
                        sendChat('', templateCmd.trim());
                    });

                    // Send each API command separately
                    apiCommands.forEach(apiCmd => {
                        let finalCmd = apiCmd.trim();
                        // If the command was stored with a $, convert it back to ! for execution
                        if (finalCmd.startsWith('$')) {
                            finalCmd = '!' + finalCmd.substring(1);
                        }
                        // If it's a token-mod command without an explicit ID, add the context token ID
                        if (finalCmd.startsWith('!token-mod') && !finalCmd.includes('--ids')) {
                            const contextTokenId = tagToIdMap.trap || tagToIdMap.trapped; // Prioritize trap, fallback to trapped
                            if (contextTokenId) {
                                // Inject the --ids parameter after the command but before other options
                                finalCmd = `!token-mod --ids ${contextTokenId} ${finalCmd.substring('!token-mod'.length).trim()}`;
                                this.log(`executeMacro: Injected ID into token-mod command: ${finalCmd}`, 'debug');
                            }
                        }
                        sendChat('API', finalCmd);
                    });
                }
        
                // Now, handle the separated !triggerByTag command
                if (triggerByTagCommand) {
                    if (typeof TokenFX === 'undefined' || !TokenFX.trigger || !TokenFX.trigger.processTrigger) {
                        this.chat("⚠️ **Warning:** A macro attempted to use `!triggerByTag`, but the `TokenFX.js` script (or required functions) is not available. The action was skipped.");
                        this.log("!triggerByTag found but TokenFX or its trigger functions are not loaded.", "warning");
                        return true;
                    }
        
                    const originTokenId = tagToIdMap.trap;
                    const originToken = getObj("graphic", originTokenId);
        
                    if (!originToken) {
                        this.log('!triggerByTag cannot run: Origin trap token not found in tagToIdMap.', 'error');
                        this.chat('❌ **Error:** Could not find the origin token for the area trigger.');
                        return true;
                    }
        
                    // Parse the !triggerByTag command's arguments
                    const triggerArgs = triggerByTagCommand.split(' ');
                    const tagToFind = triggerArgs[1];
                    const radiusFt = parseFloat(triggerArgs[2]);
                    const actionMacro = triggerArgs.slice(3).join(" ");
        
                    if (!tagToFind || isNaN(radiusFt) || !actionMacro) {
                        this.log(`!triggerByTag parsing failed. Args: ${triggerArgs.join(' ')}`, 'error');
                        this.chat('❌ **Error:** Failed to parse the `!triggerByTag` command in the macro.');
                        return true;
                    }
        
                    const isPerToken = actionMacro.includes("@{selected|token_id}") || actionMacro.includes("@{target|token_id}") || actionMacro.includes("@TOKENID@");
        
                    this.log(`Directly calling TokenFX.trigger.processTrigger. Origin: ${originToken.id}, Tag: ${tagToFind}, Radius: ${radiusFt}, Action: ${actionMacro}`, 'debug');
        
                    // Directly call the processing function from TokenFX, bypassing chat
                    TokenFX.trigger.processTrigger(
                        tagToFind,
                        radiusFt,
                        actionMacro,
                        isPerToken,
                        originToken.get("left"),
                        originToken.get("top"),
                        originToken.get("pageid")
                    );
                }
                return true;
            } catch (err) {
                this.log(`Error executing macro: ${err.message}\nStack: ${err.stack}`, 'error');
                return false;
            }
        },

        // Check if token is a trap
        isTrap(token) {
            if (!token) return false;
            if (TrapSystem.state.testTrapTokens.has(token.id)) return true; // Quick test for test tokens
            const notes = token.get("gmnotes");
            if (!notes) return false;
            let decoded;
            try { 
                decoded = decodeURIComponent(notes); 
            } catch(e) { 
                decoded = notes; 
            }
            return decoded.includes("!traptrigger");
        },

        // Get page settings with fallback
        getPageSettings(pageId) {
            const page = getObj("page", pageId);
            if (!page) {
                if (!TrapSystem.state.warnedInvalidGridPages[pageId || 'unknown_page']) {
                    this.log(`Page with ID '${pageId || 'unknown_page'}' not found, using defaults`, 'warning');
                    TrapSystem.state.warnedInvalidGridPages[pageId || 'unknown_page'] = true;
                }
                return {
                    gridSize: TrapSystem.config.DEFAULT_GRID_SIZE,
                    scale: TrapSystem.config.DEFAULT_SCALE,
                    gridType: "square",
                    valid: false
                };
            }

            let gridSize = page.get("gridsize"); // Standard property for grid size in pixels.
            const diagonalType = page.get("diagonaltype");
            const snappingIncrement = page.get("snapping_increment");

            // SPECIAL CASE: The "D&D 5E/4E Compatible" setting ("foure") does not report a 'gridsize'.
            // In this case, we will assume the default grid size silently without throwing a warning,
            // as this is expected API behavior for this measurement type.
            if (diagonalType === 'foure' && (!gridSize || gridSize < 2)) {
                gridSize = TrapSystem.config.DEFAULT_GRID_SIZE;
            } 
            // For all OTHER measurement types, we check if the grid is disabled or invalid and warn if so.
            else if (snappingIncrement === 0 || !gridSize || gridSize < 2) {
                gridSize = TrapSystem.config.DEFAULT_GRID_SIZE;
                if (!TrapSystem.state.warnedInvalidGridPages[pageId]) {
                    const pageName = page.get("name") || `ID: ${pageId}`;
                    const warningMsg = `Page '${pageName}' has its grid disabled or set to an invalid size. The trap system requires a grid to function correctly. Defaulting to ${gridSize}px. Please check the Page Settings.`;
                    this.log(warningMsg, 'warning');
                    this.chat(warningMsg);
                    TrapSystem.state.warnedInvalidGridPages[pageId] = true;
                }
            }
            
            return {
                gridSize,
                scale: page.get("scale_number") || TrapSystem.config.DEFAULT_SCALE,
                gridType: page.get("grid_type"),
                valid: true
            };
        },

        // Return bounding and grid info
        getTokenGridCoords(token) {
            if(!token) return null;

            if (TrapSystem.config.DEBUG && token.get("gmnotes") && token.get("gmnotes").includes("!traptrigger")) {
                this.log(`[DIAGNOSTIC] getTokenGridCoords for TRAP ${token.id}: L${token.get("left")}, T${token.get("top")}, W${token.get("width")}, H${token.get("height")}, R${token.get("rotation")}`, 'debug');
            }

            const ps = this.getPageSettings(token.get("_pageid"));
            const g = ps.gridSize;
            const left = token.get("left");
            const top  = token.get("top");
            const w    = token.get("width");
            const h    = token.get("height");
            const gridX = Math.round((left - w/2) / g);
            const gridY = Math.round((top - h/2) / g);
            return {
                x: gridX,
                y: gridY,
                width: Math.ceil(w/g),
                height: Math.ceil(h/g),
                gridSize: g,
                scale: ps.scale,
                gridType: ps.gridType,
                pixelX: left,
                pixelY: top,
                tokenWidth: w,
                tokenHeight: h
            };
        },

        // Overlap check
        checkGridOverlap(t1, t2) {
            const c1 = this.getTokenGridCoords(t1);
            const c2 = this.getTokenGridCoords(t2);
            if(!c1 || !c2) return false;

            const b1 = {
                left: c1.pixelX - c1.tokenWidth/2,
                right: c1.pixelX + c1.tokenWidth/2,
                top: c1.pixelY - c1.tokenHeight/2,
                bottom: c1.pixelY + c1.tokenHeight/2,
                w: c1.tokenWidth,
                h: c1.tokenHeight
            };
            const b2 = {
                left: c2.pixelX - c2.tokenWidth/2,
                right: c2.pixelX + c2.tokenWidth/2,
                top: c2.pixelY - c2.tokenHeight/2,
                bottom: c2.pixelY + c2.tokenHeight/2,
                w: c2.tokenWidth,
                h: c2.tokenHeight
            };
            const xO = Math.max(0, Math.min(b1.right, b2.right) - Math.max(b1.left, b2.left));
            const yO = Math.max(0, Math.min(b1.bottom, b2.bottom) - Math.max(b1.top, b2.top));
            const overlapArea = xO * yO;
            const area1 = b1.w * b1.h;
            const overlapPct = (overlapArea / area1) * 100;
            this.log(`Overlap: ${overlapPct.toFixed(2)}%`, 'debug');
            return overlapPct >= 5;
        },

        // Check if movement path crosses trap
        checkLineIntersection(startX, startY, endX, endY, trapToken) {
            const coords = this.getTokenGridCoords(trapToken); // Still useful for MIN_MOVEMENT_FACTOR
            if(!coords) return null; // Changed from false to null to match lineSegmentIntersectsOBB return type
            
            const dx = endX - startX;
            const dy = endY - startY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if(dist < coords.gridSize * TrapSystem.config.MIN_MOVEMENT_FACTOR) {
                // this.log(`checkLineIntersection: Movement too small (${dist.toFixed(2)}px) to trigger. Min req: ${(coords.gridSize * TrapSystem.config.MIN_MOVEMENT_FACTOR).toFixed(2)}px`, 'debug');
                return null;
            }

            const obbCorners = this.getOBBCorners(trapToken);
            if (!obbCorners) {
                this.log('checkLineIntersection: Could not get OBB corners for trap token.', 'warn');
                return null;
            }

            // The isInside checks and margin logic are no longer needed as OBB intersection is more precise.
            // const margin = Math.min(coords.tokenWidth, coords.tokenHeight) * 0.05;
            // const isInside = (x,y) => 
            //     x >= bounds.left - margin && x <= bounds.right + margin &&
            //     y >= bounds.top  - margin && y <= bounds.bottom + margin;
            // if(isInside(startX,startY)) return {x: startX, y: startY};
            // if(isInside(endX,endY))     return {x: endX, y: endY};

            // Directly use the new OBB intersection logic
            const intersectionPoint = this.lineSegmentIntersectsOBB(startX, startY, endX, endY, obbCorners);
            
            // this.log(`checkLineIntersection (OBB): Movement from (${startX},${startY}) to (${endX},${endY}). Intersection with trap ${trapToken.id}: ${intersectionPoint ? JSON.stringify(intersectionPoint) : 'null'}`, 'debug');
            return intersectionPoint;
        },
        lineIntersection(x1,y1,x2,y2,x3,y3,x4,y4) {
            const denom = (x1 - x2)*(y3 - y4) - (y1 - y2)*(x3 - x4);
            if(!denom) return null;
            const t = ((x1 - x3)*(y3 - y4) - (y1 - y3)*(x3 - x4)) / denom;
            const u = -((x1 - x2)*(y1 - y3) - (y1 - y2)*(x1 - x3)) / denom;
            if(t >= 0 && t <= 1 && u >= 0 && u <= 1) {
                return { x: x1 + t*(x2 - x1), y: y1 + t*(y2 - y1) };
            }
            return null;
        },

        // Center of a token
        getTokenCenter(token) {
            return { x: token.get("left"), y: token.get("top") };
        },

        // Read trap info from GM notes
        parseTrapNotes(notes, token=null, updateVisuals = true) {
            if(!notes) {
                this.log('GM notes empty','warning');
                return null;
            }
            let decodedNotes = notes;
            try{ 
                decodedNotes = decodeURIComponent(notes);
            } catch(e){ /* ignore */ }

            // Standardize newlines for easier block splitting if any exist from old formats or manual multi-line edits
            decodedNotes = decodedNotes.replace(/<br\s*\/?>/gi, '\n').trim();
            // Then, for the new format, we mostly care about the blocks, so join lines back if split
            // Though, ideally, new format notes are single line per block.
            // For parsing, treat as a single string to find blocks.
            const singleLineNotes = decodedNotes.replace(/\n/g, ' '); 

            const trapData = {
                type: "standard", currentUses: 0, maxUses: 0, isArmed: true,
                primaryMacro: null, options: [], successMacro: null, failureMacro: null,
                checks: [], movementTrigger: true, autoTrigger: false, position: "intersection",
                passiveSpotDC: null, passiveMaxRange: null, passiveNoticePlayer: null,
                passiveNoticeGM: null, ppTokenBarFallback: null,
                rawTriggerBlock: null, // For debugging or preserving unparsed parts
                rawDetectionBlock: null // For debugging
            };
            let triggerBlockSuccessfullyParsed = false;
            let detectionBlockSuccessfullyParsed = false;

            const triggerBlockMatch = singleLineNotes.match(/\{!traptrigger\s+((?:(?!\{!}).)*)\}/);
            if (triggerBlockMatch && triggerBlockMatch[1]) {
                trapData.rawTriggerBlock = triggerBlockMatch[1].trim();
                const settingRegex = /(\w+):\s*\[((?:"(?:[^"\\]|\\.)*"|[^\]]*))\]/g; // Handles quoted values
                let match;
                while ((match = settingRegex.exec(trapData.rawTriggerBlock)) !== null) {
                    const key = match[1].toLowerCase();
                    let value = match[2]; // Keep original casing and quotes

                    value = TrapSystem.utils.decodeHtml(value);

                    switch (key) {
                        case "type": trapData.type = value.toLowerCase(); break;
                        case "uses":
                            const usesParts = value.match(/(\d+)\/(\d+)/);
                            if (usesParts) {
                                trapData.currentUses = parseInt(usesParts[1], 10);
                                trapData.maxUses = parseInt(usesParts[2], 10);
                            }
                            break;
                        case "armed": trapData.isArmed = value.toLowerCase() === 'on'; break;
                        case "primarymacro": 
                            if (value.startsWith('"') && value.endsWith('"')) {
                                value = value.substring(1, value.length - 1).replace(/\\"/g, '"');
                            }
                            trapData.primaryMacro = { name: value, macro: value }; // Store as object
                            break; 
                        case "failuremacro": 
                            if (value.startsWith('"') && value.endsWith('"')) {
                                value = value.substring(1, value.length - 1).replace(/\\"/g, '"');
                            }
                            trapData.failureMacro = value; break; // Interaction trap
                        case "successmacro": 
                            if (value.startsWith('"') && value.endsWith('"')) {
                                value = value.substring(1, value.length - 1).replace(/\\"/g, '"');
                            }
                            trapData.successMacro = value; break;
                        case "options": 
                            trapData.options = value.split(';').map(optStr => {
                                let trimmedOptStr = optStr.trim();
                                if (trimmedOptStr.startsWith('"') && trimmedOptStr.endsWith('"')) {
                                    trimmedOptStr = trimmedOptStr.substring(1, trimmedOptStr.length - 1).replace(/\\"/g, '"');
                                }
                                if (trimmedOptStr) {
                                    return { name: trimmedOptStr, macro: trimmedOptStr };
                                }
                                return null;
                            }).filter(opt => opt !== null);
                            break;
                        case "checks": // Format: Skill1:DC1;Skill2:DC2
                            trapData.checks = value.split(';').map(chkStr => {
                                const parts = chkStr.split(':');
                                if (parts.length === 2) {
                                    const skill = parts[0].trim();
                                    const dcVal = parseInt(parts[1].trim(), 10);
                                    if (skill && !isNaN(dcVal)) return { type: skill, dc: dcVal };
                                }
                                return null;
                            }).filter(chk => chk !== null);
                            break;
                        case "movementtrigger": trapData.movementTrigger = value.toLowerCase() === 'on'; break;
                        case "autotrigger": trapData.autoTrigger = value.toLowerCase() === 'on'; break;
                        case "position":
                            const posLc = value.toLowerCase();
                            if (posLc === "center" || posLc === "intersection") {
                                trapData.position = posLc;
                            } else {
                                const posMatch = value.match(/(\d+)\s*,\s*(\d+)/);
                                if (posMatch) trapData.position = { x: parseInt(posMatch[1],10), y: parseInt(posMatch[2],10) };
                            }
                            break;
                        }
                    }
                    triggerBlockSuccessfullyParsed = true; 
                } 

            const detectionBlockMatch = singleLineNotes.match(/\{!trapdetection\s+((?:(?!\{!}).)*)\}/);
            if (detectionBlockMatch && detectionBlockMatch[1]) {
                trapData.rawDetectionBlock = detectionBlockMatch[1].trim();
                trapData.isPassive = true;
                TrapSystem.utils.log(`[DEBUG parseTrapNotes] Found rawDetectionBlock: "${trapData.rawDetectionBlock}"`, 'debug'); // Log the raw block
                const settingRegex = /(\w+):\s*\[([^\]]*)\]/g;
                let match;
                while ((match = settingRegex.exec(trapData.rawDetectionBlock)) !== null) {
                    const key = match[1].toLowerCase();
                    let value = match[2]; // Keep original casing for macro names etc.
                    value = TrapSystem.utils.decodeHtml(value);
                    TrapSystem.utils.log(`[DEBUG parseTrapNotes] DetectionBlock Iteration: key='${key}', value='${value}'`, 'debug'); // Log key/value
                    switch (key) {
                        case "passivespotdc": 
                            const dc = parseInt(value, 10);
                            trapData.passiveSpotDC = isNaN(dc) ? null : dc;
                            break;
                        case "passivemaxrange": 
                            const range = parseFloat(value);
                            trapData.passiveMaxRange = isNaN(range) ? null : range;
                            break;
                        case "passivenoticeplayer": trapData.passiveNoticePlayer = value; break;
                        case "passivenoticegm": trapData.passiveNoticeGM = value; break;
                        case "pptokenbarfallback": trapData.ppTokenBarFallback = value; break;
                        case "enableluckroll":
                            trapData.enableLuckRoll = value.toLowerCase() === "true";
                            break;
                        case "luckrolldie":
                            trapData.luckRollDie = value;
                            break;
                        case "showdetectionaura":
                            trapData.showDetectionAura = value.toLowerCase() === "true";
                            break;
                        case "passiveenabled":
                            trapData.passiveEnabled = value.toLowerCase() === "on";
                            break;
                        case "detected":
                            trapData.detected = value.toLowerCase() === "on";
                            break;
                    }
                }
                detectionBlockSuccessfullyParsed = true;
            }

            // If NEITHER modern block was successfully parsed, THEN try legacy or return null.
            if (!triggerBlockSuccessfullyParsed && !detectionBlockSuccessfullyParsed) {
                this.log('Neither modern traptrigger nor trapdetection block found. Returning null.', 'debug');
                // If legacy also returns null, it means the notes are not a trap in any known format.
                if (decodedNotes.trim() !== "" && decodedNotes.trim().replace(/<br\s*\/?>/gi, "") !== "") {
                     this.log('Notes present but not a recognized trap format. Returning null.', 'debug');
                }
                return null; 
            }

            // At least one modern block was parsed. Proceed with current trapData.
            // Legacy compatibility for very old primary/success fields if new ones not found
            // This should ideally be phased out or handled more cleanly if the new format is strictly adopted.
            // Only apply this specific legacy field fallback if an interaction-type trigger block was parsed.
            if (triggerBlockSuccessfullyParsed && trapData.type === "interaction") {
                if (!trapData.failureMacro && decodedNotes.includes("primary:")) {
                    const legacyPrimaryMatch = decodedNotes.match(/primary:\s*Name:\s*"([^"]+)"\s*Macro:\s*([^\s\\]+)/);
                    if (legacyPrimaryMatch) trapData.failureMacro = legacyPrimaryMatch[2];
                }
                if (!trapData.successMacro && decodedNotes.includes("success:")) {
                    const legacySuccessMatch = decodedNotes.match(/success:\s*(\w+)/);
                    if (legacySuccessMatch) trapData.successMacro = legacySuccessMatch[1];
                }
            }

            // Sync aura color and bars if we have a token
            if(token && updateVisuals) {
                const isArmedAndHasUses = trapData.isArmed && trapData.currentUses > 0;
                let aura1Color;
                if (isArmedAndHasUses) {
                    if (TrapSystem.state.triggersEnabled) {
                        aura1Color = trapData.type === 'interaction' 
                            ? TrapSystem.config.AURA_COLORS.ARMED_INTERACTION
                            : TrapSystem.config.AURA_COLORS.ARMED;
                    } else {
                        aura1Color = TrapSystem.config.AURA_COLORS.PAUSED;
                    }
                } else {
                    aura1Color = trapData.type === 'interaction'
                        ? TrapSystem.config.AURA_COLORS.DISARMED_INTERACTION
                        : TrapSystem.config.AURA_COLORS.DISARMED;
                }

                token.set({
                    aura1_color: aura1Color,
                    aura1_radius: TrapSystem.utils.calculateDynamicAuraRadius(token),
                    showplayers_aura1: false,
                    bar1_value: trapData.currentUses,
                    bar1_max: trapData.maxUses,
                    showplayers_bar1: false,
                    bar2_value: trapData.passiveSpotDC || 0,
                    bar2_max: trapData.passiveSpotDC || 0,
                    showplayers_bar2: false
                });
            }

            return trapData;
        },

        // Update GM notes for trap uses + armed state
        updateTrapUses(token, current, max, newArmed = null) {
            try {
                const notes = token.get("gmnotes");
                if (!notes) {
                    this.log('Cannot update uses: GM notes are empty', 'error');
                    return;
                }

                let decodedNotes = notes;
                try {
                    decodedNotes = decodeURIComponent(notes);
                } catch (e) {
                    this.log(`URI decode failed in updateTrapUses: ${e.message}`, 'warning');
                    // Continue with undecoded notes if decode fails
                }
                
                // Replace <br> with spaces for easier regex on single-line format
                const singleLineNotes = decodedNotes.replace(/<br\s*\/?>/gi, ' ').replace(/\n/g, ' ');

                let updatedNotes = singleLineNotes;
                let usesUpdated = false;
                let armedUpdated = false;

                // Update uses: uses:[current/max]
                const usesRegex = /uses:\s*\[\d+\/\d+\]/;
                if (usesRegex.test(updatedNotes)) {
                    updatedNotes = updatedNotes.replace(usesRegex, `uses:[${current}/${max}]`);
                    usesUpdated = true;
                } else {
                    // If not found, try to add it to the traptrigger block
                    const triggerBlockMatch = updatedNotes.match(/(\{!traptrigger[^}]*)\}/);
                    if (triggerBlockMatch && triggerBlockMatch[1]) {
                        updatedNotes = updatedNotes.replace(triggerBlockMatch[1], `${triggerBlockMatch[1]} uses:[${current}/${max}]`);
                        usesUpdated = true;
                    }
                }

                // Update armed: armed:[on|off]
                if (newArmed !== null) {
                    const armedRegex = /armed:\s*\[(on|off)\]/;
                    if (armedRegex.test(updatedNotes)) {
                        updatedNotes = updatedNotes.replace(armedRegex, `armed:[${newArmed ? 'on' : 'off'}]`);
                        armedUpdated = true;
                    } else {
                        // If not found, try to add it to the traptrigger block
                        const triggerBlockMatch = updatedNotes.match(/(\{!traptrigger[^}]*)\}/);
                        if (triggerBlockMatch && triggerBlockMatch[1]) {
                           updatedNotes = updatedNotes.replace(triggerBlockMatch[1], `${triggerBlockMatch[1]} armed:[${newArmed ? 'on' : 'off'}]`);
                           armedUpdated = true;
                    }
                }
                }

                if (!usesUpdated && !armedUpdated && newArmed === null) {
                    this.log('Could not find uses or armed fields to update in new format, and no new armed state provided.', 'warning');
                    // Optionally, could fall back to trying to append to a traptrigger block if one exists
                    // but for now, if the fields are missing and we're not forcing an armed state, log and return.
                    // This might indicate malformed notes.
                } 
                // If the {!traptrigger block itself is missing, we can't do much
                if (!updatedNotes.includes("{!traptrigger")) {
                    this.log('Cannot update uses/armed: {!traptrigger block not found in notes. Manual update needed.', 'error');
                    return;
                }

                token.set("gmnotes", encodeURIComponent(updatedNotes));

                token.set({
                    bar1_value: current,
                    bar1_max: max,
                    showplayers_bar1: false
                });

                const finalArmedState = newArmed !== null ? newArmed : (updatedNotes.includes("armed: on") || updatedNotes.includes("armed:on"));
                const trapData = this.parseTrapNotes(updatedNotes, null, false); // Re-parse to get type
                let auraColor;
                if (finalArmedState && current > 0) {
                    auraColor = TrapSystem.state.triggersEnabled
                        ? (trapData.type === 'interaction' ? TrapSystem.config.AURA_COLORS.ARMED_INTERACTION : TrapSystem.config.AURA_COLORS.ARMED)
                        : TrapSystem.config.AURA_COLORS.PAUSED;
                } else {
                    auraColor = trapData.type === 'interaction'
                        ? TrapSystem.config.AURA_COLORS.DISARMED_INTERACTION
                        : TrapSystem.config.AURA_COLORS.DISARMED;
                }

                token.set({
                    aura1_color: auraColor,
                    aura1_radius: TrapSystem.utils.calculateDynamicAuraRadius(token)
                });
                // After updating uses, immediately recalculate the detection aura to ensure it's correct.
                TrapSystem.passive.updateAuraForDetectionRange(token);

                this.log(`Updated trap state - Uses: ${current}/${max}, Armed: ${finalArmedState ? 'on' : 'off'} (New Format Update)`, 'info');
            } catch (err) {
                this.log(`Error updating trap uses (New Format Attempt): ${err.message}\nStack: ${err.stack}`, 'error');
            }
        },

        // Checking if token is ignoring traps
        isTrapImmune(token) {
            if(!token) return false;
            const hasMarker = token.get("statusmarkers")?.includes("blue") || false;
            const n = token.get("gmnotes") || "";
            const hasTag = n.includes("{ignoretraps}");
            return (hasMarker && hasTag);
        },

        // Toggle ignore traps
        toggleIgnoreTraps(token) {
            if(!token) {
                this.log('No token selected for toggling ignore traps');
                return;
            }
            let notes = token.get("gmnotes") || "";
            let dec = notes;
            try { dec = decodeURIComponent(notes);} catch(e) {}
            let updated;
            if(dec.includes("{ignoretraps}")) {
                updated = dec.replace(/\{ignoretraps\}/, '');
                this.chat(`Removed ignoretraps tag from ${token.get("name") || "token"}`);
            } else {
                updated = dec + " {ignoretraps}";
                this.chat(`Added ignoretraps tag to ${token.get("name") || "token"}`);
            }
            token.set("gmnotes", updated);

            const curMarkers = token.get("statusmarkers") || "";
            const hasM = curMarkers.includes("blue");
            if(hasM) {
                token.set("statusmarkers", curMarkers.replace("blue",""));
            } else {
                token.set("statusmarkers", curMarkers + "blue");
            }
        },

        // Parsing locked token notes
        parseTokenNotes(notes) {
            if(!notes) return null;
            let dec = notes;
            try { dec = decodeURIComponent(notes); } catch(e) {}
            const m = dec.match(/\{!traplocked\s*trap:\s*([^\s}]+)/);
            if(!m) return null;
            return { trapId: m[1], isLocked: true };
        },
        updateTokenLockState(token, trapId, locked) {
            if(!token) return;
            let notes = token.get("gmnotes") || "";
            let dec = notes;
            try { dec = decodeURIComponent(notes); } catch(e) {}
            let upd;
            if(locked) {
                if(dec.includes('!traplocked')) {
                    upd = dec.replace(/\{!traplocked[^}]*\}/, `{!traplocked trap: ${trapId}}`);
                } else {
                    upd = dec + `{!traplocked trap: ${trapId}}`;
                }
            } else {
                upd = dec.replace(/\{!traplocked[^}]*\}/, '');
            }
            token.set("gmnotes", upd);
            this.log(`Token lock updated => trap:${trapId}, locked:${locked}`, 'info');
        },

        // For "intersection" style movement
        calculateTrapPosition(movedToken, trapToken, intersection) {
            TrapSystem.utils.log(`[CalcTrapPos-ENTRY] trap.id: ${trapToken.id}, raw_intersection_arg: (${intersection.x.toFixed(2)}, ${intersection.y.toFixed(2)})`, 'debug');
            const trapData = this.parseTrapNotes(trapToken.get("gmnotes"), trapToken);
            TrapSystem.utils.log(`[CalcTrapPos-ENTRY] trap.id: ${trapToken.id}, parsed trapData.position: ${trapData ? trapData.position : 'N/A (no trapData)'}`, 'debug');

            const trapCoords = this.getTokenGridCoords(trapToken);
            if (!trapCoords) {
                this.log("calculateTrapPosition: Trap coordinates not found.", "warning");
                return { initial: intersection, final: intersection }; 
            }
            const currentGridSize = trapCoords.gridSize;
            const rawIntersectionPoint = { x: intersection.x, y: intersection.y }; // This is the geometric intersection point argument
            
            let initialCalculatedPos; // This will be the grid-snapped version of rawIntersectionPoint (for intersection type) or trap-center (for center type)
            let finalPos; 

            const getOccupiedPixelPositions = () => {
                return Object.entries(TrapSystem.state.lockedTokens)
                    .filter(([id, v]) => v.trapToken === trapToken.id && id !== movedToken.id) 
                    .map(([id, _]) => {
                        const t = getObj("graphic", id);
                        return t ? { x: t.get("left"), y: t.get("top") } : null;
                    })
                    .filter(Boolean);
            };
            
            const isPixelPosOccupied = (candidatePixelX, candidatePixelY, occupiedList) => {
                return occupiedList.some(o => {
                    const dx = o.x - candidatePixelX;
                    const dy = o.y - candidatePixelY;
                    return Math.sqrt(dx * dx + dy * dy) < (currentGridSize * 0.5); 
                });
            };

            const findUnoccupiedCellNear = (basePixelX, basePixelY, tc, occupiedList, searchTrapBoundsOnly = true) => {
                this.log(`[CalcTrapPos-findUnoccupiedCellNear] basePixel: (${basePixelX.toFixed(2)}, ${basePixelY.toFixed(2)}), tc.x: ${tc.x}, tc.y: ${tc.y}, tc.width: ${tc.width}, tc.height: ${tc.height}, searchTrapBoundsOnly: ${searchTrapBoundsOnly}`, 'debug');
                
                let targetCellCol = Math.round(basePixelX / currentGridSize - 0.5);
                let targetCellRow = Math.round(basePixelY / currentGridSize - 0.5);
                this.log(`[CalcTrapPos-findUnoccupiedCellNear] Initial absolute target cell from basePixel: (${targetCellCol}, ${targetCellRow})`, 'debug');

                if (searchTrapBoundsOnly) {
                    const relTargetCol = targetCellCol - tc.x;
                    const relTargetRow = targetCellRow - tc.y;
                    const clampedRelCol = Math.min(Math.max(0, relTargetCol), tc.width - 1);
                    const clampedRelRow = Math.min(Math.max(0, relTargetRow), tc.height - 1);
                    targetCellCol = tc.x + clampedRelCol;
                    targetCellRow = tc.y + clampedRelRow;
                    this.log(`[CalcTrapPos-findUnoccupiedCellNear] Clamped absolute target cell (within trap bounds): (${targetCellCol}, ${targetCellRow})`, 'debug');
                }
                
                let primaryTargetPixelX = targetCellCol * currentGridSize + currentGridSize / 2;
                let primaryTargetPixelY = targetCellRow * currentGridSize + currentGridSize / 2;
                this.log(`[CalcTrapPos-findUnoccupiedCellNear] Primary target pixel center: (${primaryTargetPixelX.toFixed(2)}, ${primaryTargetPixelY.toFixed(2)})`, 'debug');

                let newPos = { x: primaryTargetPixelX, y: primaryTargetPixelY };

                if (isPixelPosOccupied(primaryTargetPixelX, primaryTargetPixelY, occupiedList)) {
                    this.log(`[CalcTrapPos-findUnoccupiedCellNear] Primary target is occupied. Searching adjacent...`, 'debug');
                    const adjacentOffsets = [
                        { dx: 0, dy: 0 }, 
                        { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, 
                        { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
                        { dx: 1, dy: 1 }, { dx: -1, dy: -1 },
                        { dx: 1, dy: -1 }, { dx: -1, dy: 1 }
                    ];

                    for (const offset of adjacentOffsets) {
                        const checkCellCol = targetCellCol + offset.dx;
                        const checkCellRow = targetCellRow + offset.dy;

                        if (searchTrapBoundsOnly) {
                            const checkRelCellX = checkCellCol - tc.x;
                            const checkRelCellY = checkCellRow - tc.y;
                            if (checkRelCellX < 0 || checkRelCellX >= tc.width ||
                                checkRelCellY < 0 || checkRelCellY >= tc.height) {
                                this.log(`[CalcTrapPos-findUnoccupiedCellNear] Skipping adjacent cell (${checkCellCol},${checkCellRow}) as it's outside trap bounds.`, 'debug');
                                continue; 
                            }
                        }
                            
                        const candidatePixelX = checkCellCol * currentGridSize + currentGridSize / 2;
                        const candidatePixelY = checkCellRow * currentGridSize + currentGridSize / 2;

                        if (!isPixelPosOccupied(candidatePixelX, candidatePixelY, occupiedList)) {
                            newPos = { x: candidatePixelX, y: candidatePixelY };
                            this.log(`[CalcTrapPos-findUnoccupiedCellNear] Found unoccupied adjacent cell: (${newPos.x.toFixed(2)}, ${newPos.y.toFixed(2)}) at grid (${checkCellCol},${checkCellRow})`, 'debug');
                            break; 
                        }
                    }
                } else {
                     this.log(`[CalcTrapPos-findUnoccupiedCellNear] Primary target is NOT occupied. Using it.`, 'debug');
                }
                return newPos;
            };

            const effectiveTrapPositionType = (trapData && trapData.position) ? trapData.position : 'intersection'; // Default to intersection
            const occupiedPixelPosList = getOccupiedPixelPositions();

            if (effectiveTrapPositionType === 'center') {
                this.log(`[CalcTrapPos-MAIN] Position type: 'center'. Trap: ${trapToken.id}`, 'debug');
                const trapTokenCenterX = trapToken.get("left");
                const trapTokenCenterY = trapToken.get("top");
                initialCalculatedPos = findUnoccupiedCellNear(trapTokenCenterX, trapTokenCenterY, trapCoords, occupiedPixelPosList, true); 
                finalPos = { ...initialCalculatedPos }; 
            
            } else if (typeof effectiveTrapPositionType === 'object' && 
                       effectiveTrapPositionType.x !== undefined && 
                       effectiveTrapPositionType.y !== undefined) {
                this.log(`[CalcTrapPos-MAIN] Position type: 'specific coords' ${JSON.stringify(effectiveTrapPositionType)}. Trap: ${trapToken.id}`, 'debug');
                const targetRelCellX = Math.min(Math.max(0, effectiveTrapPositionType.x), trapCoords.width - 1);
                const targetRelCellY = Math.min(Math.max(0, effectiveTrapPositionType.y), trapCoords.height - 1);
                
                const specificTargetPixelX = (trapCoords.x + targetRelCellX) * currentGridSize + currentGridSize / 2;
                const specificTargetPixelY = (trapCoords.y + targetRelCellY) * currentGridSize + currentGridSize / 2;
                
                initialCalculatedPos = findUnoccupiedCellNear(specificTargetPixelX, specificTargetPixelY, trapCoords, occupiedPixelPosList, true);
                finalPos = { ...initialCalculatedPos }; 

            } else { // Includes 'intersection' and any other unrecognized, defaulting to intersection behavior
                if (effectiveTrapPositionType !== 'intersection') {
                    this.log(`[CalcTrapPos-MAIN] Position type: '${effectiveTrapPositionType}' (unrecognized, defaulting to OBB-sensitive intersection). Trap: ${trapToken.id}`, 'warn');
                } else {
                    this.log(`[CalcTrapPos-MAIN] Position type: 'intersection' (OBB-sensitive). Trap: ${trapToken.id}`, 'debug');
                }
                
                this.log(`[CalcTrapPos-OBBIntersection] Raw geometric intersection point: (${rawIntersectionPoint.x.toFixed(2)}, ${rawIntersectionPoint.y.toFixed(2)})`, 'debug');
                const obbCorners = this.getOBBCorners(trapToken);

                if (!obbCorners) {
                    this.log('[CalcTrapPos-OBBIntersection] Could not get OBB corners for trap. Defaulting to basic grid snap of raw intersection.', 'error');
                    const snappedCellCol_abs = Math.round(rawIntersectionPoint.x / currentGridSize - 0.5);
                    const snappedCellRow_abs = Math.round(rawIntersectionPoint.y / currentGridSize - 0.5);
                    initialCalculatedPos = {
                        x: snappedCellCol_abs * currentGridSize + currentGridSize / 2,
                        y: snappedCellRow_abs * currentGridSize + currentGridSize / 2
                    };
                } else {
                    let bestCellCenter = null;
                    let minDistanceSqToIntersection = Infinity;
                    const searchRadiusCells = 1; // Search 1 cell around (3x3 area), including the center cell.

                    const centerCellCol = Math.round(rawIntersectionPoint.x / currentGridSize - 0.5);
                    const centerCellRow = Math.round(rawIntersectionPoint.y / currentGridSize - 0.5);

                    for (let dRow = -searchRadiusCells; dRow <= searchRadiusCells; dRow++) {
                        for (let dCol = -searchRadiusCells; dCol <= searchRadiusCells; dCol++) {
                            const currentCellCol = centerCellCol + dCol;
                            const currentCellRow = centerCellRow + dRow;
                            const candidateCellCenter = {
                                x: currentCellCol * currentGridSize + currentGridSize / 2,
                                y: currentCellRow * currentGridSize + currentGridSize / 2
                            };

                            if (this.isPointInOBB(candidateCellCenter, obbCorners)) {
                                const dx = candidateCellCenter.x - rawIntersectionPoint.x;
                                const dy = candidateCellCenter.y - rawIntersectionPoint.y;
                                const distSq = dx * dx + dy * dy;

                                if (distSq < minDistanceSqToIntersection) {
                                    minDistanceSqToIntersection = distSq;
                                    bestCellCenter = candidateCellCenter;
                                }
                                this.log(`[CalcTrapPos-OBBIntersection] Candidate cell (${currentCellCol},${currentCellRow}), center (${candidateCellCenter.x.toFixed(2)},${candidateCellCenter.y.toFixed(2)}) IS IN OBB. DistSq: ${distSq.toFixed(2)}`, 'debug');
                            } else {
                                 this.log(`[CalcTrapPos-OBBIntersection] Candidate cell (${currentCellCol},${currentCellRow}), center (${candidateCellCenter.x.toFixed(2)},${candidateCellCenter.y.toFixed(2)}) is NOT in OBB.`, 'debug');
                            }
                        }
                    }

                    if (bestCellCenter) {
                        initialCalculatedPos = bestCellCenter;
                        this.log(`[CalcTrapPos-OBBIntersection] Best cell center found in OBB: (${bestCellCenter.x.toFixed(2)}, ${bestCellCenter.y.toFixed(2)})`, 'debug');
                    } else {
                        this.log('[CalcTrapPos-OBBIntersection] No cell center within search radius found inside OBB. Defaulting to basic grid snap of raw intersection.', 'warn');
                        const snappedCellCol_abs = Math.round(rawIntersectionPoint.x / currentGridSize - 0.5);
                        const snappedCellRow_abs = Math.round(rawIntersectionPoint.y / currentGridSize - 0.5);
                        initialCalculatedPos = {
                            x: snappedCellCol_abs * currentGridSize + currentGridSize / 2,
                            y: snappedCellRow_abs * currentGridSize + currentGridSize / 2
                        };
                    }
                }
                
                this.log(`[CalcTrapPos-OBBIntersection] Snapped initialCalculatedPos: (${initialCalculatedPos.x.toFixed(2)}, ${initialCalculatedPos.y.toFixed(2)})`, 'debug');

                if (!isPixelPosOccupied(initialCalculatedPos.x, initialCalculatedPos.y, occupiedPixelPosList)) {
                    finalPos = { ...initialCalculatedPos };
                    this.log(`[CalcTrapPos-OBBIntersection] Snapped initial position is NOT occupied. Using it as finalPos.`, 'debug');
                } else {
                    this.log(`[CalcTrapPos-OBBIntersection] Snapped initial position IS OCCUPIED. Calling findUnoccupiedCellNear (searchTrapBoundsOnly=false for adjacency search).`, 'debug');
                    finalPos = findUnoccupiedCellNear(initialCalculatedPos.x, initialCalculatedPos.y, trapCoords, occupiedPixelPosList, false);
                }
            }

            this.log(`[CalcTrapPos-EXIT] trap.id: ${trapToken.id}, final initialCalculatedPos: (${initialCalculatedPos.x.toFixed(2)},${initialCalculatedPos.y.toFixed(2)}), final finalPos: (${finalPos.x.toFixed(2)},${finalPos.y.toFixed(2)})`, 'debug');
            return { initial: initialCalculatedPos, final: finalPos };
        },

        showHelpMenu: function(target = 'API') {
            const skillListForQuery = Object.keys(TrapSystem.config.SKILL_TYPES).join('|');
            const helpMenu = [
                '&{template:default}',
                '{{name=🎯 Trap System Help}}',
                '{{About=The Trap System allows you to create and manage traps, skill checks, and interactions. Traps can be triggered by movement or manually.}}',
                '{{Setup Traps=',
                '[🎯 Setup Standard Trap](!trapsystem setup ?{Uses|1} ?{Main Macro - #MacroName, &quot;!cmd&quot;, &quot;Chat Text&quot;, &quot;^｛template｝&quot; - Note: remember to use quotes} ?{Optional Macro 2 - #MacroName, &quot;!cmd&quot;, &quot;Chat Text&quot;, &quot;^｛template｝&quot; - Note: remember to use quotes|None} ?{Optional Macro 3 - #MacroName, &quot;!Command&quot;, &quot;Chat Text&quot; - Note: remember to use quotes|None} ?{Movement - Note: If you select --Grid-- please adjust via the GM Notes|Intersection|Center|Grid} ?{Auto Trigger|false|true})',
                `[🔍 Setup Interaction Trap](!trapsystem setupinteraction ?{Uses|1} ?{Primary Macro - #MacroName, &quot;!cmd&quot;, &quot;Chat Text&quot;, &quot;^｛template｝&quot; - Note: remember to use quotes|None} ?{Success Macro - #MacroName, &quot;!cmd&quot;, &quot;Chat Text&quot;, &quot;^｛template｝&quot; - Note: remember to use quotes|None} ?{Failure Macro - #MacroName, &quot;!cmd&quot;, &quot;Chat Text&quot;, &quot;^｛template｝&quot; - Note: remember to use quotes|None} ?{First Check Type|${skillListForQuery}} ?{First Check DC|10} ?{Second Check Type|None|${skillListForQuery}} ?{Second Check DC|10} ?{Movement Trigger Enabled|true|false} ?{Movement - Note: If you select --Grid-- please adjust via the GM Notes|Intersection|Center|Grid} ?{Auto Trigger|false|true})`,
                '[🛠️ Setup Detection](!trapsystem passivemenu)}}',
                '{{Trap Control=',
                '[🔄 Toggle](!trapsystem toggle) - Toggle selected trap on/off\n',
                '[⚡ Trigger](!trapsystem trigger) - Manually trigger selected trap\n',
                '[🎯 Show Menu](!trapsystem showmenu) - Show the interaction menu\n',
                '[🚶‍♂️ Allow Movement](!trapsystem allowmovement selected) - Allow single token movement\n',
                '[📊 Status](!trapsystem status) - Show trap status}}',
                '{{System Control=',
                '[✅ Enable](!trapsystem enable) - Enable triggers (does not unlock tokens)\n',
                '[❌ Disable](!trapsystem disable) - Disable triggers (does not unlock tokens)\n',
                '[👥 Allow All](!trapsystem allowall) - Allow movement for all locked tokens\n',
                '[🧹 Reset Detection](!trapsystem resetdetection) - Clears all passively noticed traps for all\n',
                '[🙈 Hide Detections](!trapsystem hidedetection ?{Minutes - 0 for indefinitely|0}) - Hide all detection auras (0 = indefinitely)\n',
                '[👁️ Show Detections](!trapsystem showdetection) - Show all detection auras\n',
                '[🛡️ Toggle Immunity](!trapsystem ignoretraps) - Toggle token to ignore traps}}',
                '{{Tips=',
                '• <b style="color:#f04747;">Macro Types:</b> Actions can be a Roll20 Macro <span style="color:#ffcb05">#MacroName</span>, an API command <span style="color:#ffcb05">"!command"</span>, or plain chat <span style="color:#ffcb05">"text message"</span>.<br>',
                '• <b style="color:#f04747;">Workarounds:</b> To use API commands or templates in setup, you MUST disguise them. Use <span style="color:#ffcb05">$</span> for commands e.g., <span style="color:#ffcb05">"$deal-damage"</span> and <span style="color:#ffcb05">^</span> for templates e.g., <span style="color:#ffcb05">"^｛template:default｝..."</span>.<br>',
                '• <b style="color:#f04747;">Use Quotes!:</b> When using setup commands, any Text, Template or Command with spaces MUST be wrapped in <span style="color:#ffcb05">"double quotes"</span>.<br>',
                '• <b style="color:#f04747;">Placeholders:</b> Use <span style="color:#ffcb05">&lt;&trap&gt;</span> for the trap token and <span style="color:#ffcb05">&lt;&trapped&gt;</span> for the token that triggered it.<br>',
                '• <b style="color:#f04747;">Token Selection:</b> Most commands require a trap token to be selected first.<br>',
                '• <b style="color:#f04747;">Interaction Traps:</b> You can disable movement triggers on interaction traps to make them manually activated only.<br>',
                '• <b style="color:#f04747;">Skill Checks:</b> Interaction traps accept advantage/disadvantage.}}'
            ].join(' ');
            sendChat(target, `/w GM ${helpMenu}`);
        },

        // Send a message to the GM when a trap is depleted, with a re-arm button
        sendDepletedMessage(trapToken) {
            if (!trapToken) return;
            const trapName = trapToken.get("name") || "Unnamed Trap";
            const trapId = trapToken.id;
            const menu = [
                '&{template:default}',
                `{{name=🔴 Trap Depleted}}`,
                `{{message=${trapName} has been depleted and auto-disarmed.}}`,
                `{{action=[⚙️ Re-arm](!trapsystem rearm ${trapId})}}`
            ].join(' ');
            this.chat(menu);
        },

        /**
         * Build a tag-to-ID map for macro replacement, using standard tags from config.
         * @param {object} trapToken - The trap token object
         * @param {object} trappedToken - The trapped token object
         * @param {object} [extraTokens] - Optional. Object mapping extra tag names to token objects or IDs
         * @returns {object} - Map of tag name to token ID
         */

        buildTagToIdMap(trapToken, trappedToken, extraTokens) {
            const map = {};
            if (trapToken) map.trap = trapToken.id || trapToken;
            if (trappedToken) map.trapped = trappedToken.id || trappedToken;
            if (extraTokens && typeof extraTokens === 'object') {
                Object.keys(extraTokens).forEach(tag => {
                    const val = extraTokens[tag];
                    map[tag] = val && val.id ? val.id : val;
                });
            }
            return map;
        },
        
        /**
         * Replace Roll20-style macro placeholders (e.g., @{selected|token_id}, @{target|token_id}, etc.) with token IDs based on order-sensitive tags at the end of the macro.
         * This supports both trap system automation and normal Roll20 macro use.
         * Example macro:
         *   !spawnComplexFx FX[myCustomBeam] ID[@{selected|token_id}] TARGET[@{target|token_id}] TR[1] TI[1] [trap] [trapped]
         *   - The tags at the end determine which placeholder gets replaced with which token ID.
         *   - If a tag is [-], the corresponding placeholder is left as-is.
         *   - The function removes the tags from the macro after processing.
         *   - Standard tags are defined in TrapSystem.config.MACRO_TAGS.
         * @param {string} macro - The macro string to process
         * @param {object} tagToIdMap - Object mapping tag names to token IDs
         * @returns {string} - The processed macro with placeholders replaced
         */

        replaceMacroPlaceholdersWithTags(macro, tagToIdMap) {
            if (!macro) return "";

            // 1. Pre-process to convert common @{...} placeholders to our internal format <&...>
            // This now treats @TOKENID@ as an alias for the main context token.
            let processedMacro = macro
                .replace(/@TOKENID@/g, '<&trap>')
                .replace(/@{selected\|token_id}/g, '<&trap>')
                .replace(/@{target\|token_id}/g, '<&t1>');

            // 2. Convert /fx commands to !spawnComplexFx. This is important to do before replacing tags,
            // as the conversion logic itself uses the <&...> tags.
            processedMacro = this.convertFxToSpawnComplex(processedMacro, tagToIdMap);
            
            this.log(`Macro after pre-processing and FX conversion: ${processedMacro}`, 'debug');
            this.log(`TagToIdMap to be used for replacement: ${JSON.stringify(tagToIdMap)}`, 'debug');

            // 3. Replace all <&...> tags with their corresponding IDs from the map.
            for (const [tag, tokenId] of Object.entries(tagToIdMap)) {
                if(tokenId) {
                    // Create a regex for the specific tag, e.g., /<&trap>/g
                    const tagRegex = new RegExp(`<&${tag}>`, 'g');
                    processedMacro = processedMacro.replace(tagRegex, tokenId);
                }
            }

            this.log(`Final processed macro after tag replacement: ${processedMacro}`, 'debug');
            return processedMacro;
        },

        // From MacroExport: Get object by ID (graphic, door, window, pathv2)
        getObjectById(id) {
            return getObj("graphic", id) ||
                   getObj("door", id) ||
                   getObj("window", id) ||
                   getObj("pathv2", id);
        },

        // From MacroExport: Get relevant state properties of an object
        getObjectState(obj) {
            if (!obj) return null;
            const type = obj.get("_type");
            let capturedProps = {}; // Initialize an empty object

            if (type === "graphic") {
                capturedProps = {
                    layer: obj.get("layer"), gmnotes: obj.get("gmnotes"), name: obj.get("name"),
                    left: obj.get("left"), top: obj.get("top"), width: obj.get("width"), height: obj.get("height"),
                    rotation: obj.get("rotation"), fliph: obj.get("fliph"), flipv: obj.get("flipv"),
                    aura1_radius: obj.get("aura1_radius"), aura1_color: obj.get("aura1_color"),
                    aura1_square: obj.get("aura1_square"), aura2_radius: obj.get("aura2_radius"),
                    aura2_color: obj.get("aura2_color"), aura2_square: obj.get("aura2_square"),
                    tint_color: obj.get("tint_color"), statusmarkers: obj.get("statusmarkers"),
                    bar1_value: obj.get("bar1_value"), bar1_max: obj.get("bar1_max"),
                    bar2_value: obj.get("bar2_value"), bar2_max: obj.get("bar2_max"),
                    bar3_value: obj.get("bar3_value"), bar3_max: obj.get("bar3_max"),
                    light_radius: obj.get("light_radius"), light_dimradius: obj.get("light_dimradius"),
                    light_otherplayers: obj.get("light_otherplayers"), light_hassight: obj.get("light_hassight"),
                    light_angle: obj.get("light_angle"), light_losangle: obj.get("light_losangle"),
                    light_multiplier: obj.get("light_multiplier"),
                    adv_fow_view_distance: obj.get("adv_fow_view_distance"),
                    imgsrc: obj.get("imgsrc")
                };
            } else if (type === "pathv2") {
                capturedProps = {
                    // Common properties for paths
                    layer: obj.get("layer"), gmnotes: obj.get("gmnotes"), name: obj.get("name"),
                    // Path specific properties
                    path: obj.get("path"), fill: obj.get("fill"), stroke: obj.get("stroke"),
                    stroke_width: obj.get("stroke_width"),
                    // Positional and dimensional properties for paths
                    left: obj.get("left"), top: obj.get("top"), // Path's top-left corner
                    width: obj.get("width"), height: obj.get("height"), // Overall dimensions
                    scaleX: obj.get("scaleX"), scaleY: obj.get("scaleY"),
                    rotation: obj.get("rotation")
                };
            } else if (type === "door" || type === "window") {
                 capturedProps = { // Only capture these specific properties for doors/windows
                    isOpen: obj.get("isOpen"),
                    isLocked: obj.get("isLocked"),
                    isSecret: obj.get("isSecret")
                    // Do NOT capture layer, gmnotes, name, or extensive positional data here
                    // as they might not be standard or reliably settable, causing reset errors.
                };
            } else {
                TrapSystem.utils.log(`[getObjectState] Encountered unknown object type '${type}' for ID ${obj.id}. Capturing minimal common properties (layer, name, gmnotes) if available.`, 'warn');
                capturedProps = {
                    layer: obj.get("layer"), // Attempt to get layer, may be undefined
                    name: obj.get("name"),
                    gmnotes: obj.get("gmnotes")
                };
            }
            TrapSystem.utils.log(`[getObjectState] Captured for ${type} ${obj.id}: ${JSON.stringify(capturedProps)}`, 'debug');
            return capturedProps;
        },

        // Calculate distance between two tokens
        calculateTokenDistance(token1, token2) {
            if (!token1 || !token2 || token1.get('_pageid') !== token2.get('_pageid')) {
                this.log("Cannot calculate distance: tokens are invalid or on different pages.", "warn");
                return { pixelDistance: Infinity, mapUnitDistance: Infinity };
            }
            const pageId = token1.get('_pageid');
            const pageSettings = this.getPageSettings(pageId);
            if (!pageSettings.valid) {
                 this.log("Cannot calculate distance: page settings invalid.", "warn");
                return { pixelDistance: Infinity, mapUnitDistance: Infinity };
            }

            const t1Coords = this.getTokenGridCoords(token1);
            const t2Coords = this.getTokenGridCoords(token2);

            if (!t1Coords || !t2Coords) {
                 this.log("Cannot calculate distance: failed to get token coordinates.", "warn");
                return { pixelDistance: Infinity, mapUnitDistance: Infinity };
            }
            
            const dxPixels = t1Coords.pixelX - t2Coords.pixelX;
            const dyPixels = t1Coords.pixelY - t2Coords.pixelY;
            const pixelDistance = Math.sqrt(dxPixels * dxPixels + dyPixels * dyPixels);
            
            const mapUnitDistance = (pixelDistance / pageSettings.gridSize) * pageSettings.scale;
            
            return { pixelDistance, mapUnitDistance };
        },

        // Calculate dynamic aura radius to achieve a consistent visual size
        calculateDynamicAuraRadius(token) {
            
            /*
             * Roll20 Aura Rendering System (Discovered through testing):
             * 
             * POSITIVE RADIUS: Standard center-based circular aura
             * - Used when token is small enough that aura extends beyond it
             * - Shows configured radius (default 1 grid unit)
             * 
             * NEGATIVE RADIUS: Special border-extension mode with two patterns:
             * - Used only when token is large enough to hide the standard aura
             * 
             * Pattern 1 (MinGU >= 4): radius = -2.5 × (MaxGU - MinGU) + boost
             *   - Works for 4x4, 5x5, 6x6, 7x7 and their elongated variants
             *   - Creates consistent border thickness based on token elongation
             * 
             * Pattern 2 (MinGU < 4): radius = multiplier × MinGU + boost
             *   - MinGU <= 2: multiplier = -3.75
             *   - MinGU 2-3: interpolated between -3.75 and -6.67
             *   - Creates thicker borders for small tokens
             * 
             * Phase Detection: Only use negative radius when standard aura would be hidden
             */
            
            if (!token) {
                this.log("calculateDynamicAuraRadius: Invalid token provided.", "error");
                return TrapSystem.config.aura.TARGET_RADIUS_GRID_UNITS * (TrapSystem.config.DEFAULT_SCALE || 1);
            }
            const pageSettings = this.getPageSettings(token.get("_pageid"));
            if (!pageSettings.valid) {
                this.log("calculateDynamicAuraRadius: Page settings invalid. Using default target radius scaled by page units.", "warning");
                return TrapSystem.config.aura.TARGET_RADIUS_GRID_UNITS * (pageSettings.scale || TrapSystem.config.DEFAULT_SCALE);
            }

            const tokenWidthPixels = token.get("width");
            const tokenHeightPixels = token.get("height");
            const gridSizePixels = pageSettings.gridSize;
            const configTargetVisualGU = TrapSystem.config.aura.TARGET_RADIUS_GRID_UNITS;
            const boostGU = TrapSystem.config.aura.VISIBILITY_BOOST_GU;

            // Fallback for tokens with zero or very small dimensions or invalid grid
            const refVisualGU_fallback = 1.0;
            const refInputM1_fallback = 2.5;
            const default_fallback_radius = refInputM1_fallback * (configTargetVisualGU / refVisualGU_fallback);

            if (tokenWidthPixels <= 0.01 || tokenHeightPixels <= 0.01 || gridSizePixels <= 0) {
                this.log(`calculateDynamicAuraRadius: Token ${token.id} has zero/small dimensions or invalid gridSize. Defaulting to fallback radius: ${default_fallback_radius.toFixed(2)}.`, 'debug');
                return default_fallback_radius;
            }

            const widthGU = tokenWidthPixels / gridSizePixels;
            const heightGU = tokenHeightPixels / gridSizePixels;
            const MGU_raw = Math.max(widthGU, heightGU);
            const MinGU = Math.min(widthGU, heightGU);

            const standardAuraRadiusGU = configTargetVisualGU; // Base aura size in Grid Units
            const standardAuraDiameterGU = standardAuraRadiusGU * 2;

            let radiusToSetInPageUnits;

            // Behavior 2: Thick Tokens (Shortest side ≥ Aura Diameter)
            if (MinGU >= standardAuraDiameterGU) {
                this.log(`Behavior 2 (Thick Token): MinGU ${MinGU.toFixed(2)} >= AuraDiameter ${standardAuraDiameterGU.toFixed(2)}. Using unified negative radius.`, 'debug');
                const boostInPageUnits = boostGU * pageSettings.scale;
                
                // Unified formula for all thick tokens
                // Base radius becomes more negative as the token elongates, creating a consistent border appearance
                const baseRadius = -2.5 * (MGU_raw - MinGU);
                radiusToSetInPageUnits = baseRadius + boostInPageUnits;
                this.log(`   Unified Thick Formula: -2.5 * (${MGU_raw.toFixed(2)} - ${MinGU.toFixed(2)}) + boost -> Base: ${baseRadius.toFixed(2)}, Final: ${radiusToSetInPageUnits.toFixed(2)}`, 'debug');
            } 
            // Behavior 1: Thin Tokens (Shortest side < Aura Diameter)
            else {
                this.log(`Behavior 1 (Thin Token): MinGU ${MinGU.toFixed(2)} < AuraDiameter ${standardAuraDiameterGU.toFixed(2)}. Using AuraTester Phase 1 logic.`, 'debug');
                
                // --- Start of AuraTester Phase 1 logic --- 
                let R_v_t = configTargetVisualGU; // Effective target visual radius in GU
                const minTokenHalfDimGU = MinGU / 2.0;

                // Apply boost if the configured target visual radius is smaller than half the token's min dimension
                if (R_v_t <= minTokenHalfDimGU && MinGU > 0) { 
                    R_v_t = minTokenHalfDimGU + boostGU;
                    this.log(`   Thin token boost applied. ConfigTarget ${configTargetVisualGU.toFixed(2)} <= MinGU/2 ${minTokenHalfDimGU.toFixed(2)}. R_v_t set to ${R_v_t.toFixed(2)} GU`, 'debug');
                } else {
                    this.log(`   Thin token standard handling. R_v_t remains ${R_v_t.toFixed(2)} GU`, 'debug');
                }

                // Reference data: Inputs (page units) to achieve a 1.0 GU visual radius in AuraTester
                const refVisualGU = 1.0; 
                const input_at_MGU_0_5 = 3.5; // Input for 0.5GU token to get 1GU visual
                const input_at_MGU_1_0 = 2.5; // Input for 1.0GU token to get 1GU visual

                if (MGU_raw <= 0.5) { 
                    radiusToSetInPageUnits = input_at_MGU_0_5 * (R_v_t / refVisualGU);
                    this.log(`   (MGU_raw <= 0.5) Formula: input_at_MGU_0_5 * (${R_v_t.toFixed(2)} / ${refVisualGU}) -> ${radiusToSetInPageUnits.toFixed(2)}`, 'debug');
                } else if (MGU_raw <= 1.0) { 
                    const t = (MGU_raw - 0.5) / (1.0 - 0.5); // Interpolation factor
                    const scaled_input_0_5 = input_at_MGU_0_5 * (R_v_t / refVisualGU);
                    const scaled_input_1_0 = input_at_MGU_1_0 * (R_v_t / refVisualGU);
                    radiusToSetInPageUnits = scaled_input_0_5 * (1 - t) + scaled_input_1_0 * t;
                    this.log(`   (MGU_raw <= 1.0) Interpolated: scaled_0.5=${scaled_input_0_5.toFixed(2)}, scaled_1.0=${scaled_input_1_0.toFixed(2)}, t=${t.toFixed(2)} -> ${radiusToSetInPageUnits.toFixed(2)}`, 'debug');
                } else { 
                    // MGU_raw > 1.0 but still a "Thin" token
                    const scaled_input_for_1GU_token = input_at_MGU_1_0 * (R_v_t / refVisualGU);
                    radiusToSetInPageUnits = scaled_input_for_1GU_token * (2.0 - MGU_raw);
                    this.log(`   (MGU_raw > 1.0) Formula: scaled_input_1GU (${scaled_input_for_1GU_token.toFixed(2)}) * (2.0 - ${MGU_raw.toFixed(2)}) -> ${radiusToSetInPageUnits.toFixed(2)}`, 'debug');
                } 
                // --- End of AuraTester Phase 1 logic ---
            }
            
            this.log(`calculateDynamicAuraRadius for ${token.id}: Size ${widthGU.toFixed(1)}x${heightGU.toFixed(1)}GU -> Final Radius: ${radiusToSetInPageUnits.toFixed(2)} page units`, 'debug');
            return radiusToSetInPageUnits;
        },

        /**
         * [NEW from OBBTest.js]
         * Calculates the world coordinates of a token's visual corners after rotation.
         * @param {Graphic} token - The Roll20 token object.
         * @returns {Array<Object>|null} An array of 4 {x, y} points representing the corners, 
         *                                 or null if the token is invalid.
         *                                 Corners are typically ordered: TL, TR, BR, BL (relative to unrotated token).
         */

        getOBBCorners(token) {
            if (!token) {
                this.log('getOBBCorners: Invalid token provided.', 'error');
                return null;
            }

            const centerX = token.get('left');
            const centerY = token.get('top');
            const width = token.get('width');
            const height = token.get('height');
            const rotationDegrees = token.get('rotation');
            const rotationRadians = rotationDegrees * (Math.PI / 180);

            // this.log(`getOBBCorners for ${token.id}: Center=(${centerX},${centerY}), W=${width}, H=${height}, Deg=${rotationDegrees.toFixed(2)}`, 'debug');

            // Half dimensions
            const halfW = width / 2;
            const halfH = height / 2;

            // Unrotated corner coordinates relative to the token's center (0,0)
            // Order: Top-Left, Top-Right, Bottom-Right, Bottom-Left
            const localCorners = [
                { x: -halfW, y: -halfH }, // Top-Left
                { x:  halfW, y: -halfH }, // Top-Right
                { x:  halfW, y:  halfH }, // Bottom-Right
                { x: -halfW, y:  halfH }  // Bottom-Left
            ];

            const worldCorners = [];
            const cosR = Math.cos(rotationRadians);
            const sinR = Math.sin(rotationRadians);

            for (const corner of localCorners) {
                // Rotate
                const rotatedX = corner.x * cosR - corner.y * sinR;
                const rotatedY = corner.x * sinR + corner.y * cosR;

                // Translate to world coordinates
                worldCorners.push({
                    x: centerX + rotatedX,
                    y: centerY + rotatedY
                });
            }
            
            // this.log(`Calculated OBB Corners for ${token.id}: ${JSON.stringify(worldCorners)}`, 'debug');
            return worldCorners;
        },

        /**
         * [NEW] Checks if a line segment intersects with an Oriented Bounding Box (OBB).
         * @param {number} p1x - X-coordinate of the start of the line segment.
         * @param {number} p1y - Y-coordinate of the start of the line segment.
         * @param {number} p2x - X-coordinate of the end of the line segment.
         * @param {number} p2y - Y-coordinate of the end of the line segment.
         * @param {Array<Object>} obbCorners - An array of 4 {x, y} points representing the OBB corners (e.g., TL, TR, BR, BL).
         * @returns {Object|null} The intersection point {x, y} closest to (p1x, p1y), or null if no intersection.
         */

        lineSegmentIntersectsOBB(p1x, p1y, p2x, p2y, obbCorners) {
            if (!obbCorners || obbCorners.length !== 4) {
                this.log('lineSegmentIntersectsOBB: Invalid OBB corners provided.', 'error');
                return null;
            }

            let closestIntersection = null;
            let minDistanceSq = Infinity;

            // Define the OBB edges (lines)
            const obbEdges = [
                { x1: obbCorners[0].x, y1: obbCorners[0].y, x2: obbCorners[1].x, y2: obbCorners[1].y }, // TL to TR
                { x1: obbCorners[1].x, y1: obbCorners[1].y, x2: obbCorners[2].x, y2: obbCorners[2].y }, // TR to BR
                { x1: obbCorners[2].x, y1: obbCorners[2].y, x2: obbCorners[3].x, y2: obbCorners[3].y }, // BR to BL
                { x1: obbCorners[3].x, y1: obbCorners[3].y, x2: obbCorners[0].x, y2: obbCorners[0].y }  // BL to TL
            ];

            for (const edge of obbEdges) {
                const intersectionPoint = this.lineIntersection(p1x, p1y, p2x, p2y, edge.x1, edge.y1, edge.x2, edge.y2);
                if (intersectionPoint) {
                    const distSq = (intersectionPoint.x - p1x) ** 2 + (intersectionPoint.y - p1y) ** 2;
                    if (distSq < minDistanceSq) {
                        minDistanceSq = distSq;
                        closestIntersection = intersectionPoint;
                    }
                }
            }
            // this.log(`lineSegmentIntersectsOBB: Movement from (${p1x},${p1y}) to (${p2x},${p2y}). Closest OBB intersection: ${closestIntersection ? JSON.stringify(closestIntersection) : 'null'}`, 'debug');
            return closestIntersection;
        },

        /**
         * [NEW] Checks if a point is inside an Oriented Bounding Box (OBB).
         * @param {object} point - The point to check {x, y}.
         * @param {Array<Object>} obbCorners - An array of 4 {x, y} points representing the OBB corners, ordered (e.g., TL, TR, BR, BL).
         * @returns {boolean} True if the point is inside or on the boundary of the OBB, false otherwise.
         */
        
        isPointInOBB(point, obbCorners) {
            if (!point || !obbCorners || obbCorners.length !== 4) {
                this.log('isPointInOBB: Invalid arguments.', 'error');
                return false;
            }

            const c0 = obbCorners[0]; // Top-Left an unrotated rectangle sense
            const c1 = obbCorners[1]; // Top-Right
            // const c2 = obbCorners[2]; // Bottom-Right (not directly needed for AB, AD vectors from c0)
            const c3 = obbCorners[3]; // Bottom-Left

            const ABx = c1.x - c0.x;
            const ABy = c1.y - c0.y;
            const ADx = c3.x - c0.x;
            const ADy = c3.y - c0.y;

            const APx = point.x - c0.x;
            const APy = point.y - c0.y;

            const dotAB_AP = APx * ABx + APy * ABy;
            const dotAD_AP = APx * ADx + APy * ADy;

            const magSqAB = ABx * ABx + ABy * ABy;
            const magSqAD = ADx * ADx + ADy * ADy;

            // Point is inside if its projection onto AB is within AB's length, AND
            // its projection onto AD is within AD's length.
            // The 0 <= ... check handles cases where the point is outside along the vector before c0.
            // The ... <= magSq check handles cases where the point is outside along the vector beyond c1 or c3.
            return (0 <= dotAB_AP && dotAB_AP <= magSqAB &&
                    0 <= dotAD_AP && dotAD_AP <= magSqAD);
        },

        constructGmNotesFromTrapData(trapData) {
            if (!trapData) return "";
            TrapSystem.utils.log(`[constructGmNotesFromTrapData] Input trapData: ${JSON.stringify(trapData).substring(0,200)}...`, 'debug');

            // Helper to wrap values containing special characters in quotes
            const formatValue = (value) => {
                if (typeof value !== 'string') return value;
                // Only wrap if it contains special characters and is not already a safe command/macro
                if (value.includes('[') || value.includes(']')) {
                    // Escape any pre-existing backslashes and double quotes before wrapping
                    const escapedValue = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                    return `"${escapedValue}"`;
                }
                return value;
            };

            let triggerSettings = [];
            if (trapData.type) triggerSettings.push(`type:[${trapData.type}]`);
            
            if (trapData.maxUses !== undefined || trapData.currentUses !== undefined) {
                 triggerSettings.push(`uses:[${trapData.currentUses || 0}/${trapData.maxUses || 0}]`);
            }
        
            triggerSettings.push(`armed:[${trapData.isArmed ? 'on' : 'off'}]`); 
        
            if (trapData.primaryMacro && trapData.primaryMacro.macro) triggerSettings.push(`primaryMacro:[${formatValue(trapData.primaryMacro.macro)}]`);
            else if (trapData.primaryMacro && typeof trapData.primaryMacro === 'string') triggerSettings.push(`primaryMacro:[${formatValue(trapData.primaryMacro)}]`);

            if (trapData.failureMacro) triggerSettings.push(`failureMacro:[${formatValue(trapData.failureMacro)}]`);
            if (trapData.successMacro) triggerSettings.push(`successMacro:[${formatValue(trapData.successMacro)}]`);
            
            if (trapData.options && trapData.options.length > 0) {
                const formattedOptions = trapData.options.map(opt => opt.macro || opt.name).join(';');
                triggerSettings.push(`options:[${formattedOptions}]`);
            }
            if (trapData.checks && trapData.checks.length > 0) {
                triggerSettings.push(`checks:[${trapData.checks.map(c => `${c.type}:${c.dc}`).join(';')}]`);
            }
            
            triggerSettings.push(`movementTrigger:[${trapData.movementTrigger === false ? 'off' : 'on'}]`); 
            triggerSettings.push(`autoTrigger:[${trapData.autoTrigger ? 'on' : 'off'}]`); 
        
            let posStr = "intersection"; 
            if (typeof trapData.position === 'object' && trapData.position.x !== undefined && trapData.position.y !== undefined) {
                posStr = `${trapData.position.x},${trapData.position.y}`;
            } else if (typeof trapData.position === 'string' && trapData.position) {
                posStr = trapData.position;
            }
            triggerSettings.push(`position:[${posStr}]`);
        
            let newGmNotes = "";
            // Ensure traptrigger block is present if essential trap fields are there, or if there's any trigger specific content
            const hasEssentialTriggerInfo = trapData.type || trapData.primaryMacro || (trapData.failureMacro && trapData.type === 'interaction') || (trapData.successMacro && trapData.type === 'interaction');
            if (hasEssentialTriggerInfo || triggerSettings.some(s => !s.startsWith("armed:[") && !s.startsWith("movementTrigger:[") && !s.startsWith("autoTrigger:[") && !s.startsWith("position:["))) {
                 if (triggerSettings.length > 0) { // Add if any settings were actually generated
                    newGmNotes += `{!traptrigger ${triggerSettings.join(' ')}}`;
                 } else if (trapData.rawTriggerBlock) { // Fallback to raw if no settings generated but was there before
                    newGmNotes += `{!traptrigger ${trapData.rawTriggerBlock}}`;
                 }
            }


            let detectionSettings = [];
            if (trapData.passiveSpotDC !== null && trapData.passiveSpotDC !== undefined) detectionSettings.push(`passiveSpotDC:[${trapData.passiveSpotDC}]`);
            if (trapData.passiveMaxRange !== null && trapData.passiveMaxRange !== undefined) detectionSettings.push(`passiveMaxRange:[${trapData.passiveMaxRange}]`);
            if (trapData.passiveNoticePlayer && typeof trapData.passiveNoticePlayer === 'string' && trapData.passiveNoticePlayer.trim() !== "") {
                detectionSettings.push(`passiveNoticePlayer:[${formatValue(trapData.passiveNoticePlayer)}]`);
            }
            if (trapData.passiveNoticeGM && typeof trapData.passiveNoticeGM === 'string' && trapData.passiveNoticeGM.trim() !== "") {
                detectionSettings.push(`passiveNoticeGM:[${formatValue(trapData.passiveNoticeGM)}]`);
            }
            if (trapData.ppTokenBarFallback && typeof trapData.ppTokenBarFallback === 'string' && trapData.ppTokenBarFallback.toLowerCase() !== "none" && trapData.ppTokenBarFallback.trim() !== "") {
                detectionSettings.push(`ppTokenBarFallback:[${trapData.ppTokenBarFallback}]`);
            }
            if (trapData.showDetectionAura !== undefined) {
                detectionSettings.push(`showDetectionAura:[${trapData.showDetectionAura}]`);
            }
            if (trapData.enableLuckRoll !== undefined) {
                detectionSettings.push(`enableLuckRoll:[${trapData.enableLuckRoll}]`);
            }
            if (trapData.luckRollDie) {
                detectionSettings.push(`luckRollDie:[${trapData.luckRollDie}]`);
            }
            if (trapData.passiveEnabled === false) {
                detectionSettings.push(`passiveEnabled:[off]`);
            }
            if (detectionSettings.length > 0) {
                if (newGmNotes.length > 0) newGmNotes += " "; 
                newGmNotes += `{!trapdetection ${detectionSettings.join(' ')}}`;
            } else if (trapData.rawDetectionBlock && !triggerSettings.some(s => s.includes('passive'))) { 
                // If no new detection settings generated, but there was a raw block, and we are not disabling passive (which clears fields)
                // this case needs to be careful not to add back a block if 'disable' was used
                // The `property === "disable"` case in handleSetPassiveProperty should nullify these trapData fields.
            }
            
            TrapSystem.utils.log(`[constructGmNotesFromTrapData] Constructed notes: ${newGmNotes}`, 'debug');
            return newGmNotes.trim();
        },

        getSafeMacroDisplayName(macroString, maxLength = 25) {
            if (!macroString || typeof macroString !== 'string') return "(DE)";

            let displayName = macroString.trim();

            // 1. Handle Roll20 Macros
            if (displayName.startsWith('#')) {
                return `Macro: ${displayName.substring(1)}`;
            }

            // 2. Handle API Commands (strip quotes if they exist from setup)
            if (displayName.startsWith('"') && displayName.endsWith('"')) {
                displayName = displayName.substring(1, displayName.length - 1);
            }
            if (displayName.startsWith('!')) {
                displayName = `Cmd: ${displayName}`;
            } else if (displayName.startsWith('$')) {
                 displayName = `Cmd: !${displayName.substring(1)}`;
            }

            // 3. Handle Roll Templates
            else if (displayName.startsWith('&{template:')) {
                const nameMatch = displayName.match(/\{\{name=([^}]+)\}\}/);
                if (nameMatch && nameMatch[1]) {
                    displayName = `Template: "${nameMatch[1].trim()}"`;
                } else {
                    displayName = "Chat Template";
                }
            }

            // 4. Handle Plain Text (if it wasn't caught above)
            else {
                 displayName = `Text: "${displayName}"`;
            }

            // 5. Truncate if necessary
            if (displayName.length > maxLength) {
                return displayName.substring(0, maxLength - 3) + "...";
            }
            
            return displayName;
        },

        // Helper to parse and roll a luck die
        parseAndRollLuckDie(dieString) {
            if (!dieString) {
                TrapSystem.utils.log(`Called parseAndRollLuckDie with no dieString. Defaulting to 0.`, 'debug');
                return 0;
            }
            
            // Parse the die string (e.g., "1d6", "1d4", etc.)
            const match = dieString.match(/^(\d+)d(\d+)$/i);
            if (!match) {
                TrapSystem.utils.log(`Invalid luck die format: ${dieString}. Expected format like '1d6'.`, 'warn');
                return 0;
            }

            const numDice = parseInt(match[1], 10);
            const sides = parseInt(match[2], 10);
            
            if (isNaN(numDice) || isNaN(sides) || numDice < 1 || sides < 1) {
                TrapSystem.utils.log(`Invalid luck die values: ${dieString}.`, 'warn');
                return 0;
            }

            // Roll the die
            let total = 0;
            for (let i = 0; i < numDice; i++) {
                total += randomInteger(sides);
            }
            
            TrapSystem.utils.log(`Rolled luck die ${dieString}: ${total}`, 'debug');
            return total;
        },

        hasLineOfSight(observerToken, targetToken) {
            TrapSystem.utils.log('hasLineOfSight function started.', 'info'); // Unconditional log to confirm execution
            const DEBUG = TrapSystem.config.DEBUG;

            if (!observerToken || !targetToken) {
                TrapSystem.utils.log("Observer or target token is missing for LOS check.", "error");
                return false;
            }
            const pageId = observerToken.get("_pageid");
            if (targetToken.get("_pageid") !== pageId) {
                TrapSystem.utils.log("Observer and target are on different pages for LOS check.", "error");
                return false;
            }

            const p1 = TrapSystem.utils.getTokenCenter(observerToken);
            const p2 = TrapSystem.utils.getTokenCenter(targetToken);

            if (DEBUG) TrapSystem.utils.log(`Checking LOS from (${p1.x.toFixed(2)},${p1.y.toFixed(2)}) to (${p2.x.toFixed(2)},${p2.y.toFixed(2)}) on page ${pageId}`, "debug");

            // 1. Check against walls (Dynamic Lighting Lines)
            const pathsV1 = findObjs({ _pageid: pageId, _type: "path" });
            const pathsV2 = findObjs({ _pageid: pageId, _type: "pathv2" });
            const allPotentialWallPaths = [...pathsV1, ...pathsV2];
            const walls = allPotentialWallPaths.filter(p => p.get('layer') === 'walls');
            
            if (DEBUG) TrapSystem.utils.log(`Found ${walls.length} wall paths on DL layer for LOS check.`, "debug");

            let isBlockedByWall = false;
            for (const wall of walls) {
                const barrierType = wall.get('barrierType');

                if (barrierType === 'transparent') {
                    if (DEBUG) TrapSystem.utils.log(`  Skipping wall ${wall.id} because it is transparent (barrierType: 'transparent').`, "debug");
                    continue;
                }

                if (barrierType === 'oneWay') {
                    if (DEBUG) TrapSystem.utils.log(`  Treating one-way sight wall ${wall.id} as a standard blocking wall.`, "debug");
                }
                
                const wallCenterX = parseFloat(wall.get("x")) || 0;
                const wallCenterY = parseFloat(wall.get("y")) || 0;
                
                let isPathV2 = wall.get("_type") === "pathv2";
                let rawPathData = isPathV2 ? (wall.get("points") || wall.get("_path") || wall.get("path")) : wall.get("path");

                if (!rawPathData || typeof rawPathData !== 'string' || rawPathData.trim() === "") {
                    continue;
                }

                try {
                    const parsedPath = JSON.parse(rawPathData);
                    if (!Array.isArray(parsedPath) || parsedPath.length === 0) continue;

                    if (isPathV2) {
                        if (parsedPath.length < 2) continue;
                        
                        let minLocalX = parsedPath[0][0], maxLocalX = parsedPath[0][0], minLocalY = parsedPath[0][1], maxLocalY = parsedPath[0][1];
                        for (let i = 1; i < parsedPath.length; i++) {
                            minLocalX = Math.min(minLocalX, parsedPath[i][0]);
                            maxLocalX = Math.max(maxLocalX, parsedPath[i][0]);
                            minLocalY = Math.min(minLocalY, parsedPath[i][1]);
                            maxLocalY = Math.max(maxLocalY, parsedPath[i][1]);
                        }
                        const localShapeCenterX = (minLocalX + maxLocalX) / 2;
                        const localShapeCenterY = (minLocalY + maxLocalY) / 2;
                        const offsetX = wallCenterX - localShapeCenterX;
                        const offsetY = wallCenterY - localShapeCenterY;
                        
                        const absolutePoints = parsedPath.map(p_local => (Array.isArray(p_local) && p_local.length === 2) ? [p_local[0] + offsetX, p_local[1] + offsetY] : null).filter(p => p !== null);

                        if (absolutePoints.length < 2) continue;

                        for (let i = 0; i < absolutePoints.length - 1; i++) {
                            const [x1, y1] = absolutePoints[i];
                            const [x2, y2] = absolutePoints[i+1];
                            if (TrapSystem.utils.lineIntersection(p1.x, p1.y, p2.x, p2.y, x1, y1, x2, y2)) {
                                if (DEBUG) TrapSystem.utils.log(`LOS blocked by wall ${wall.id} (pathv2 segment ${i})`, "debug");
                                isBlockedByWall = true;
                                break;
                            }
                        }
                    } else {
                        let currentPoint = null;
                        for (const segment of parsedPath) {
                            const [command, x, y] = segment;
                            if (command === "M") {
                                currentPoint = { x, y };
                            } else if (command === "L" && currentPoint) {
                                if (TrapSystem.utils.lineIntersection(p1.x, p1.y, p2.x, p2.y, currentPoint.x, currentPoint.y, x, y)) {
                                    if (DEBUG) TrapSystem.utils.log(`LOS blocked by wall ${wall.id} (legacy segment)`, "debug");
                                    isBlockedByWall = true;
                                    break;
                                }
                                currentPoint = { x, y };
                            }
                        }
                    }
                    if (isBlockedByWall) break;

                } catch (e) {
                    TrapSystem.utils.log(`Error processing path for wall ${wall.id}. Data: '${rawPathData.substring(0,100)}...'. Error: ${e.message}`, "error");
                    continue;
                }
            }

            if (isBlockedByWall) {
                if (DEBUG) TrapSystem.utils.log(`LOS blocked by walls.`, "debug");
                return false;
            }

            // 2. Check against closed doors
            const doors = findObjs({ _pageid: pageId, _type: "door" });
            if (DEBUG && doors.length > 0) TrapSystem.utils.log(`Found ${doors.length} door objects for LOS check.`, "debug");
            for (const door of doors) {
                if (door.get("isOpen") === true) {
                    if (DEBUG) TrapSystem.utils.log(`  Door ${door.id} is open, skipping.`, "debug");
                    continue;
                }
                
                const doorPath = door.get("path");
                const doorCenterX = door.get("x");
                const doorCenterY_inverted = door.get("y");

                if (doorPath && typeof doorPath === 'object' && doorPath.handle0 && doorPath.handle1) {
                    const doorCenterY = -doorCenterY_inverted;
                    const x1 = doorCenterX + doorPath.handle0.x;
                    const y1 = doorCenterY + doorPath.handle0.y;
                    const x2 = doorCenterX + doorPath.handle1.x;
                    const y2 = doorCenterY + doorPath.handle1.y;

                    const intersection = TrapSystem.utils.lineIntersection(p1.x, p1.y, p2.x, p2.y, x1, y1, x2, y2);
                    if (intersection) {
                        TrapSystem.utils.log(`LOS blocked by closed door ${door.id}`, "info");
                        return false;
                    }
                }
            }
            
            // 3. Check windows (currently ignored)
            const windows = findObjs({ _pageid: pageId, _type: "window" });
            if (DEBUG && windows.length > 0) {
                TrapSystem.utils.log(`Found ${windows.length} window objects. Per user request, these are currently considered transparent and do not block LOS.`, "debug");
            }
            
            if (DEBUG) TrapSystem.utils.log("LOS clear of all obstacles.", "debug");
            return true;
        },

        // New utility to convert /fx commands
        convertFxToSpawnComplex(macroText, tagToIdMap) {
            // Define the regex for /fx commands first
            const fxRegex = /\/fx\s+([a-z0-9]+)(?:-([a-z0-9]+))?\s+([\w@{}|&;<>]+)/gi;

            // Check if TokenFX script is loaded
            if (typeof TokenFX === 'undefined') {
                if (macroText.match(fxRegex)) {
                    // Only send warning if an /fx command is actually present
                    this.chat("⚠️ **Warning:** A macro attempted to trigger a visual effect (`/fx` command), but the `TokenFX.js` script is not installed. The effect was not played. Please install `TokenFX.js` to enable this functionality.");
                    this.log("Skipping /fx conversion: TokenFX.js is not loaded.", "warning");
                    // Return the text with all /fx commands removed to prevent them from showing as a broken command in chat.
                    return macroText.replace(fxRegex, '');
                }
                return macroText; // No /fx commands found, return as-is.
            }
            
            // It correctly handles `explode-fire` but may misinterpret custom FX names with hyphens (e.g., 'Big-Burn' becomes type:Big, color:Burn).
            // This is a reasonable trade-off to support the standard /fx syntax.
            return macroText.replace(fxRegex, (match, type, color, target) => {
                this.log(`Found FX command: /fx ${type}${color ? '-' + color : ''} ${target}`, 'debug');

                let idPlaceholder = target;
                if (target === '@{selected|token_id}' || target === '<&trap>') {
                    idPlaceholder = `<&trap>`;
                } else if (target === '@{target|token_id}' || target === '<&t1>') {
                    idPlaceholder = `<&t1>`;
                }

                // If a color is captured, we assume it's a standard effect and provide both FX and CLR.
                // If not, we provide just FX, assuming it's a custom effect by name (TokenFX will validate).
                if (color) {
                    this.log(`Converting to !spawnComplexFx with Type: ${type}, Color: ${color}`, 'debug');
                    return `!spawnComplexFx FX[${type}] CLR[${color}] ID[${idPlaceholder}]`;
                } else {
                    this.log(`Converting to !spawnComplexFx with Type: ${type} (assumed custom or incomplete)`, 'debug');
                    return `!spawnComplexFx FX[${type}] ID[${idPlaceholder}]`;
                }
            });
        },
    },

    //----------------------------------------------------------------------
    // 3) DETECTION: movement-based triggers
    //----------------------------------------------------------------------
    detector: {
        async checkTrapTrigger(movedToken, prevX, prevY) { // Made async
            if(!movedToken) return;
            if(!TrapSystem.state.triggersEnabled) {
                TrapSystem.utils.log('Triggers disabled','debug');
                return;
            }
            // Ignore if the moved token itself is a trap
            if(TrapSystem.utils.isTrap(movedToken)) {
                TrapSystem.utils.log('Ignoring movement of trap token','debug');
                return;
            }
            // Must be in objects layer
            if(movedToken.get("layer") !== "objects") {
                TrapSystem.utils.log('Not in token layer','debug');
                return;
            }
            // If token is trap-immune
            if(TrapSystem.utils.isTrapImmune(movedToken)) {
                TrapSystem.utils.log('Token is immune to traps','debug');
                return;
            }
            // If safe move token, skip
            if(TrapSystem.state.safeMoveTokens.has(movedToken.id)) {
                TrapSystem.state.safeMoveTokens.delete(movedToken.id);
                return;
            }
            // Check movement distance
            const ps = TrapSystem.utils.getPageSettings(movedToken.get("_pageid"));
            const dx = movedToken.get("left") - prevX;
            const dy = movedToken.get("top")  - prevY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if(dist < ps.gridSize*TrapSystem.config.MIN_MOVEMENT_FACTOR) {
                TrapSystem.utils.log(`Movement too small (${dist}px)`, 'debug');
                return;
            }
            // Find traps on page
            const pageTokens = findObjs({ _type:"graphic", _pageid:movedToken.get("_pageid") });
            const trapTokens = pageTokens.filter(t => TrapSystem.utils.isTrap(t));

            // For each trap, see if line or overlap triggers
            for(let trapToken of trapTokens) {
                TrapSystem.utils.log(`[DEBUG] Checking trap: ${trapToken.id} (${trapToken.get('name') || 'Unnamed'}) at L:${trapToken.get('left')}, T:${trapToken.get('top')}, W:${trapToken.get('width')}, H:${trapToken.get('height')}`, 'debug'); // Log trap dimensions
                const data = TrapSystem.utils.parseTrapNotes(trapToken.get("gmnotes"), trapToken, false);
                if(!data || !data.isArmed || data.currentUses <= 0) {
                    continue;
                }

                // New: Check if movement trigger is disabled for this interaction trap
                if (data.type === "interaction" && data.movementTrigger === false) { 
                    TrapSystem.utils.log(`Movement trigger disabled for interaction trap: ${trapToken.id}`, 'debug');
                    continue; // Skip movement checks for this trap
                }

                // Check path intersection
                if(prevX !== undefined && prevY !== undefined) {
                    const i = TrapSystem.utils.checkLineIntersection(
                        prevX, prevY,
                        movedToken.get("left"), movedToken.get("top"),
                        trapToken
                    );
                    TrapSystem.utils.log(`[DEBUG] Intersection point 'i' from checkLineIntersection: ${i ? JSON.stringify(i) : 'null'} for trap ${trapToken.id}`, 'debug'); // Log 'i'
                    if(i) {
                        const pos = TrapSystem.utils.calculateTrapPosition(movedToken, trapToken, i);
                        TrapSystem.utils.log(`[DEBUG] pos.initial: ${JSON.stringify(pos.initial)}, pos.final: ${JSON.stringify(pos.final)} for trap ${trapToken.id}`, 'debug'); // Log pos.initial and pos.final
                        movedToken.set({ left:pos.initial.x, top:pos.initial.y });
                        setTimeout(() => {
                            movedToken.set({ left:pos.final.x, top:pos.final.y });
                        }, 500);
                        TrapSystem.triggers.handleTrapTrigger(movedToken, trapToken, i); // Pass intersection point 'i'
                        return; // Important: Return after handling a trigger to prevent multiple triggers from one move
                    }
                }
                // Direct overlap
                if(TrapSystem.utils.checkGridOverlap(movedToken, trapToken)) {
                    const centerOfMovedToken = TrapSystem.utils.getTokenCenter(movedToken);
                    TrapSystem.utils.log(`[DEBUG] Direct overlap with trap ${trapToken.id}. Center of moved token (used as intersection): ${JSON.stringify(centerOfMovedToken)}`, 'debug'); // Log intersection point for overlap
                    const pos = TrapSystem.utils.calculateTrapPosition(
                        movedToken, trapToken,
                        centerOfMovedToken
                    );
                    TrapSystem.utils.log(`[DEBUG] pos.initial: ${JSON.stringify(pos.initial)}, pos.final: ${JSON.stringify(pos.final)} for trap ${trapToken.id} (overlap case)`, 'debug'); // Log pos.initial and pos.final for overlap
                    movedToken.set({ left:pos.initial.x, top:pos.initial.y });
                    setTimeout(() => {
                        movedToken.set({ left:pos.final.x, top:pos.final.y });
                    }, 500);
                    TrapSystem.triggers.handleTrapTrigger(movedToken, trapToken, centerOfMovedToken); // Pass centerOfMovedToken as intersection point
                    return; // Important: Return after handling a trigger
                }
            }
        }
    },

    //----------------------------------------------------------------------
    // 4) TRIGGERS & TRAP CONTROL
    //----------------------------------------------------------------------
    triggers: {
        // Enable
        enableTriggers() {
            TrapSystem.state.triggersEnabled = true;
            TrapSystem.utils.chat('✅ Trap triggers enabled');
            // Update any armed traps across ALL pages
            const allPages = findObjs({ _type: "page" });
            allPages.forEach(page => {
                const tokens = findObjs({ _type: "graphic", _pageid: page.id });
                tokens.forEach(t => {
                    if (TrapSystem.utils.isTrap(t)) {
                        const d = TrapSystem.utils.parseTrapNotes(t.get("gmnotes"), t, false);
                        if (d && d.isArmed && d.currentUses > 0) {
                            const color = d.type === 'interaction' 
                                ? TrapSystem.config.AURA_COLORS.ARMED_INTERACTION 
                                : TrapSystem.config.AURA_COLORS.ARMED;
                            t.set({
                                aura1_color: color,
                                aura1_radius: TrapSystem.utils.calculateDynamicAuraRadius(t),
                                showplayers_aura1: false
                            });
                        }
                    }
                });
            });
        },
        // Disable
        disableTriggers() {
            TrapSystem.state.triggersEnabled = false;
            TrapSystem.utils.chat('❌ Trap triggers disabled');
            // Show paused color on ALL traps across ALL pages
            const allPages = findObjs({ _type: "page" });
            allPages.forEach(page => {
                const tokens = findObjs({ _type: "graphic", _pageid: page.id });
                tokens.forEach(t => {
                    if (TrapSystem.utils.isTrap(t)) {
                        const d = TrapSystem.utils.parseTrapNotes(t.get("gmnotes"), t, false);
                        if (d && d.isArmed && d.currentUses > 0) {
                            t.set({
                                aura1_color: TrapSystem.config.AURA_COLORS.PAUSED,
                                aura1_radius: TrapSystem.utils.calculateDynamicAuraRadius(t),
                                showplayers_aura1: false
                            });
                        }
                    }
                });
            });
        },
        // Toggle entire system
        toggleTriggers() {
            if(TrapSystem.state.triggersEnabled) this.disableTriggers();
            else this.enableTriggers();
        },

        // The core function for when a trap triggers
        handleTrapTrigger(triggeredToken, trapToken, originalIntersectionPoint = null) {
            const data = TrapSystem.utils.parseTrapNotes(trapToken.get("gmnotes"), trapToken);
            if(!data || !data.isArmed || data.currentUses <= 0) {
                TrapSystem.utils.chat('❌ Trap cannot be triggered (disarmed or out of uses)');
                return;
            }

            // Determine the point to pass to calculateTrapPosition.
            // If originalIntersectionPoint is null (e.g., from a direct overlap), use the center of the moved token.
            const effectiveIntersectionPoint = originalIntersectionPoint || TrapSystem.utils.getTokenCenter(movedToken);
            TrapSystem.utils.log(`[handleTrapTrigger] Effective intersection for calc: (${effectiveIntersectionPoint.x.toFixed(2)}, ${effectiveIntersectionPoint.y.toFixed(2)})`, 'debug');

            const calculatedPositions = TrapSystem.utils.calculateTrapPosition(triggeredToken, trapToken, effectiveIntersectionPoint);
            const snappedInitialLockPoint = calculatedPositions.initial; // This is the grid-snapped point based on logic in calculateTrapPosition.

            // Set the token to the SNAPPED initial lock point first.
            // The subsequent move to finalPos (if different due to occupation) is handled by the main detector logic later.
            // This ensures that the `relativeOffset` is based on where the token *actually* locks initially.
            triggeredToken.set({ left: snappedInitialLockPoint.x, top: snappedInitialLockPoint.y });
            TrapSystem.utils.log(`[handleTrapTrigger] Token ${triggeredToken.id} initially set to SNAPPED position: (${snappedInitialLockPoint.x.toFixed(2)}, ${snappedInitialLockPoint.y.toFixed(2)}) determined by calculateTrapPosition.`, 'debug');

            let relativeOffset = null;
            if (snappedInitialLockPoint) { 
                const trapCenterX = trapToken.get('left');
                const trapCenterY = trapToken.get('top');
                const trapRotationRad = (trapToken.get('rotation') || 0) * (Math.PI / 180);

                const worldOffsetX = snappedInitialLockPoint.x - trapCenterX;
                const worldOffsetY = snappedInitialLockPoint.y - trapCenterY;

                const cosRad = Math.cos(trapRotationRad); 
                const sinRad = Math.sin(trapRotationRad); 
                
                const localOffsetX = worldOffsetX * cosRad + worldOffsetY * sinRad;
                const localOffsetY = -worldOffsetX * sinRad + worldOffsetY * cosRad;

                relativeOffset = { x: localOffsetX, y: localOffsetY };
                TrapSystem.utils.log(`Stored relativeOffset for ${triggeredToken.id} to trap ${trapToken.id}: ${JSON.stringify(relativeOffset)} (Based on SNAPPED initial point: ${JSON.stringify(snappedInitialLockPoint)})`, 'debug');
            } else {
                TrapSystem.utils.log(`No snappedInitialLockPoint available after calculateTrapPosition for ${triggeredToken.id} on trap ${trapToken.id}. Cannot calculate relativeOffset. Original IP: ${JSON.stringify(originalIntersectionPoint)}`, 'warn');
            }

            TrapSystem.state.lockedTokens[triggeredToken.id] = {
                locked: true,
                trapToken: trapToken.id,
                macroTriggered: false,
                useConsumed: false,
                trapData: data,
                relativeOffset: relativeOffset 
            };
            TrapSystem.utils.updateTokenLockState(triggeredToken, trapToken.id, true);
            let wasAutoTriggeredAndHasMacro = false;

            // --- Auto-trigger logic ---
            if (data.autoTrigger) {
                if (data.primaryMacro && data.primaryMacro.macro) {
                    // Use the new centralized helper function
                    const success = TrapSystem.triggers.markTriggered(triggeredToken.id, trapToken.id, 'primary');
                    if (success) {
                        TrapSystem.triggers.getTrapStatus(trapToken);
                        wasAutoTriggeredAndHasMacro = true;
                    }
                } else {
                    TrapSystem.utils.chat(`⚠️ Auto-trigger enabled for trap ${trapToken.get('name') || trapToken.id}, but no primaryMacro is defined.`);
                }
            }

            // Show appropriate menu to GM
            if (data.type === "interaction") {
                if(wasAutoTriggeredAndHasMacro){
                    TrapSystem.utils.log(`Interaction trap ${trapToken.id} was auto-triggered. Showing GM Response menu.`, 'debug');
                    const gmIds = TrapSystem.utils.getGMPlayerIds();
                    const gmId = gmIds.length > 0 ? gmIds[0] : null;
                    const charId = triggeredToken.get("represents");

                    if (gmId && charId) {
                        // Prepare the state so the system knows which character is involved when the GM proceeds.
                        TrapSystem.menu.prepareSkillCheckState(trapToken, gmId, triggeredToken.id, charId);
                        TrapSystem.utils.log(`Prepared skill check state for auto-triggered trap. GM: ${gmId}, Char: ${charId}`, 'debug');
                    } else {
                        TrapSystem.utils.log(`Could not prepare skill check state for auto-trigger: missing GM (${gmId}) or Character ID (${charId})`, 'warn');
                    }

                    TrapSystem.menu.showGMResponseMenu(trapToken, gmId, triggeredToken.id);
               } else {
                   TrapSystem.utils.log(`Interaction trap ${trapToken.id} triggered by movement. Showing interaction menu.`, 'debug');
                   TrapSystem.menu.showInteractionMenu(trapToken, triggeredToken.id);
               }
           } else {
                // Make standard control panel for standard traps
                const imgUrl = TrapSystem.utils.getTokenImageURL(triggeredToken);
                const imgTag = imgUrl === '👤' ? '👤' : `<img src="${imgUrl}" width="40" height="40">`;
                const name = triggeredToken.get("name") || "Unknown Token";

                const panel = [
                    '&{template:default} {{name=Trap Control Panel}}',
                    `{{Trapped Token=${imgTag} **${name}**}}`,
                    `{{State=🎯 ${data.isArmed ? "ARMED" : "DISARMED"} Uses: ${data.currentUses}/${data.maxUses}}}`,
                    `{{Reminder=⚠️ Ensure the correct trap token is selected for macros that require a selected token!}}`,
                    `{{After Trigger=${data.currentUses > 1 ? "🎯 ARMED" : "🔴 AUTO-DISARMED"} Uses: ${data.currentUses - 1}/${data.maxUses}}}`,
                    `{{Actions=[⏭️ Allow Move](!trapsystem allowmovement ${triggeredToken.id}) [📊 Status](!trapsystem status ${trapToken.id}) [👯 Allow All](!trapsystem allowall) [🔄 Toggle](!trapsystem toggle ${trapToken.id})}}`
                ];

                let triggerOptionsString = "";
                if (data.primaryMacro && data.primaryMacro.macro) {
                    triggerOptionsString += `[🎯 ${TrapSystem.utils.getSafeMacroDisplayName(data.primaryMacro.macro)}](!trapsystem marktriggered ${triggeredToken.id} ${trapToken.id} primary)`;
                }

                if(data.options && data.options.length) {
                    data.options.forEach((o, index) => {
                        if (triggerOptionsString) triggerOptionsString += ' ';
                        triggerOptionsString += `[🎯 ${TrapSystem.utils.getSafeMacroDisplayName(o.macro)}](!trapsystem marktriggered ${triggeredToken.id} ${trapToken.id} option ${index})`;
                    });
                }

                if (triggerOptionsString === "") {
                    triggerOptionsString = "(DE)"; 
                }
                panel.push(`{{Trigger Options=${triggerOptionsString}}}`);

                panel.push('}}');
                sendChat("API", `/w GM ${panel.join(' ')}`);
            }

            // Get the controlling players for the trapped token
            const characterId = triggeredToken.get("represents");
            let playerNames = [];
            if (characterId) {
                const character = getObj("character", characterId);
                if (character) {
                    const controlledBy = (character.get("controlledby") || "").split(",");
                    playerNames = controlledBy.filter(pid => pid && !TrapSystem.utils.playerIsGM(pid));
                }
            }

            // Build the warning menu
            const tokenName = triggeredToken.get("name") || "Your Token";
            const warnImgUrl = TrapSystem.utils.getTokenImageURL(triggeredToken);
            const tokenImg = warnImgUrl === '👤' ? '👤' : `<img src="${warnImgUrl}" width="40" height="40">`;
            const menu = `&{template:default} {{name=⚠️ ${tokenName} is Trapped!}}` +
                `{{Token=${tokenImg}}}` +
                `{{Warning=Your token has triggered a trap and is now locked.}}` +
                `{{Instructions=Please wait for the GM to resolve the action (unlock, macro, or interaction).}}`;

            // Whisper to each controlling player
            playerNames.forEach(pid => {
                sendChat("TrapSystem", `/w "${getObj("player", pid)?.get("displayname") || "player"}" ${menu}`);
            });
        },

        // Allow movement
        allowMovement(tokenId, suppressMessage = false) {
            TrapSystem.utils.log(`allowMovement called with tokenId: ${tokenId}`, 'debug');
            const lockData = TrapSystem.state.lockedTokens[tokenId];
            if(!lockData) return;
            const trapId = lockData.trapToken;
            const trapToken = getObj("graphic", trapId);
            const token = getObj("graphic", tokenId);
            if(token && trapToken) {
                TrapSystem.utils.updateTokenLockState(token, trapId, false);
                if(lockData.macroTriggered) {
                    const newUses = Math.max(0, lockData.trapData.currentUses - 1);
                    const stillArmed = newUses > 0;
                    TrapSystem.utils.updateTrapUses(trapToken, newUses, lockData.trapData.maxUses, stillArmed);
                    if(!stillArmed && lockData.trapData.currentUses > 0) { // Only send message if it just became depleted
                        TrapSystem.utils.sendDepletedMessage(trapToken);
                    }
                }
            }
            delete TrapSystem.state.lockedTokens[tokenId];
            TrapSystem.state.safeMoveTokens.add(tokenId);
            
            if (!suppressMessage) {
                const message = '✅ Movement allowed. Next move is free.';
                // Whisper to GM as before
                TrapSystem.utils.chat(message);
                
                // Also whisper to controlling players
                if (token) {
                    const characterId = token.get("represents");
                    let playerNames = [];
                    if (characterId) {
                        const character = getObj("character", characterId);
                        if (character) {
                            const controlledBy = (character.get("controlledby") || "").split(",");
                            playerNames = controlledBy.filter(pid => pid && !TrapSystem.utils.playerIsGM(pid));
                        }
                    }
                    playerNames.forEach(pid => {
                        sendChat("TrapSystem", `/w "${getObj("player", pid)?.get("displayname") || "player"}" ${message}`);
                    });
                }
            }
        },

        // Allow movement for all locked tokens
        allowAllMovement() {
            const lockedTokens = Object.keys(TrapSystem.state.lockedTokens);
            if (lockedTokens.length === 0) {
                TrapSystem.utils.chat('ℹ️ No tokens are currently locked');
                return;
            }
        
            // Collect all affected player IDs
            let affectedPlayerIds = new Set();
        
            lockedTokens.forEach(tokenId => {
                // Get controlling players for each token
                const token = getObj("graphic", tokenId);
                if (token) {
                    const characterId = token.get("represents");
                    if (characterId) {
                        const character = getObj("character", characterId);
                        if (character) {
                            const controlledBy = (character.get("controlledby") || "").split(",");
                            controlledBy.forEach(pid => {
                                if (pid && !TrapSystem.utils.playerIsGM(pid)) affectedPlayerIds.add(pid);
                            });
                        }
                    }
                }
                this.allowMovement(tokenId, true); // Suppress individual messages
            });
        
            const summaryMsg = `✅ Movement allowed for ${lockedTokens.length} token(s)`;
        
            // Whisper to GM as before
            TrapSystem.utils.chat(summaryMsg);
        
            // Also whisper to all affected players
            affectedPlayerIds.forEach(pid => {
                sendChat("TrapSystem", `/w "${getObj("player", pid)?.get("displayname") || "player"}" ${summaryMsg}`);
            });
        },

        markTriggered(tokenId, trapId, macroIdentifier) {
            // [UPDATED: Now also executes the macro immediately]
            if(TrapSystem.state.lockedTokens[tokenId]) {
                TrapSystem.state.lockedTokens[tokenId].macroTriggered = true;
                TrapSystem.utils.log(`Macro triggered for token ${tokenId}`, 'info');
                if (macroIdentifier) {
                    const trapTokenObj = getObj("graphic", trapId);
                    const trappedTokenObj = getObj("graphic", tokenId);
                    const tagToIdMap = TrapSystem.utils.buildTagToIdMap(trapTokenObj, trappedTokenObj);
                    const trapData = TrapSystem.utils.parseTrapNotes(trapTokenObj.get("gmnotes"), trapTokenObj);
                    let macroToExecute = null;
                    if (macroIdentifier === 'primary') {
                        macroToExecute = trapData.primaryMacro.macro;
                    } else if (macroIdentifier.startsWith('option')) {
                        const optionIndex = parseInt(macroIdentifier.split(' ')[1]);
                        if (trapData.options && trapData.options[optionIndex]) {
                            macroToExecute = trapData.options[optionIndex].macro;
                        }
                    }
                    if (macroToExecute) {
                        const result = TrapSystem.utils.executeMacro(macroToExecute, tagToIdMap);
                        if (!result) {
                            TrapSystem.utils.chat(`❌ Failed to execute macro: ${macroToExecute}`);
                        }
                    } else {
                        TrapSystem.utils.chat(`❌ Invalid macro identifier: ${macroIdentifier}`);
                    }
                } else {
                    TrapSystem.utils.chat('❌ No macro identifier provided to markTriggered.');
                }
            } else {
                TrapSystem.utils.log(`No locked token found for ${tokenId} in markTriggered`, 'warning');
            }
        },

        // Show trap status
        getTrapStatus(token) {
            if(!token) return;
            const data = TrapSystem.utils.parseTrapNotes(token.get("gmnotes"), token); // Already updated to new parser
            if(!data) {
                TrapSystem.utils.chat('❌ Invalid trap config or GM notes format.');
                return;
            }
            const lockedList = Object.entries(TrapSystem.state.lockedTokens)
                .filter(([_,val]) => val.trapToken === token.id)
                .map(([k,_val]) => getObj("graphic", k))
                .filter(x => x);

            let msg = [
                '&{template:default} {{name=Trap Status}}',
                `{{State=${data.isArmed ? "🎯 ARMED" : "🔴 DISARMED"}}}`,
                `{{Uses=${data.currentUses}/${data.maxUses}}}`
            ];

            if (data.type === "interaction") {
                if (data.primaryMacro && data.primaryMacro.macro) {
                    msg.push(`{{Primary Macro=${TrapSystem.utils.getSafeMacroDisplayName(data.primaryMacro.macro)}}}`);
                }
                if (data.successMacro) {
                    msg.push(`{{Success Macro=${TrapSystem.utils.getSafeMacroDisplayName(data.successMacro)}}}`);
                }
                if (data.failureMacro) {
                    msg.push(`{{Failure Macro=${TrapSystem.utils.getSafeMacroDisplayName(data.failureMacro)}}}`);
                }
                if (data.checks && data.checks.length > 0) {
                    const checkInfo = data.checks.map(c => `${TrapSystem.config.SKILL_TYPES[c.type] || "🎲"} ${c.type} (DC ${c.dc})`).join('<br>');
                    msg.push(`{{Checks=${checkInfo}}}`);
                }
            } else { // Standard trap
                if (data.primaryMacro && data.primaryMacro.macro) {
                    msg.push(`{{Primary Macro=${TrapSystem.utils.getSafeMacroDisplayName(data.primaryMacro.macro)}}}`);
                }
                if (Array.isArray(data.options) && data.options.length) {
                    const optionsList = data.options.map((opt, index) => `${index + 1}. ${TrapSystem.utils.getSafeMacroDisplayName(opt.macro)}`).join('<br>');
                msg.push(`{{Options=${optionsList}}}`);
            }
            }
            
            // Common details
            msg.push(`{{Movement Trigger=${data.movementTrigger ? 'On' : 'Off'}}}`);
            msg.push(`{{Auto Trigger=${data.autoTrigger ? 'On' : 'Off'}}}`);
            msg.push(`{{Position=${typeof data.position === 'object' ? `(${data.position.x},${data.position.y})` : data.position}}}`);


            if(data.currentUses>0 && data.isArmed) { // Ensure armed for this message
                msg.push(`{{If Triggered=${data.currentUses>1?"Remains ARMED":"AUTO-DISARM"} -> ${data.currentUses-1}/${data.maxUses}}}`);
            }
            if(lockedList.length) {
                let lockStr = lockedList.map(tk => {
                    const url = TrapSystem.utils.getTokenImageURL(tk);
                    const icon = url === '👤' ? '👤' : `<img src="${url}" width="40" height="40">`;
                    return `${icon} ${tk.get("name")||"???"}`;
                }).join('<br>');
                msg.push(`{{Currently Holding=${lockStr}}}`);
            }
            sendChat("TrapSystem", `/w GM ${msg.join(' ')}`);
        },

        // Toggle trap armed state
        toggleTrap(token) {
            if (!token) {
                TrapSystem.utils.chat('❌ Error: No token provided for toggle!');
                return;
            }
            const trapData = TrapSystem.utils.parseTrapNotes(token.get("gmnotes"), token);
            if (!trapData) {
                TrapSystem.utils.chat('❌ Error: Invalid trap configuration!');
                return;
            }

            // Toggle the armed state
            const newArmedState = !trapData.isArmed;
            
            // If arming & no uses, restore 1
            let newUses = trapData.currentUses;
            if (newArmedState && trapData.currentUses <= 0) {
                newUses = 1;
                TrapSystem.utils.chat('✨ Restored 1 use to trap');
            }
            
            // Update
            TrapSystem.utils.updateTrapUses(token, newUses, trapData.maxUses, newArmedState);
            
            // Status
            TrapSystem.utils.chat(`${newArmedState ? '🎯' : '🔴'} Trap ${newArmedState ? 'ARMED' : 'DISARMED'}`);
            if (trapData.type === 'interaction') {
                TrapSystem.menu.showInteractionMenu(token);
                } else {
                this.getTrapStatus(token);
            }
        },

        // Show manual trigger panel
        manualTrigger(trapToken) {
            if (!trapToken) {
                TrapSystem.utils.chat('❌ Error: No trap token selected!');
                return;
            }
            const trapData = TrapSystem.utils.parseTrapNotes(trapToken.get("gmnotes"), trapToken);
            if (!trapData) {
                TrapSystem.utils.chat('❌ Error: Invalid trap configuration!');
                return;
            }

            if (trapData.autoTrigger &&
                trapData.primaryMacro &&
                trapData.primaryMacro.macro) {
                this.manualMacroTrigger(trapToken.id, trapData.primaryMacro.macro);
                return;
            }

            // If "interaction" type, show interaction menu regardless of armed state.
            // The menu itself will handle showing/hiding action buttons.
            if (trapData.type === 'interaction') {
                TrapSystem.menu.showInteractionMenu(trapToken);
                return;
            }

            // Otherwise show a standard control panel
            const controlPanel = [
                '&{template:default} {{name=Trap Control Panel}}',
                `{{State=🎯 ${trapData.isArmed ? "ARMED" : "🔴 DISARMED"} Uses: ${trapData.currentUses}/${trapData.maxUses}}}`,
                // Management actions are always available
                `{{Management=[🔄 Toggle](!trapsystem toggle ${trapToken.id}) [📊 Status](!trapsystem status ${trapToken.id})}}`
            ];

            // Only show trigger options if the trap is armed and has uses.
            if (trapData.isArmed && trapData.currentUses > 0) {
                controlPanel.push(`{{Reminder=⚠️ Ensure the correct trap token is selected for macros that require a selected token!}}`);
                controlPanel.push(`{{After Trigger=${trapData.currentUses > 1 ? "🎯 ARMED" : "🔴 AUTO-DISARMED"} Uses: ${trapData.currentUses - 1}/${trapData.maxUses}}}`);
                
                let triggerOptionsString = "";
                if (trapData.primaryMacro && trapData.primaryMacro.macro) {
                    triggerOptionsString += `[🎯 ${TrapSystem.utils.getSafeMacroDisplayName(trapData.primaryMacro.macro)}](!trapsystem manualtrigger ${trapToken.id} primary)`;
                }

                if (trapData.options && trapData.options.length > 0) {
                    trapData.options.forEach((option, index) => {
                        if (triggerOptionsString !== "") triggerOptionsString += " "; // Add a space separator if primary was added
                        triggerOptionsString += `[🎯 ${TrapSystem.utils.getSafeMacroDisplayName(option.macro)}](!trapsystem manualtrigger ${trapToken.id} option ${index})`;
                    });
                }

                if (triggerOptionsString === "") {
                    triggerOptionsString = "(DE)"; // Dead end if no options
                }
                controlPanel.push(`{{Trigger Options=${triggerOptionsString}}}`);
            } else {
                controlPanel.push(`{{Note=Trap is currently disarmed or out of uses. Toggle it to enable trigger options.}}`);
            }
            
            controlPanel.push('}}');
            sendChat("API", `/w GM ${controlPanel.join(' ')}`);
        },

        // Setup standard trap
        setupTrap(token, uses, mainMacro, optionalMacro2, optionalMacro3, movement, autoTrigger) {
            TrapSystem.utils.log(`[setupTrap] Called. Token: ${token ? token.id : 'null'}, Uses: ${uses}, MainMacro: ${mainMacro}, Opt2: ${optionalMacro2}, Opt3: ${optionalMacro3}, Move: ${movement}, AutoT: ${autoTrigger}`, 'debug');
            if (!token) {
                TrapSystem.utils.chat('❌ Error: No token selected!');
                return;
            }

            // [FIX] Read existing notes to preserve detection settings
            const existingNotesRaw = token.get("gmnotes") || "";
            let existingNotesDecoded = "";
            try { existingNotesDecoded = decodeURIComponent(existingNotesRaw); } catch(e) { existingNotesDecoded = existingNotesRaw; }
            const detectionBlockMatch = existingNotesDecoded.match(/(\{!trapdetection\s+(?:(?!\{!}).)*\})/);
            const existingDetectionBlock = detectionBlockMatch ? detectionBlockMatch[0] : "";
            if (existingDetectionBlock) {
                TrapSystem.utils.log(`[setupTrap] Preserving existing detection block: ${existingDetectionBlock}`, 'debug');
            }

            const maxUses = parseInt(uses);
            if (isNaN(maxUses) || maxUses < 1) {
                TrapSystem.utils.chat('❌ Error: Uses must be a positive number!');
                return;
            }

            const processMacro = (macroCmd) => {
                if (!macroCmd || typeof macroCmd !== 'string' || macroCmd.trim().toLowerCase() === 'none' || macroCmd.trim() === '') {
                    return null;
                }

                let content = macroCmd.trim();

                // NEW: Handle disguised templates like ^{template:...}
                if (content.startsWith('^')) {
                    // Replace the caret with an ampersand to make it a valid template.
                    content = '&' + content.substring(1);
                }

                if (content.startsWith('"') && content.endsWith('"')) {
                    content = content.substring(1, content.length - 1).trim();
                }

                if (content.startsWith('&{')) { // This is a roll template
                    return `"${content.replace(/"/g, '\\"')}"`; // Quote and escape
                }
                if (content.startsWith('!')) {
                    return `"$${content.substring(1)}"`;
                }
                if (content.startsWith('$')) {
                    return `"${content}"`;
                }
                if (content.startsWith('#')) {
                    const macroName = content.substring(1).trim();
                    if (findObjs({ _type: "macro", name: macroName }).length === 0) {
                        TrapSystem.utils.chat(`⚠️ Warning: The macro named "${macroName}" was not found. Please check for typos in the trap's GM Notes.`);
                    }
                    return content;
                }
                if (findObjs({ _type: "macro", name: content }).length > 0) {
                    return '#' + content;
                }
                return `"${content.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`; // Quote and escape backslashes and double quotes
            };

            const primaryMacroProcessed = processMacro(mainMacro);
            if (!primaryMacroProcessed) {
                TrapSystem.utils.chat('❌ Error: A primary macro, command, or text is required for a standard trap!');
                return;
            }

            let parts = [
                "type:[standard]",
                `uses:[${maxUses}/${maxUses}]`,
                "armed:[on]",
                `primaryMacro:[${primaryMacroProcessed}]`
            ];

            let optionsArray = [];
            const opt2Processed = processMacro(optionalMacro2);
            if (opt2Processed) {
                optionsArray.push(opt2Processed);
            }
            const opt3Processed = processMacro(optionalMacro3);
            if (opt3Processed) {
                optionsArray.push(opt3Processed);
            }
            if (optionsArray.length > 0) {
                parts.push(`options:[${optionsArray.join(';')}]`);
            }

            let movementSetting = "intersection"; 
            if (movement) {
                const movLower = movement.toLowerCase();
                if (movLower === "center" || movLower === "grid") {
                    movementSetting = movLower === "grid" ? "0,0" : "center";
                } else if (movLower.match(/^\d+,\d+$/)) {
                    movementSetting = movLower;
                }
            }
            parts.push(`position:[${movementSetting}]`);
            parts.push(`movementTrigger:[on]`);
            parts.push(`autoTrigger:[${autoTrigger && (autoTrigger.toString().toLowerCase() === "true" || autoTrigger === true) ? 'on' : 'off'}]`);

            const newTriggerBlock = `{!traptrigger ${parts.join(' ')}}`;
            const finalTrapConfigString = `${newTriggerBlock} ${existingDetectionBlock}`.trim();
            
            TrapSystem.utils.log(`[setupTrap] Generated final trapConfigString (New Format): ${finalTrapConfigString}`, 'debug');
            
            let encodedNotes = "";
            try {
                encodedNotes = encodeURIComponent(finalTrapConfigString);
                 TrapSystem.utils.log(`[setupTrap] Encoded GM Notes (first 100 chars of ${encodedNotes.length}): ${encodedNotes.substring(0,100)}`, 'debug');
            } catch (e) {
                TrapSystem.utils.log(`[setupTrap] Error during encodeURIComponent: ${e.message}`, 'error');
                TrapSystem.utils.chat(`❌ Error encoding trap data for GM notes.`);
                return;
            }

            try {
            token.set({
                    gmnotes: encodedNotes,
                bar1_value: maxUses,
                bar1_max: maxUses,
                    showplayers_bar1: false,
                aura1_radius: TrapSystem.utils.calculateDynamicAuraRadius(token),
                aura1_color: TrapSystem.config.AURA_COLORS.ARMED,
                showplayers_aura1: false
            });
                TrapSystem.utils.log(`[setupTrap] token.set() called for token ${token.id}. GM notes should be updated.`, 'debug');
            } catch (e) {
                TrapSystem.utils.log(`[setupTrap] Error during token.set(): ${e.message}`, 'error');
                TrapSystem.utils.chat(`❌ Error setting trap properties on token.`);
                return;
            }
            
            this.getTrapStatus(token);
        },

        // Setup an "interaction" trap
        setupInteractionTrap(token, uses, primaryMacro, successMacro, failureMacro, check1Type, check1DC, check2Type, check2DC, movementTriggerEnabled = true, movement = 'intersection', autoTriggerEnabled = false) {
            TrapSystem.utils.log(`[setupInteractionTrap] Called. Token: ${token ? token.id : 'null'}, Uses: ${uses}, PrimaryM: ${primaryMacro}, SuccessM: ${successMacro}, FailM: ${failureMacro}, AutoT: ${autoTriggerEnabled}`, 'debug');
            if (!token) {
                TrapSystem.utils.chat('❌ Error: No token selected!');
                return;
            }

            // [FIX] Read existing notes to preserve detection settings
            const existingNotesRaw = token.get("gmnotes") || "";
            let existingNotesDecoded = "";
            try { existingNotesDecoded = decodeURIComponent(existingNotesRaw); } catch(e) { existingNotesDecoded = existingNotesRaw; }
            const detectionBlockMatch = existingNotesDecoded.match(/(\{!trapdetection\s+(?:(?!\{!}).)*\})/);
            const existingDetectionBlock = detectionBlockMatch ? detectionBlockMatch[0] : "";
            if (existingDetectionBlock) {
                TrapSystem.utils.log(`[setupInteractionTrap] Preserving existing detection block: ${existingDetectionBlock}`, 'debug');
            }

            let positionValue = movement ? movement.toLowerCase() : 'intersection';
            if (positionValue === 'grid') {
                positionValue = '0,0';
            }

            const maxUses = parseInt(uses);
            if (isNaN(maxUses) || maxUses < 1) {
                TrapSystem.utils.chat('❌ Error: Uses must be a positive number!');
                return;
            }
            
            const processMacro = (macroCmd) => {
                if (!macroCmd || typeof macroCmd !== 'string' || macroCmd.trim().toLowerCase() === 'none' || macroCmd.trim() === '') {
                    return null;
                }

                let content = macroCmd.trim();

                // NEW: Handle disguised templates like ^{template:...}
                if (content.startsWith('^')) {
                    // Replace the caret with an ampersand to make it a valid template.
                    content = '&' + content.substring(1);
                }

                if (content.startsWith('"') && content.endsWith('"')) {
                    content = content.substring(1, content.length - 1).trim();
                }

                if (content.startsWith('&{')) { // This is a roll template
                    return `"${content.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`; // Quote and escape backslashes and double quotes
                }
                if (content.startsWith('!')) {
                    return `"$${content.substring(1)}"`;
                }
                if (content.startsWith('$')) {
                    return `"${content}"`;
                }
                if (content.startsWith('#')) {
                    const macroName = content.substring(1).trim();
                    if (findObjs({ _type: "macro", name: macroName }).length === 0) {
                        // The user requested a warning for potentially misspelled macros.
                        TrapSystem.utils.chat(`⚠️ Warning: The macro named "${macroName}" was not found. Please check for typos in the trap's GM Notes.`);
                    }
                    // Return the macro name (e.g., #TestMacro) without quotes.
                    return content;
                }
                if (findObjs({ _type: "macro", name: content }).length > 0) {
                    return '#' + content;
                }
                return `"${content.replace(/"/g, '\\"')}"`; // Quote and escape
            };

            let parts = [
                "type:[interaction]",
                `uses:[${maxUses}/${maxUses}]`,
                "armed:[on]"
            ];
            
            const primaryMacroProcessed = processMacro(primaryMacro);
            if (primaryMacroProcessed) {
                parts.push(`primaryMacro:[${primaryMacroProcessed}]`);
            }
            const successMacroProcessed = processMacro(successMacro);
            if (successMacroProcessed) {
                parts.push(`successMacro:[${successMacroProcessed}]`);
            }
            const failureMacroProcessed = processMacro(failureMacro);
            if (failureMacroProcessed) {
                parts.push(`failureMacro:[${failureMacroProcessed}]`);
            }

            let checksArrayStr = [];
            if (check1Type && check1Type.toLowerCase() !== "none") {
                const dc1 = parseInt(check1DC);
                if (isNaN(dc1)) {
                    TrapSystem.utils.chat('❌ Error: First Check DC must be a number!');
                    return;
                }
                checksArrayStr.push(`${check1Type.trim()}:${dc1}`);
            }
            if (check2Type && check2Type.toLowerCase() !== "none") {
                const dc2 = parseInt(check2DC);
                if (isNaN(dc2)) {
                    TrapSystem.utils.chat('❌ Error: Second Check DC must be a number!');
                    return;
                }
                checksArrayStr.push(`${check2Type.trim()}:${dc2}`);
            }

            if (checksArrayStr.length > 0) {
                parts.push(`checks:[${checksArrayStr.join(';')}]`);
            }

            const movementIsEnabled = (typeof movementTriggerEnabled === 'string' && movementTriggerEnabled.toLowerCase() === 'true') || movementTriggerEnabled === true;
            parts.push(`movementTrigger:[${movementIsEnabled ? 'on' : 'off'}]`);
            const autoTriggerIsEnabled = (typeof autoTriggerEnabled === 'string' && autoTriggerEnabled.toLowerCase() === 'true') || autoTriggerEnabled === true;
            parts.push(`autoTrigger:[${autoTriggerIsEnabled ? 'on' : 'off'}]`);
            parts.push(`position:[${positionValue}]`);

            const newTriggerBlock = `{!traptrigger ${parts.join(' ')}}`;
            const finalTrapConfigString = `${newTriggerBlock} ${existingDetectionBlock}`.trim();

            TrapSystem.utils.log(`[setupInteractionTrap] Generated final trapConfigString (New Format): ${finalTrapConfigString}`, 'debug');
            
            let encodedNotes = "";
            try {
                encodedNotes = encodeURIComponent(finalTrapConfigString);
                TrapSystem.utils.log(`[setupInteractionTrap] Encoded GM Notes (first 100 chars of ${encodedNotes.length}): ${encodedNotes.substring(0,100)}`, 'debug');
            } catch (e) {
                TrapSystem.utils.log(`[setupInteractionTrap] Error during encodeURIComponent: ${e.message}`, 'error');
                TrapSystem.utils.chat(`❌ Error encoding trap data for GM notes.`);
                return;
            }

            try {
            token.set({
                gmnotes: encodedNotes,
                aura1_radius: TrapSystem.utils.calculateDynamicAuraRadius(token),
                aura1_color: TrapSystem.config.AURA_COLORS.ARMED,
                showplayers_aura1: false,
                bar1_value: maxUses,
                bar1_max: maxUses,
                showplayers_bar1: false
            });
                TrapSystem.utils.log(`[setupInteractionTrap] token.set() called for token ${token.id}. GM notes should be updated.`, 'debug');
            } catch (e) {
                TrapSystem.utils.log(`[setupInteractionTrap] Error during token.set(): ${e.message}`, 'error');
                TrapSystem.utils.chat(`❌ Error setting trap properties on token.`);
                return;
            }

            TrapSystem.triggers.getTrapStatus(token); // Show status using new format
        },

        // Execute trap trigger
        executeTrapTrigger(tokenId, trapId) {
            const token = getObj("graphic", tokenId);
            const trapToken = getObj("graphic", trapId);
            if (!token || !trapToken) {
                TrapSystem.utils.log("Token or trap not found", 'error');
                return;
            }
            const trapData = TrapSystem.utils.parseTrapNotes(trapToken.get("gmnotes"), trapToken);
            if (!trapData || !trapData.isArmed || trapData.currentUses <= 0) {
                TrapSystem.utils.chat('❌ Error: Trap cannot be triggered (disarmed or no uses)');
                return;
            }

            if (trapData.type === 'interaction') {
                if (trapData.failureMacro) {
                    const tagToIdMap = TrapSystem.utils.buildTagToIdMap(trapToken, token);
                    TrapSystem.utils.executeMacro(trapData.failureMacro, tagToIdMap);
                }
            } else {
                if (trapData.primaryMacro && trapData.primaryMacro.macro) {
                    const tagToIdMap = TrapSystem.utils.buildTagToIdMap(trapToken, token);
                    TrapSystem.utils.executeMacro(trapData.primaryMacro.macro, tagToIdMap);
                }
            }

            const newUses = Math.max(0, trapData.currentUses - 1);
            if (newUses <= 0) {
                TrapSystem.utils.updateTrapUses(trapToken, 0, trapData.maxUses, false);
                             TrapSystem.utils.sendDepletedMessage(trapToken);
            } else {
                TrapSystem.utils.updateTrapUses(trapToken, newUses, trapData.maxUses, true);
            }

            trapToken.set({
                aura1_color: newUses > 0 
                    ? (TrapSystem.state.triggersEnabled 
                        ? TrapSystem.config.AURA_COLORS.ARMED 
                        : TrapSystem.config.AURA_COLORS.PAUSED) 
                    : TrapSystem.config.AURA_COLORS.DISARMED,
                aura1_radius: TrapSystem.utils.calculateDynamicAuraRadius(token),
                showplayers_aura1: false
            });

            if (TrapSystem.state.lockedTokens[tokenId]) {
                TrapSystem.state.lockedTokens[tokenId].macroTriggered = true;
            }
        },

        manualMacroTrigger(trapId, macroIdentifier) {
            const trapToken = getObj("graphic", trapId);
            if (!trapToken) {
                TrapSystem.utils.chat('❌ Error: Trap token not found!');
                return;
            }
            const trapData = TrapSystem.utils.parseTrapNotes(trapToken.get("gmnotes"), trapToken);
            if (!trapData || !trapData.isArmed || trapData.currentUses <= 0) {
                TrapSystem.utils.chat('❌ Error: Trap cannot be triggered (disarmed or no uses)');
                return;
            }

            const tagToIdMap = TrapSystem.utils.buildTagToIdMap(trapToken, null, null);
            let macroToExecute = null;
            if (macroIdentifier === 'primary') {
                macroToExecute = trapData.primaryMacro.macro;
            } else if (macroIdentifier.startsWith('option')) {
                const optionIndex = parseInt(macroIdentifier.split(' ')[1]);
                if (trapData.options && trapData.options[optionIndex]) {
                    macroToExecute = trapData.options[optionIndex].macro;
                }
            }
            if (macroToExecute) {
                const macroExecuted = TrapSystem.utils.executeMacro(macroToExecute, tagToIdMap);
                if (macroExecuted) {
                    const newUses = trapData.currentUses - 1;
                    const stillArmed = newUses > 0;
                    TrapSystem.utils.updateTrapUses(trapToken, newUses, trapData.maxUses, stillArmed);
                    if (!stillArmed) {
                        TrapSystem.utils.sendDepletedMessage(trapToken);
                    }

                    // Determine correct aura color based on trap type
                    const isInteraction = trapData.type === 'interaction';
                    let auraColor;
                    if (stillArmed) {
                        if (TrapSystem.state.triggersEnabled) {
                            auraColor = isInteraction ? TrapSystem.config.AURA_COLORS.ARMED_INTERACTION : TrapSystem.config.AURA_COLORS.ARMED;
                        } else {
                            auraColor = TrapSystem.config.AURA_COLORS.PAUSED;
                        }
                    } else {
                        auraColor = isInteraction ? TrapSystem.config.AURA_COLORS.DISARMED_INTERACTION : TrapSystem.config.AURA_COLORS.DISARMED;
                    }

                    trapToken.set({
                        aura1_color: auraColor,
                        aura1_radius: TrapSystem.utils.calculateDynamicAuraRadius(trapToken),
                        showplayers_aura1: false
                    });
                } else {
                    TrapSystem.utils.chat('❌ Failed to execute the macro.');
                }
            } else {
                TrapSystem.utils.chat(`❌ Invalid macro identifier: ${macroIdentifier}`);
            }
        }
    },

    //----------------------------------------------------------------------
    // 5) ADVANCED INTERACTION MENU
    //----------------------------------------------------------------------
    menu: {
        showInteractionMenu(trapToken, triggeredTokenId = null) { // Added triggeredTokenId parameter
            if (!trapToken) return;
            try {
                const tokenImgUrl = TrapSystem.utils.getTokenImageURL(trapToken);
                const tokenImage = tokenImgUrl === '👤'
                    ? '👤'
                    : `<img src="${tokenImgUrl}" width="100" height="100" style="display: block; margin: 5px auto;">`;
                const tokenName = trapToken.get("name") || "Unknown Object";
                const trapData = TrapSystem.utils.parseTrapNotes(trapToken.get("gmnotes"));

                if (!trapData) {
                    TrapSystem.utils.log('Invalid trap configuration', 'error');
                    return;
                }

                const menu = [
                    '&{template:default}',
                    `{{name=${tokenName}}}`, // eslint-disable-line quotes
                    `{{Description=${tokenImage}}}`,
                    `{{State=🎯 ${trapData.isArmed ? (TrapSystem.state.triggersEnabled ? "ARMED" : "⚠️ PAUSED") : "DISARMED"} (${trapData.currentUses}/${trapData.maxUses} uses)}}`
                ];

                // Action buttons section
                if (trapData.isArmed && TrapSystem.state.triggersEnabled) {
                    // Pass the triggeredTokenId to the interaction commands
                    const triggerActionCmd = `!trapsystem interact ${trapToken.id} trigger ${triggeredTokenId || ''}`.trim();
                    const explainActionCmd = `!trapsystem interact ${trapToken.id} explain ${triggeredTokenId || ''}`.trim();
                    
                    let actionButtonParts = [
                        `[🎯 Trigger Action](${triggerActionCmd})`,
                        `[💭 Explain Action](${explainActionCmd})`
                    ];

                    // Add "Allow Movement" button if a specific token triggered this menu display
                    if (triggeredTokenId) {
                        const lockRecord = TrapSystem.state.lockedTokens[triggeredTokenId];
                        // Ensure the token is actually locked by THIS trap and the lock is active
                        if (lockRecord && lockRecord.trapToken === trapToken.id && lockRecord.locked) {
                            actionButtonParts.push(`[⏭️ Allow Move](!trapsystem allowmovement ${triggeredTokenId})`);
                        }
                    }
                    menu.push(`{{Actions=${actionButtonParts.join(' | ')}}}`);
                } else if (!TrapSystem.state.triggersEnabled) {
                    menu.push(`{{Status=⚠️ Trap system is currently PAUSED}}`);
                }

                // Show trap info if it exists
                if (trapData.checks && trapData.checks.length > 0) {
                    const checkInfo = trapData.checks.map(check => 
                        `${TrapSystem.config.SKILL_TYPES[check.type] || "🎲"} ${check.type} (DC ${check.dc})`
                    ).join('<br>');
                    menu.push(`{{Trap Info=Skill Check:<br>${checkInfo}}}`);
                }

                menu.push(`{{Management=[📊 Status](!trapsystem status ${trapToken.id}) | [🔄 Toggle](!trapsystem toggle ${trapToken.id})}}`);
                sendChat("TrapSystem", `/w gm ${menu.join(' ')}`);
            } catch (err) {
                TrapSystem.utils.log(`Error showing interaction menu: ${err.message}`, 'error');
            }
        },

        handleInteraction(token, action, playerid, triggeredTokenId = null) {
            TrapSystem.utils.log(`handleInteraction called with tokenId:${token.id}, action:${action}, playerid:${playerid}, triggeredTokenId:${triggeredTokenId}`, 'debug');
            const config = TrapSystem.utils.parseTrapNotes(token.get("gmnotes"), token);
            if (!config || config.type !== "interaction") {
                TrapSystem.utils.log("Invalid config or not 'interaction' type", 'debug');
                return;
            }

            const trappedToken = getObj("graphic", triggeredTokenId);
            const tagToIdMap = TrapSystem.utils.buildTagToIdMap(token, trappedToken, null);

            switch (action) {
                case "trigger":
                    if (config.primaryMacro && config.primaryMacro.macro) {
                        if (trappedToken) {
                            // If a token is already associated, use markTriggered. This executes the macro
                            // and sets the flag for later use-depletion, but does NOT deplete the use now.
                            TrapSystem.triggers.markTriggered(trappedToken.id, token.id, 'primary');
                        } else {
                            // If it's a purely manual trigger with no token yet, just execute the primary macro.
                            // The macro runs, but no use is depleted yet. The GM will select a token
                            // and resolve the trap in the next step.
                            const manualTagMap = TrapSystem.utils.buildTagToIdMap(token, null);
                            TrapSystem.utils.executeMacro(config.primaryMacro.macro, manualTagMap);
                        }
                    } else {
                        TrapSystem.utils.chat("⚠️ This interaction trap has no Primary Macro defined. Proceeding to skill check menu instead.");
                    }
                    // If this is a simple "fire-and-forget" trap with a primary action but no further steps (no success/fail macros, no checks),
                    // then we resolve the trap state immediately after the primary macro runs.
                    // if (config.primaryMacro && !config.successMacro && !config.failureMacro && (!config.checks || config.checks.length === 0)) { - if you want to resolve the trap after the skill check replace line below with this one
                    if (config.primaryMacro && !config.successMacro && !config.failureMacro) {
                        TrapSystem.utils.log(`Primary-only interaction trap '${token.get('name')}' triggered. Resolving immediately.`, 'info');

                        if (trappedToken) {
                            // A token was locked by this trap's trigger. Release it.
                            // The allowMovement function will handle depleting the use since markTriggered was called.
                            TrapSystem.triggers.allowMovement(triggeredTokenId, true); // Suppress individual message
                            TrapSystem.utils.chat(`✅ Trap '${token.get("name")}' triggered on '${trappedToken.get("name")}' and resolved.`);
                        } else {
                            // This was a manual trigger (e.g., from !trapsystem trigger). Deplete the use directly.
                            const newUses = Math.max(0, config.currentUses - 1);
                            const stillArmed = newUses > 0;
                            TrapSystem.utils.updateTrapUses(token, newUses, config.maxUses, stillArmed);
                            if (!stillArmed && config.currentUses > 0) {
                                TrapSystem.utils.sendDepletedMessage(token);
                            } else {
                                TrapSystem.utils.chat(`✅ Trap '${token.get("name")}' triggered and resolved.`);
                            }
                        }
                        // Stop here. Do not show any further menus.
                        return;
                    }
                    if (trappedToken) {
                        TrapSystem.menu.showGMResponseMenu(token, playerid, triggeredTokenId);
                    } else {
                    // After the primary action, always show the response menu for the GM to resolve the trap.
                    TrapSystem.menu.showCharacterSelectionMenu(token, playerid, triggeredTokenId);
                    }
                    break;

                case "fail":
                    TrapSystem.utils.log(`Executing failure macro:${config.failureMacro}`, 'debug');
                    if (config.failureMacro) {
                        TrapSystem.utils.executeMacro(config.failureMacro, tagToIdMap);
                    }
                    break;

                case "explain":
                    // The "smart" path.
                    if (trappedToken) {
                        const charId = trappedToken.get("represents");
                        if (charId) {
                            // Use the new, reliable helper function to set up the state.
                            const success = TrapSystem.menu.prepareSkillCheckState(token, playerid, triggeredTokenId, charId);
                            if (success) {
                                // If state was prepared, we can skip to the response menu.
                                TrapSystem.menu.showGMResponseMenu(token, playerid, triggeredTokenId);
                                return;
                            }
                        }
                    }
                    // If the smart path fails for any reason, fall back to the manual path.
                    TrapSystem.menu.showCharacterSelectionMenu(token, playerid, triggeredTokenId);
                    break;
            }
        },

        // Internal helper to standardize skill check state creation
        prepareSkillCheckState(trapToken, gmPlayerId, triggeredTokenId, characterId) {
            if (!trapToken || !gmPlayerId || !triggeredTokenId || !characterId) {
                TrapSystem.utils.log("Error: prepareSkillCheckState called with missing arguments.", 'error');
                return false;
            }

            const char = getObj("character", characterId);
            if (!char) {
                TrapSystem.utils.log(`Error: Could not find character with ID ${characterId}`, 'error');
                return false;
            }

            if (!TrapSystem.state.pendingChecks[gmPlayerId]) {
                TrapSystem.state.pendingChecks[gmPlayerId] = {};
            }
            // Populate the "dossier" with all necessary info
            TrapSystem.state.pendingChecks[gmPlayerId].token = trapToken;
            TrapSystem.state.pendingChecks[gmPlayerId].playerid = gmPlayerId;
            TrapSystem.state.pendingChecks[gmPlayerId].characterId = characterId;
            TrapSystem.state.pendingChecks[gmPlayerId].characterName = char.get("name");
            TrapSystem.state.pendingChecks[gmPlayerId].triggeredTokenId = triggeredTokenId;
            
            // Link it for character-based lookups as well
            if (TrapSystem.state.pendingChecksByChar) {
                TrapSystem.state.pendingChecksByChar[characterId] = { ...TrapSystem.state.pendingChecks[gmPlayerId] };
            }

            TrapSystem.utils.log(`Skill check state prepared for ${char.get("name")} by GM ${gmPlayerId}`, 'debug');
            return true;
        },

        handleAllowAction(token, playerid, triggeredTokenId = null) {
            const config = TrapSystem.utils.parseTrapNotes(token.get("gmnotes"), token);
            if (config && config.successMacro) {
                const trappedToken = getObj("graphic", triggeredTokenId);
                const tagToIdMap = TrapSystem.utils.buildTagToIdMap(token, trappedToken);
                const macroString = config.successMacro.trim();
                TrapSystem.utils.executeMacro(macroString, tagToIdMap);
                
                // Only whisper confirmation for commands/macros, not for templates/text.
                if (macroString.startsWith('!') || macroString.startsWith('$') || macroString.startsWith('#')) {
                    TrapSystem.utils.whisper(playerid, `✅ Success macro '${config.successMacro}' executed.`);
                }
            } else {
                TrapSystem.utils.whisper(playerid, "⚠️ No success macro defined for this trap.");
            }

            // After action, resolve trap state.
            if (triggeredTokenId && TrapSystem.state.lockedTokens[triggeredTokenId]) {
                // It was a movement-locked token, release it. This will also deplete the use.
                TrapSystem.utils.log(`[handleAllowAction] Releasing locked token ${triggeredTokenId}.`, 'debug');
                TrapSystem.state.lockedTokens[triggeredTokenId].macroTriggered = true; 
                TrapSystem.triggers.allowMovement(triggeredTokenId);
            } else {
                // It was a manual interaction, just deplete the use from the trap itself.
                TrapSystem.utils.log(`[handleAllowAction] Manually depleting use from trap ${token.id}.`, 'debug');
                const trapData = TrapSystem.utils.parseTrapNotes(token.get("gmnotes"), token);
                if (trapData && trapData.currentUses > 0) {
                    const newUses = trapData.currentUses - 1;
                    TrapSystem.utils.updateTrapUses(token, newUses, trapData.maxUses, newUses > 0);
                    if(newUses <= 0) {
                        TrapSystem.utils.sendDepletedMessage(token);
                    }
                }
            }
        },

        handleFailAction(token, playerid, triggeredTokenId = null) {
            const config = TrapSystem.utils.parseTrapNotes(token.get("gmnotes"), token);
            if (config && config.failureMacro) {
                const trappedToken = getObj("graphic", triggeredTokenId);
                const tagToIdMap = TrapSystem.utils.buildTagToIdMap(token, trappedToken);
                const macroString = config.failureMacro.trim();
                TrapSystem.utils.executeMacro(macroString, tagToIdMap);
            
                // Only whisper confirmation for commands/macros, not for templates/text.
                if (macroString.startsWith('!') || macroString.startsWith('$') || macroString.startsWith('#')) {
                    TrapSystem.utils.whisper(playerid, `❌ Failure macro '${config.failureMacro}' executed.`);
                }
            } else {
                TrapSystem.utils.whisper(playerid, "⚠️ No failure macro defined for this trap.");
            }
            
            // After action, resolve trap state.
            if (triggeredTokenId && TrapSystem.state.lockedTokens[triggeredTokenId]) {
                // It was a movement-locked token, release it. This will also deplete the use.
                TrapSystem.utils.log(`[handleFailAction] Releasing locked token ${triggeredTokenId}.`, 'debug');
                TrapSystem.state.lockedTokens[triggeredTokenId].macroTriggered = true;
                TrapSystem.triggers.allowMovement(triggeredTokenId);
            } else {
                // It was a manual interaction, just deplete the use from the trap itself.
                TrapSystem.utils.log(`[handleFailAction] Manually depleting use from trap ${token.id}.`, 'debug');
                const trapData = TrapSystem.utils.parseTrapNotes(token.get("gmnotes"), token);
                if (trapData && trapData.currentUses > 0) {
                    const newUses = trapData.currentUses - 1;
                    TrapSystem.utils.updateTrapUses(token, newUses, trapData.maxUses, newUses > 0);
                    if(newUses <= 0) {
                        TrapSystem.utils.sendDepletedMessage(token);
                    }
                }
            }
        },

        showCharacterSelectionMenu(token, playerid, triggeredTokenId = null) { // Added triggeredTokenId
            const characters = findObjs({ _type: "character" });
            const tokenName = token.get("name") || "Unknown Token";
            const iconUrl = TrapSystem.utils.getTokenImageURL(token);
            const tokenIcon = iconUrl === '👤' ? '👤' : `<img src="${iconUrl}" width="20" height="20">`;
        
            let menu = `&{template:default} {{name=Select Character for Skill Check}}`;
            menu += `{{Token=${tokenIcon} **${tokenName}**}}`;
            menu += `{{Characters=`;
        
            // Only include characters controlled by at least one non-GM player
            const filtered = characters.filter(char => {
                const controlledBy = (char.get("controlledby") || "").split(",");
                // Exclude if no controllers, or only controlled by GM(s)
                return controlledBy.some(pid => pid && !TrapSystem.utils.playerIsGM(pid));
            });
        
            filtered.forEach(char => {
                const charName = char.get("name");
                const charId = char.id;
                menu += `[${charName}](!trapsystem selectcharacter ${token.id} ${charId} ${playerid} ${triggeredTokenId || ''}) `;
            });
        
            menu += `}}`;
            TrapSystem.utils.chat(menu);
        },

        handleSkillCheck(token, checkIndex, playerid, hideDisplayDCButton = false, hideSetDCButton = false, whisperTo = 'gm', triggeredTokenId = null) {
            TrapSystem.utils.log(`handleSkillCheck tokenId:${token.id}, checkIndex:${checkIndex}, playerid:${playerid}, victim:${triggeredTokenId}`,'debug');
            const config = TrapSystem.utils.parseTrapNotes(token.get("gmnotes"), token);
            if (!config || !config.checks || (checkIndex !== 'custom' && checkIndex >= config.checks.length)) {
                 TrapSystem.utils.log('Exiting handleSkillCheck: Invalid config or checkIndex.', 'debug');
                 return;
            }

            const check = (checkIndex === 'custom' && TrapSystem.state.pendingChecks[playerid]?.config?.checks[0]) 
                ? TrapSystem.state.pendingChecks[playerid].config.checks[0]
                : config.checks[checkIndex];

            if (!check) {
                TrapSystem.utils.log('Exiting handleSkillCheck: Check object not found.', 'debug');
                return;
            }
            
            const tokenName = token.get("name") || "Unknown Token";
            const url1 = TrapSystem.utils.getTokenImageURL(token);
            const tokenIcon = url1 === '👤' ? '👤' : `<img src="${url1}" width="20" height="20">`;
            const emoji = TrapSystem.config.SKILL_TYPES[check.type] || "🎲";
            const skillType = check.type.replace(/_/g, ' ');

            const existingCheck = TrapSystem.state.pendingChecks[playerid] || {};

            // --- Get character details from the triggered token ---
            let charId = existingCheck.characterId || null;
            let charName = existingCheck.characterName || null;
            if (triggeredTokenId && !charId) { // If we have a victim token and haven't already determined the character
                const victimToken = getObj("graphic", triggeredTokenId);
                if (victimToken) {
                    const victimCharId = victimToken.get("represents");
                    if (victimCharId) {
                        const victimChar = getObj("character", victimCharId);
                        if (victimChar) {
                            charId = victimChar.id;
                            charName = victimChar.get("name");
                            TrapSystem.utils.log(`[handleSkillCheck] Derived character ${charName} (ID: ${charId}) from triggeredTokenId ${triggeredTokenId}.`, 'debug');
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
                characterId: charId, // Now correctly populated
                characterName: charName, // Now correctly populated
                triggeredTokenId: triggeredTokenId || existingCheck.triggeredTokenId // IMPORTANT: Carry over the ID
            };
            TrapSystem.state.pendingChecks[playerid] = pendingCheck;
            if (pendingCheck.characterId) {
                TrapSystem.state.pendingChecksByChar[pendingCheck.characterId] = pendingCheck;
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
            if (!hideDisplayDCButton && !TrapSystem.state.displayDCForCheck[playerid]) {
                menu += ` | [Display DC](!trapsystem displaydc ${token.id} ${checkIndex} ${playerid})`;
            }
            menu += `}}`;
            if (whisperTo === 'gm') {
                TrapSystem.utils.chat(menu);
            } else {
                sendChat("TrapSystem", menu);
            }
        },

        handleCustomCheck(token, playerid, triggeredTokenId, skillType, dc) {
            TrapSystem.utils.log(`handleCustomCheck tokenId:${token.id}, playerid:${playerid}, triggeredTokenId:${triggeredTokenId}, skillType:${skillType}, dc:${dc}`, 'debug');
            const config = TrapSystem.utils.parseTrapNotes(token.get("gmnotes"), token);
            if (!config) return;

            const newDc = parseInt(dc, 10);
            if (isNaN(newDc)) {
                TrapSystem.utils.chat("❌ Error: DC must be a number.");
                return;
            }

            const prevPending = TrapSystem.state.pendingChecks[playerid] || {};
            const checkData = {
                type: skillType,
                dc: newDc
            };

            const pendingCheck = {
                token: token,
                checkIndex: 'custom',
                config: { ...config, checks: [checkData] },
                advantage: null,
                firstRoll: null,
                playerid: playerid,
                characterId: prevPending.characterId,
                characterName: prevPending.characterName,
                triggeredTokenId: triggeredTokenId
            };
            TrapSystem.state.pendingChecks[playerid] = pendingCheck;
            if (pendingCheck.characterId) {
                TrapSystem.state.pendingChecksByChar[pendingCheck.characterId] = pendingCheck;
            }

            const tokenName = token.get("name") || "Unknown Token";
            const tokenIconUrl = TrapSystem.utils.getTokenImageURL(token, 'thumb');
            const tokenIcon = tokenIconUrl === '👤' ? '👤' : `<img src="${tokenIconUrl}" width="20" height="20">`;
            const emoji = TrapSystem.config.SKILL_TYPES[skillType] || "🎲";

            let menu = `&{template:default} {{name=${emoji} ${skillType} Check (DC ${newDc})}}`;
            menu += `{{Token=${tokenIcon} **${tokenName}**}}`;
            menu += `{{Roll=`;
            menu += `[Advantage](!trapsystem rollcheck ${token.id} custom advantage ${playerid} 0 ${triggeredTokenId || ''}) | `;
            menu += `[Normal](!trapsystem rollcheck ${token.id} custom normal ${playerid} 0 ${triggeredTokenId || ''}) | `;
            menu += `[Disadvantage](!trapsystem rollcheck ${token.id} custom disadvantage ${playerid} 0 ${triggeredTokenId || ''})`;
            
            if (!TrapSystem.state.displayDCForCheck[playerid]) {
                menu += ` | [Display DC](!trapsystem displaydc ${token.id} custom ${playerid})`;
            }
            menu += `}}`;

            TrapSystem.utils.chat(menu);
        },

        handleRollCheck(token, checkIndex, advantage, playerid, modifier = 0, triggeredTokenId = null) {
            TrapSystem.utils.log(`handleRollCheck tokenId:${token.id}, checkIndex:${checkIndex}, advantage:${advantage}, playerid:${playerid}, modifier:${modifier}, triggeredTokenId:${triggeredTokenId}`, 'debug');
            const config = TrapSystem.utils.parseTrapNotes(token.get("gmnotes"), token);
            if (!config) return;

            const check = checkIndex === "custom"
                ? TrapSystem.state.pendingChecks[playerid]?.config.checks[0]
                : config.checks[checkIndex];
            if(!check) return;

            const tokenName = token.get("name") || "Unknown Token";
            const url5 = TrapSystem.utils.getTokenImageURL(token);
            const tokenIcon = url5 === '👤' ? '👤' : `<img src="${url5}" width="20" height="20">`;
            const emoji = TrapSystem.config.SKILL_TYPES[check.type] || "🎲";
            const skillType = check.type.replace(/_/g, ' ');

            // Get the existing pending check or create a new one
            const existingCheck = TrapSystem.state.pendingChecks[playerid] || {};

            // Update the pending check
            const pendingCheck = {
                token: token,
                checkIndex: checkIndex,
                config: {
                    ...config,
                    checks: [check]
                },
                advantage: advantage,
                firstRoll: null,
                playerid: playerid,
                characterId: existingCheck.characterId,
                characterName: existingCheck.characterName,
                triggeredTokenId: triggeredTokenId
            };

            // Store in both maps
            TrapSystem.state.pendingChecks[playerid] = pendingCheck;
            if (pendingCheck.characterId) {
                TrapSystem.state.pendingChecksByChar[pendingCheck.characterId] = pendingCheck;
                TrapSystem.utils.log(`Updated pending check for player:${playerid} and character:${pendingCheck.characterId}`, 'debug');
            } else {
                TrapSystem.utils.log(`Warning: No character ID available for pending check`, 'warning');
            }

            let rollInstructions = "";
            let rollNote = "";
            if (advantage === "advantage") {
                rollInstructions = "Roll with advantage";
                rollNote = "Using the higher of two rolls";
            } else if (advantage === "disadvantage") {
                rollInstructions = "Roll with disadvantage";
                rollNote = "Using the lower of two rolls";
            } else {
                rollInstructions = "Roll normally";
            }

            const showDC = TrapSystem.state.displayDCForCheck[playerid] === true;
            let menu = `&{template:default} {{name=${emoji} Skill Check Required}}`;
            menu += `{{Token=${tokenIcon} **${tokenName}**}}`;
            menu += `{{Skill=${skillType}}}`;
            if (showDC) menu += `{{DC=${check.dc}}}`; // Only show if GM pressed the button
            menu += `{{Roll Type=${advantage.charAt(0).toUpperCase() + advantage.slice(1)}}}`;
            if (advantage !== 'normal') {
                menu += `{{Instructions=${rollInstructions}}}`;
                menu += `{{Note=${rollNote}}}`;
            } else {
                menu += `{{Instructions=Roll 1d20 using your character sheet or /roll 1d20}}`;
            }
            sendChat("TrapSystem", menu);
        },

        showGMResponseMenu(token, playerid, triggeredTokenId = null) {
            const config = TrapSystem.utils.parseTrapNotes(token.get("gmnotes"), token);
            const tokenName = token.get("name") || "Unknown Token";
            const url5b = TrapSystem.utils.getTokenImageURL(token);
            const tokenIcon = url5b === '👤' ? '👤' : `<img src="${url5b}" width="20" height="20">`;
            let menu = `&{template:default} {{name=GM Response}}`;
            menu += `{{Token=${tokenIcon} **${tokenName}**}}`;
            menu += `{{Action=💭 Explained Action}}`;

            // Build the quick actions buttons
            let quickActionButtons = [
                `[✅ Allow Action](!trapsystem allow ${token.id} ${playerid} ${triggeredTokenId || ''})`,
                `[❌ Fail Action](!trapsystem fail ${token.id} ${playerid} ${triggeredTokenId || ''})`
            ];
            
            // Add the Allow Movement button if there's a trapped token
            if (triggeredTokenId) {
                const allowMoveUrl = `!trapsystem allowmovement ${triggeredTokenId}`;
                quickActionButtons.push(`[▶️ Allow Move](${allowMoveUrl})`);
            }
            
            menu += `{{Quick Actions=${quickActionButtons.join(' | ')}}}`;
            
            // This part is the same as your existing code
            if (config.checks && config.checks.length > 0) {
                let checkOptions = config.checks.map((check, index) => {
                    const emoji = TrapSystem.config.SKILL_TYPES[check.type] || "🎲";
                    const skillType = check.type.replace(/_/g, ' ');
                    return `[${emoji} ${skillType} (DC ${check.dc})](!trapsystem check ${token.id} ${index} ${playerid} ${triggeredTokenId || ''})`;
                }).join(" | ");
                menu += `{{Skill Checks=${checkOptions}}}`;
            }
            const skillListForQuery = Object.keys(TrapSystem.config.SKILL_TYPES).join('|');
            menu += `{{Custom Check=[🎲 Set Custom Check](!trapsystem customcheck ${token.id} ${playerid} ${triggeredTokenId || 'null'} ?{Skill|${skillListForQuery}} ?{DC|10})}}`;
            TrapSystem.utils.chat(menu);
        },

        handleDisplayDC(token, checkIndex, playerid) {
            // args: token.id, checkIndex, playerid
            TrapSystem.state.displayDCForCheck[playerid] = true;
            // Re-show the GM menu, but without the Display DC button
            TrapSystem.menu.handleSkillCheck(getObj("graphic", token.id), checkIndex, playerid, true);
        }
    },

    //----------------------------------------------------------------------
    // 6) INTERACTION: handleRollResult (Final step for advantage/disadv)
    //----------------------------------------------------------------------
    interaction: {
        handleRollResult(roll, playerid_of_roller) { // Renamed playerid to playerid_of_roller for clarity
            try {
                TrapSystem.utils.log(`Processing roll result from player:${playerid_of_roller} (who rolled) => total:${roll.total}, roll.characterid:${roll.characterid}`, 'debug');
                
                let pendingCheck = null;

                // Strategy 1: Roll has an explicit character ID (from sheet or previously auto-associated flat roll for single-char player)
                if (roll.characterid) {
                    pendingCheck = TrapSystem.state.pendingChecksByChar[roll.characterid];
                    if (pendingCheck) {
                        TrapSystem.utils.log(`Found pending check by roll.characterid: ${roll.characterid}. Associated char: ${pendingCheck.characterName}`, 'debug');
                        // Basic authorization: GM or player controlling the character can make the roll for them.
                        const character = getObj("character", roll.characterid);
                        let authorized = false;
                        if (character) {
                            const controlledBy = (character.get("controlledby") || "").split(",");
                            if (TrapSystem.utils.playerIsGM(playerid_of_roller) || controlledBy.includes(playerid_of_roller) || playerid_of_roller === pendingCheck.playerid) {
                                authorized = true;
                            }
                        }
                        if (!authorized) {
                            TrapSystem.utils.log(`Roller ${playerid_of_roller} is not authorized for character ${roll.characterid} tied to this pending check.`, 'warning');
                            pendingCheck = null; // Invalidate if roller isn't authorized for this character's check
                        }
                    } else {
                        TrapSystem.utils.log(`No pending check found in pendingChecksByChar for roll.characterid: ${roll.characterid}`, 'debug');
                    }
                }

                // Strategy 2: Roll is flat (no roll.characterid yet) - try to find a unique pending check via characters controlled by the roller.
                if (!pendingCheck && !roll.characterid) { // Only if roll didn't come with a characterID
                    const allChars = findObjs({ _type: "character" });
                    const charsControlledByRoller = allChars.filter(char => {
                        const controlledByArray = (char.get("controlledby") || "").split(",");
                        // Roller must control the char, and char must be player-controllable (not GM only)
                        return controlledByArray.includes(playerid_of_roller) && controlledByArray.some(pId => pId && pId.trim() !== "" && !TrapSystem.utils.playerIsGM(pId));
                    });

                    let potentialChecks = [];
                    for (const char of charsControlledByRoller) {
                        if (TrapSystem.state.pendingChecksByChar[char.id]) {
                            // Ensure this pending check is actually for this character
                            if (TrapSystem.state.pendingChecksByChar[char.id].characterId === char.id) {
                                potentialChecks.push(TrapSystem.state.pendingChecksByChar[char.id]);
                            }
                        }
                    }

                    if (potentialChecks.length === 1) {
                        pendingCheck = potentialChecks[0];
                        roll.characterid = pendingCheck.characterId; // IMP: Update roll object with characterId for consistency
                        TrapSystem.utils.log(`Flat roll by ${playerid_of_roller}. Matched to single pending check for character ${pendingCheck.characterName} (ID: ${roll.characterid}) via roller's controlled characters.`, 'debug');
                    } else if (potentialChecks.length > 1) {
                        TrapSystem.utils.log(`Flat roll by ${playerid_of_roller} who controls multiple characters, each with a distinct pending check. Ambiguous.`, 'warning');
                    } else {
                        TrapSystem.utils.log(`Flat roll by ${playerid_of_roller}. No unique pending check found via their controlled characters.`, 'debug');
                    }
                }

                // Strategy 3: Fallback to playerid_of_roller if they initiated a generic check (less common for GM-driven UI)
                // This might happen if a player uses a command that directly creates a pending check for themselves without char selection.
                if (!pendingCheck) {
                    pendingCheck = TrapSystem.state.pendingChecks[playerid_of_roller];
                    if (pendingCheck) {
                        TrapSystem.utils.log(`Found pending check by playerid_of_roller: ${playerid_of_roller}. This implies roller initiated a generic check.`, 'debug');
                        if (pendingCheck.characterId && !roll.characterid) {
                           roll.characterid = pendingCheck.characterId; // Ensure roll.characterid is set if pendingCheck had one
                        } 
                        // If pendingCheck.characterId is null here, it's a truly generic check for this player.
                    } else {
                        // This is where your log originally said "No pending check found..."
                         TrapSystem.utils.log(`No pending check found for player ${playerid_of_roller} in pendingChecks map either.`, 'debug');
                    }
                }

                if (!pendingCheck) {
                    TrapSystem.utils.log(`FINAL: No pending check ultimately found for player:${playerid_of_roller} or character:${roll.characterid} after all lookup strategies. Roll will not be processed for trap interaction.`, 'warning');
                    return;
                }
                
                const { token, config, advantage, triggeredTokenId } = pendingCheck;
                const trappedToken = getObj("graphic", triggeredTokenId); 
                const check = pendingCheck.config.checks[0];
                const tokenName = token.get("name") || "Unknown Token";
                const url6 = TrapSystem.utils.getTokenImageURL(token);
                const tokenIcon = url6 === '👤' ? '👤' : `<img src="${url6}" width="20" height="20">`;
                const characterNameToDisplay = pendingCheck.characterName || "Player";
                const emoji = TrapSystem.config.SKILL_TYPES[check.type] || "🎲";
                const skillType = check.type.replace(/_/g, ' ');

                // --- Skill/Ability/Save Matching Logic ---
                // Normalize function: lowercases and strips ' check'/' save' suffixes
                function normalizeType(str) {
                    return (str||'').toLowerCase().replace(/\s*(check|save)$/i, '').trim();
                }
                const expectedTypeRaw = pendingCheck.config.checks[0].type;
                const rolledTypeRaw = roll.rolledSkillName || '';
                const expectedType = normalizeType(expectedTypeRaw);
                const rolledType = normalizeType(rolledTypeRaw);
                TrapSystem.utils.log(`[SkillMatch] Expected: '${expectedTypeRaw}' (normalized: '${expectedType}'), Rolled: '${rolledTypeRaw}' (normalized: '${rolledType}')`, 'debug');
                let mismatch = false;
                let mismatchReason = '';

                // Helper: is this a flat d20 roll? (no skill/ability/save attached)
                const isFlatRoll = !roll.rolledSkillName;
                const expectsFlatRoll = expectedType === 'flat roll';

                if (expectsFlatRoll && isFlatRoll) {
                    // Flat roll expected, flat roll received: accept
                } else if (expectsFlatRoll && !isFlatRoll) {
                    // Flat roll expected, but skill/ability/save rolled: mismatch
                    mismatch = true;
                    mismatchReason = 'Expected a flat d20 roll, but a skill/ability/save was rolled.';
                } else if (!expectsFlatRoll && isFlatRoll) {
                    // Skill/ability/save expected, but flat roll received: mismatch
                    mismatch = true;
                    mismatchReason = 'Expected a skill/ability/save, but a flat d20 roll was rolled.';
                } else if (!expectsFlatRoll && !isFlatRoll) {
                    // Both expected and rolled are skills/abilities/saves
                    if (expectedType !== rolledType) {
                        mismatch = true;
                        mismatchReason = `Expected '${expectedTypeRaw}', but got '${rolledTypeRaw}'.`;
                    }
                }

                if (mismatch) {
                    // Show GM menu for mismatch
                    const trapUrl = TrapSystem.utils.getTokenImageURL(token);
                    const trapImg = trapUrl === '👤' ? '👤' : `<img src='${trapUrl}' width='20' height='20'>`;
                    const trapName = token.get('name') && token.get('name') !== 'Unknown Token' ? token.get('name') : 'Unknown Token';
                    const gmMenu = `&{template:default} {{name=⚠️ Roll Skill Mismatch!}} {{Character=${pendingCheck.characterName || 'Unknown'}}} {{Trap=${trapImg} ${trapName}}} {{Expected=${expectedTypeRaw}}} {{Rolled=${rolledTypeRaw || 'Flat Roll'}}} {{Reason=${mismatchReason}}} {{Actions=[✅ Accept Roll](!trapsystem resolvemismatch ${pendingCheck.characterId || pendingCheck.playerid} ${token.id} accept ${roll.total} ${roll.rollType||'normal'} ${roll.isAdvantageRoll?'1':'0'}) [❌ Reject & Reroll](!trapsystem resolvemismatch ${pendingCheck.characterId || pendingCheck.playerid} ${token.id} reject) [ℹ️ Show Trap Status](!trapsystem status ${token.id})}}`;
                    TrapSystem.utils.chat(gmMenu);
                    TrapSystem.utils.log(`Skill/ability/save mismatch detected: ${mismatchReason}`, 'warning');
                    return; // Do not process further until GM resolves
                }

                // Enhanced character verification (already partially handled by auth check in Strategy 1)
                const expectedCharId = pendingCheck.characterId; // This should now be reliable if a character was associated
                const actualCharId = roll.characterid; // This is what the roll is claiming to be for, or what we inferred

                if (expectedCharId && actualCharId && expectedCharId !== actualCharId) {
                    // This case should be rare now due to earlier checks, but good for safety.
                    TrapSystem.utils.chat(`⚠️ Roll from character ${actualCharId} but pending check was for ${expectedCharId} (${pendingCheck.characterName}). Critical Mismatch. Ignoring.`);
                    return;
                }

                if (roll.isAdvantageRoll) {
                    let menu = `&{template:default} {{name=${emoji} ${characterNameToDisplay} - ${skillType} Result}}`; // Added char name
                    menu += `{{Token=${tokenIcon} **${tokenName}**}}`;
                    menu += `{{First Roll=${roll.firstRoll}}}`;
                    menu += `{{Second Roll=${roll.secondRoll}}}`;
                    menu += `{{Final Roll=${roll.total}}}`;
                    if (TrapSystem.state.displayDCForCheck[playerid_of_roller] === true) {
                        menu += `{{DC=${check.dc}}}`;
                    }
                    const success = roll.total >= check.dc;
                    menu += success ? `{{Result=✅ Success!}}` : `{{Result=❌ Failure!}}`;
                    if (roll.rollType) {
                        menu += `{{Roll Type=${roll.rollType.charAt(0).toUpperCase() + roll.rollType.slice(1)}}}`;
                    }
                    sendChat("TrapSystem", menu);
                    
                    const tagToIdMap = TrapSystem.utils.buildTagToIdMap(token, trappedToken, null);
                    if (success && config.successMacro) TrapSystem.utils.executeMacro(config.successMacro, tagToIdMap);
                    if (!success && config.failureMacro) TrapSystem.utils.executeMacro(config.failureMacro, tagToIdMap);
                    
                    // After either success or failure, resolve the trap state.
                    if (triggeredTokenId && TrapSystem.state.lockedTokens[triggeredTokenId]) {
                        // It was a movement-locked token. Release it, which also depletes the use.
                        TrapSystem.utils.log(`Post-skill check: Releasing locked token ${triggeredTokenId}.`, 'debug');
                        TrapSystem.state.lockedTokens[triggeredTokenId].macroTriggered = true;
                        TrapSystem.triggers.allowMovement(triggeredTokenId);
                    } else {
                        // It was a manual interaction. Just deplete the use from the trap token.
                        TrapSystem.utils.log(`Post-skill check: Manually depleting use from trap ${token.id}.`, 'debug');
                        if (config && config.currentUses > 0) {
                            const newUses = config.currentUses - 1;
                            TrapSystem.utils.updateTrapUses(token, newUses, config.maxUses, newUses > 0);
                             if(newUses <= 0) {
                                TrapSystem.utils.sendDepletedMessage(token);
                            }
                        }
                    }
                    // Cleanup the specific character's check from pendingChecksByChar
                    if (pendingCheck.characterId) delete TrapSystem.state.pendingChecksByChar[pendingCheck.characterId];
                    // Also cleanup the original initiator's pendingCheck from pendingChecks map
                    if (TrapSystem.state.pendingChecks[pendingCheck.playerid] === pendingCheck) {
                         delete TrapSystem.state.pendingChecks[pendingCheck.playerid];
                    }
                    TrapSystem.state.displayDCForCheck[playerid_of_roller] = false;
                    return;
                }

                // Manual rolls (firstRoll / secondRoll logic)
                if (pendingCheck.firstRoll === null && (advantage === 'advantage' || advantage === 'disadvantage')) {
                    pendingCheck.firstRoll = roll.total;
                    // Store the updated pendingCheck back if it was retrieved by characterId
                    if(pendingCheck.characterId) TrapSystem.state.pendingChecksByChar[pendingCheck.characterId] = pendingCheck;
                    // Also update the one keyed by the original playerid
                    TrapSystem.state.pendingChecks[pendingCheck.playerid] = pendingCheck; 

                    let menu = `&{template:default} {{name=🎲 ${characterNameToDisplay} - Waiting For Second Roll}}`;
                    menu += `{{First Roll=${roll.total}}}`;
                    menu += `{{Note=Please roll again for ${advantage}}}`;
                    sendChat("TrapSystem", menu);
                    return;
                }
                
                const finalTotal = advantage !== 'normal'
                    ? (advantage === 'advantage'
                        ? Math.max(pendingCheck.firstRoll, roll.total)
                        : Math.min(pendingCheck.firstRoll, roll.total))
                    : roll.total;

                let menu = `&{template:default} {{name=${emoji} ${characterNameToDisplay} - ${skillType} Result}}`;
                menu += `{{Token=${tokenIcon} **${tokenName}**}}`;
                if (advantage !== 'normal') {
                    menu += `{{First Roll=${pendingCheck.firstRoll}}}`;
                    menu += `{{Second Roll=${roll.total}}}`;
                    menu += `{{Roll Type=${advantage.charAt(0).toUpperCase() + advantage.slice(1)}}}`;
                }
                menu += `{{Final Roll=${finalTotal}}}`;
                if (TrapSystem.state.displayDCForCheck[playerid_of_roller] === true) {
                    menu += `{{DC=${check.dc}}}`;
                }
                const success = finalTotal >= check.dc;
                menu += success ? `{{Result=✅ Success!}}` : `{{Result=❌ Failure!}}`;
                sendChat("TrapSystem", menu);

                const tagToIdMap = TrapSystem.utils.buildTagToIdMap(token, trappedToken, null);
                if (success && config.successMacro) TrapSystem.utils.executeMacro(config.successMacro, tagToIdMap);
                if (!success && config.failureMacro) TrapSystem.utils.executeMacro(config.failureMacro, tagToIdMap);
                
                // After either success or failure, resolve the trap state.
                if (triggeredTokenId && TrapSystem.state.lockedTokens[triggeredTokenId]) {
                    // It was a movement-locked token. Release it, which also depletes the use.
                    TrapSystem.utils.log(`Post-skill check: Releasing locked token ${triggeredTokenId}.`, 'debug');
                    TrapSystem.state.lockedTokens[triggeredTokenId].macroTriggered = true;
                    TrapSystem.triggers.allowMovement(triggeredTokenId);
                } else {
                    // It was a manual interaction. Just deplete the use from the trap token.
                    TrapSystem.utils.log(`Post-skill check: Manually depleting use from trap ${token.id}.`, 'debug');
                    if (config && config.currentUses > 0) {
                        const newUses = config.currentUses - 1;
                        TrapSystem.utils.updateTrapUses(token, newUses, config.maxUses, newUses > 0);
                         if(newUses <= 0) {
                            TrapSystem.utils.sendDepletedMessage(token);
                        }
                    }
                }
                // Cleanup
                if (pendingCheck.characterId) delete TrapSystem.state.pendingChecksByChar[pendingCheck.characterId];
                if (TrapSystem.state.pendingChecks[pendingCheck.playerid] === pendingCheck) {
                     delete TrapSystem.state.pendingChecks[pendingCheck.playerid];
                }
                TrapSystem.state.displayDCForCheck[playerid_of_roller] = false;

            } catch (err) {
                TrapSystem.utils.log("Error in handleRollResult: " + err.message + " Stack: " + err.stack, 'error'); // Added stack
            }
        }
    },

    //----------------------------------------------------------------------
    // [NEW SECTION] MACRO EXPORT & STATE RESET SYSTEM
    //----------------------------------------------------------------------
    macroExporter: {
        // --- State Capture ---
        captureTokenState(token) {
            if (!token) return;
            let tokenID = token.id || token.get("_id"); // Ensure we get ID
            if (!tokenID) {
                TrapSystem.utils.log("captureTokenState: Could not get token ID.", 'error');
                return;
            }

            if (!TrapSystem.state.macroExportStates[tokenID]) {
                const state = TrapSystem.utils.getObjectState(token);
                if (state) {
                    TrapSystem.state.macroExportStates[tokenID] = state;
                    TrapSystem.utils.log(`Stored state for token ${tokenID}: ${JSON.stringify(TrapSystem.state.macroExportStates[tokenID])}`, 'debug');
                } else {
                    TrapSystem.utils.log(`Could not get state for token ${tokenID}`, 'warn');
                }
            }
        },

        captureDoorObjectState(doorObj) { // Renamed to avoid conflict with macro parsing
            if (!doorObj) return;
            let doorID = doorObj.id || doorObj.get("_id");
             if (!doorID) {
                TrapSystem.utils.log("captureDoorObjectState: Could not get door ID.", 'error');
                return;
            }

            if (!TrapSystem.state.macroExportDoorStates[doorID]) {
                 const state = TrapSystem.utils.getObjectState(doorObj); // Use generic state capture
                if (state) {
                    TrapSystem.state.macroExportDoorStates[doorID] = state;
                    TrapSystem.utils.log(`Stored initial state of Door ${doorID}: ${JSON.stringify(TrapSystem.state.macroExportDoorStates[doorID])}`, 'debug');
                } else {
                     TrapSystem.utils.log(`Could not get state for door ${doorID}`, 'warn');
                }
            }
        },

        // --- Macro Processing ---
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
    },

    //----------------------------------------------------------------------
    // [NEW SECTION] 6) PASSIVE DETECTION SYSTEM
    //----------------------------------------------------------------------
    passive: {
        handlePassiveNotice(triggeringToken, noticedTrap, perceptionData, trapConfig, distanceToTrap) {
            // perceptionData is now an object: { finalPP, basePP, luckBonus }
            const charId = triggeringToken.get('represents');
            const observerId = charId || triggeringToken.id;

            // Ensure passivelyNoticedTraps is initialized at the state level if not already
            if (typeof TrapSystem.state.passivelyNoticedTraps !== 'object' || TrapSystem.state.passivelyNoticedTraps === null) {
                TrapSystem.state.passivelyNoticedTraps = {};
            }
            // Update state that this character has noticed this trap
            if (!TrapSystem.state.passivelyNoticedTraps[noticedTrap.id]) {
                TrapSystem.state.passivelyNoticedTraps[noticedTrap.id] = {};
            }
            TrapSystem.state.passivelyNoticedTraps[noticedTrap.id][observerId] = true;

            // Persistently mark the trap as detected in its notes
            let notes = noticedTrap.get("gmnotes");
            let decodedNotes = "";
            try { decodedNotes = decodeURIComponent(notes); } catch (e) { decodedNotes = notes; }

            // This regex is specifically designed not to match across different {!...} blocks.
            const detectionBlockRegex = /\{!trapdetection\s+((?:(?!\{!}).)*)\}/;
            const match = decodedNotes.match(detectionBlockRegex);

            if (match && match[1] && !/detected:\s*\[on\]/.test(match[1])) {
                const originalFullBlock = match[0];
                const originalBlockContent = match[1];
                
                // Add the detected flag to the content
                const newBlockContent = originalBlockContent.trim() + ' detected:[on]';
                // Reconstruct the full block string
                const newFullBlock = `{!trapdetection ${newBlockContent}}`;
                
                // Replace the old block with the new one in the notes
                const updatedNotes = decodedNotes.replace(originalFullBlock, newFullBlock);
                
                noticedTrap.set("gmnotes", encodeURIComponent(updatedNotes));
                // Re-parse the notes to get the most up-to-date config for message generation
                trapConfig = TrapSystem.utils.parseTrapNotes(updatedNotes, noticedTrap, false);
            }


            // Update the trap's aura2 color to show it's been detected
            noticedTrap.set({
                aura2_color: TrapSystem.config.AURA_COLORS.DETECTED
            });

            const character = charId ? getObj('character', charId) : null;
            const observerName = character ? character.get('name') : triggeringToken.get('name') || "Unnamed Token";
            const trapName = noticedTrap.get('name') || 'Unnamed Trap';

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
            function replacePlaceholders(str) {
                if (!str) return '';
                let result = str;
                for (const [key, value] of Object.entries(placeholders)) {
                    // Escape special regex characters in the key
                    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    result = result.replace(new RegExp(escapedKey, 'g'), value);
                }
                return result;
            }

            // --- Define fixed template parts and default message contents ---
            const PLAYER_MSG_TEMPLATE_NAME = "⚠️ Alert!"; // Using the "Alert!" version
            const PLAYER_MSG_PREFIX = `&{template:default} {{name=${PLAYER_MSG_TEMPLATE_NAME}}} {{message=`;
            
            // Get player's token image for GM message header
            const playerTokenImgUrl = TrapSystem.utils.getTokenImageURL(triggeringToken, 'thumb');
            const playerTokenImage = playerTokenImgUrl === '👤' ? '' : `<img src='${playerTokenImgUrl}' width='30' height='30' style='vertical-align: middle; margin-left: 5px;'>`;
            const GM_MSG_TEMPLATE_NAME = `🎯 Passive Spot ${playerTokenImage}`;

            const GM_MSG_PREFIX = `&{template:default} {{name=${GM_MSG_TEMPLATE_NAME}}} {{message=`;
            const MSG_SUFFIX = "}}";

            const defaultPlayerMsgContent = TrapSystem.config.messages.defaults.playerNotice;
            const defaultGmMsgContent = TrapSystem.config.messages.defaults.gmNotice;

            // Player Message
            // trapConfig.passiveNoticePlayer now stores ONLY the message content
            let playerMsgContent = trapConfig.passiveNoticePlayer || defaultPlayerMsgContent;
            let finalPlayerMsg = PLAYER_MSG_PREFIX + replacePlaceholders(playerMsgContent) + MSG_SUFFIX;
            
            let controllingPlayerIds = [];
            if (character) {
                controllingPlayerIds = (character.get('controlledby') || "").split(',')
                    .map(pid => pid.trim())
                    .filter(pid => pid && !TrapSystem.utils.playerIsGM(pid));
            } else {
                controllingPlayerIds = (triggeringToken.get('controlledby') || "").split(',')
                    .map(pid => pid.trim())
                    .filter(pid => pid && !TrapSystem.utils.playerIsGM(pid));
            }

            // Debounce Player Messages ---
            const currentTime = Date.now();
            const debounceTime = TrapSystem.config.messages.passiveNoticeDebounceTime || 100000; // Default 100s

            if (!TrapSystem.state.recentlyNoticedPlayerMessages[charId]) {
                TrapSystem.state.recentlyNoticedPlayerMessages[charId] = [];
            }

            // Filter out old messages
            TrapSystem.state.recentlyNoticedPlayerMessages[charId] = TrapSystem.state.recentlyNoticedPlayerMessages[charId].filter(
                entry => (currentTime - entry.timestamp) < debounceTime
            );

            const alreadySentRecently = TrapSystem.state.recentlyNoticedPlayerMessages[charId].some(
                entry => entry.messageContent === finalPlayerMsg
            );

            if (alreadySentRecently) {
                TrapSystem.utils.log(`Passive Notice SUPPRESSED for player(s) of ${charName} (charId: ${charId}) - identical message sent recently: ${finalPlayerMsg.substring(0,100)}...`, 'debug');
            } else if (controllingPlayerIds.length > 0) {
                controllingPlayerIds.forEach(pid => {
                    const player = getObj("player", pid);
                    if(player) {
                        // Whisper to specific player ID
                        sendChat("TrapSystem", `/w "${player.get("displayname") || pid}" ${finalPlayerMsg}`);
                    }
                     else {
                        TrapSystem.utils.log(`Passive Notice: Could not find player object for ID ${pid}`, 'warn');
                    }
                });
                // Record this message as sent
                TrapSystem.state.recentlyNoticedPlayerMessages[charId].push({ messageContent: finalPlayerMsg, timestamp: currentTime });
            } else {
                // If no players control the token, and the message isn't a repeat, send a specific warning to the GM.
                TrapSystem.utils.chat(`⚠️ No players control '${observerName}', which would have spotted '${trapName}'.`);
                TrapSystem.utils.log(`Passive Notice: No non-GM players control observer ${observerName} to send notice.`, 'info');
            }

            // trapConfig.passiveNoticeGM now stores ONLY the message content
            let gmMsgContent = trapConfig.passiveNoticeGM || defaultGmMsgContent;
            let finalGmMsg = GM_MSG_PREFIX + replacePlaceholders(gmMsgContent) + MSG_SUFFIX;
            TrapSystem.utils.chat(finalGmMsg);

            TrapSystem.utils.log(`Passive Notice: ${charName} (BasePP ${perceptionData.basePP}, Luck ${perceptionData.luckBonus}, FinalPP ${perceptionData.finalPP}) spotted ${trapName} (DC ${trapConfig.passiveSpotDC}) at ${distanceToTrap.toFixed(1)}ft. Player msg content: '${finalPlayerMsg}', GM msg content: '${finalGmMsg}'`);
        },

        async getCharacterPassivePerception(token, trapConfig) {
            if (TrapSystem.config.DEBUG) TrapSystem.utils.log(`[getCharacterPassivePerception] Received trapConfig: ${JSON.stringify(trapConfig)}`, 'debug');
            
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
                            TrapSystem.utils.log(`Got PP ${parsedPP} from 'passive_wisdom' (getSheetItem) for char ${charId}.`, 'debug');
                            basePP = parsedPP;
                        }
                    }
                    if (basePP === null) {
                        TrapSystem.utils.log(`'passive_wisdom' (getSheetItem) for char ${charId} was empty or not a number: '${ppRaw}'.`, 'debug');
                    }
                } catch (err) {
                    TrapSystem.utils.log(`Error with getSheetItem for 'passive_wisdom' on char ${charId}: ${err}. Falling back.`, 'warn');
                }
            }

            // 2. Try to get 'passive_wisdom' attribute directly using getAttrByName (classic method)
            if (basePP === null && typeof getAttrByName === 'function') {
                const passiveWisdomRaw = getAttrByName(charId, "passive_wisdom");
                if (passiveWisdomRaw !== undefined && passiveWisdomRaw !== null && passiveWisdomRaw !== "") {
                    const parsedPP = parseInt(passiveWisdomRaw, 10);
                    if (!isNaN(parsedPP)) {
                        TrapSystem.utils.log(`Got PP ${parsedPP} from 'passive_wisdom' (getAttrByName) for char ${charId}.`, 'debug');
                        basePP = parsedPP;
                    } else {
                        TrapSystem.utils.log(`'passive_wisdom' (getAttrByName) for char ${charId} ('${passiveWisdomRaw}') is not a valid number.`, 'warn');
                    }
                } else {
                    TrapSystem.utils.log(`'passive_wisdom' (getAttrByName) not found or empty for char ${charId}.`, 'debug');
                }
            }
            
            // 3. Try Token Bar Fallback (if other methods failed or were missing)
            if (basePP === null && trapConfig && trapConfig.ppTokenBarFallback && trapConfig.ppTokenBarFallback !== "none") {
                const barKey = trapConfig.ppTokenBarFallback.endsWith('_value') 
                    ? trapConfig.ppTokenBarFallback 
                    : `${trapConfig.ppTokenBarFallback}_value`;
                const barValue = token.get(barKey);
                if (barValue !== undefined && barValue !== null && barValue !== "") {
                    const parsedBarPP = parseInt(barValue, 10);
                    if (!isNaN(parsedBarPP)) {
                        TrapSystem.utils.log(`Got PP ${parsedBarPP} from token bar '${barKey}' for char ${charId} (fallback).`, 'debug');
                        basePP = parsedBarPP;
                    } else {
                        TrapSystem.utils.log(`Value from token bar '${barKey}' for char ${charId} is not a number: '${barValue}'`, 'warn');
                    }
                } else {
                     TrapSystem.utils.log(`Token bar '${barKey}' not found or empty for char ${charId} (fallback).`, 'debug');
                }
            }

            if (basePP === null) {
                TrapSystem.utils.log(`Could not determine Passive Perception for char ${charId} after all methods.`, 'warn');
                return { finalPP: null, basePP: null, luckBonus: 0 };
            }

            // Check for luck roll properties directly on the passed trapConfig object
            if (trapConfig && trapConfig.enableLuckRoll) {
                const dieString = trapConfig.luckRollDie || '1d6'; // Use a default if not specified
                luckBonus = TrapSystem.utils.parseAndRollLuckDie(dieString);
            }
            
            const finalPP = basePP + luckBonus;
            TrapSystem.utils.log(`PP Calcs: BasePP=${basePP}, LuckBonus=${luckBonus}, FinalPP=${finalPP} for char ${charId}`, 'debug');
            return { finalPP, basePP, luckBonus };
        },

        updateAuraForDetectionRange(trapToken) {
            if (!trapToken || !TrapSystem.utils.isTrap(trapToken)) return;

            // NEW Check for global hide
            if (TrapSystem.state.detectionAurasTemporarilyHidden) {
                trapToken.set({ aura2_radius: '' });
                return;
            }

            const trapData = TrapSystem.utils.parseTrapNotes(trapToken.get("gmnotes"), trapToken, false);
            if (!trapData) {
                // If it's not a valid trap, ensure the aura is off.
                trapToken.set({ aura2_radius: '', aura2_color: '#000000' });
                return;
            }

            // AURA VISIBILITY CHECK: Only show the aura if showDetectionAura is explicitly true.
            // If it's false or undefined, hide the aura.
            if (trapData.showDetectionAura !== true) {
                trapToken.set({ aura2_radius: '' }); // Setting radius to empty string hides it.
                TrapSystem.utils.log(`Hiding detection aura for ${trapToken.id} because showDetectionAura is not explicitly true.`, 'debug');
                return;
            }
            
            // If we are here, showDetectionAura is true or undefined (defaults to true).
            // Now determine the correct color and radius based on trap state.
            const isArmedAndHasUses = trapData.isArmed && trapData.currentUses > 0;
            const isDetected = trapData.detected;
            let aura2Color = '#000000';
            let aura2Radius = '';

            if (isArmedAndHasUses) {
                aura2Color = isDetected ? TrapSystem.config.AURA_COLORS.DETECTED : TrapSystem.config.AURA_COLORS.DETECTION;
                // Calculate radius based on range
                const pageSettings = TrapSystem.utils.getPageSettings(trapToken.get('_pageid'));
                if (pageSettings.valid && trapData.passiveMaxRange > 0) {
                    const pixelsPerFoot = pageSettings.gridSize / pageSettings.scale;
                    const tokenRadiusPixels = Math.max(trapToken.get('width'), trapToken.get('height')) / 2;
                    const tokenRadiusFt = tokenRadiusPixels / pixelsPerFoot;
                    aura2Radius = Math.max(0, trapData.passiveMaxRange - tokenRadiusFt);
                }
            } else { // Disarmed or no uses
                aura2Radius = 0; // Show a visible dot to indicate state
                aura2Color = isDetected ? TrapSystem.config.AURA_COLORS.DISARMED_DETECTED : TrapSystem.config.AURA_COLORS.DISARMED_UNDETECTED;
            }
            
            // Override color if passive detection is manually toggled off for the trap
            if (trapData.passiveEnabled === false) {
                aura2Color = TrapSystem.config.AURA_COLORS.PASSIVE_DISABLED;
            }

            trapToken.set({
                aura2_color: aura2Color,
                aura2_radius: aura2Radius
            });

            TrapSystem.utils.log(`--- Detection Aura Recalculated for ${trapToken.id} ---`);
            TrapSystem.utils.log(`Desired Range from Center: ${trapData.passiveMaxRange || 0} ft`);
            TrapSystem.utils.log(`Setting Aura2 Radius to: ${aura2Radius} and Color: ${aura2Color}`);
        },

        showPassiveSetupMenu(trapToken, playerId, providedTrapData = null) {
            if (!trapToken) {
                TrapSystem.utils.chat("❌ No trap token selected for passive setup.", playerId);
                return;
            }

            const trapConfig = providedTrapData || TrapSystem.utils.parseTrapNotes(trapToken.get("gmnotes")) || {};

            const currentDC = trapConfig.passiveSpotDC || 10;
            const currentRange = trapConfig.passiveMaxRange || 0;
            const currentTokenBar = trapConfig.ppTokenBarFallback || "none";
            const currentLuckRoll = trapConfig.enableLuckRoll || false;
            const currentLuckDie = trapConfig.luckRollDie || "1d6";
            const currentShowAura = trapConfig.showDetectionAura || false;
            const isPassiveEnabled = trapConfig.passiveEnabled === false ? false : true;

            const PLAYER_MSG_TEMPLATE_NAME = TrapSystem.config.messages.templates.PLAYER_ALERT;
            const PLAYER_MSG_PREFIX = `&{template:default} {{name=${PLAYER_MSG_TEMPLATE_NAME}}} {{message=`;
            const GM_MSG_TEMPLATE_NAME = TrapSystem.config.messages.templates.GM_SPOT;
            const GM_MSG_PREFIX = `&{template:default} {{name=${GM_MSG_TEMPLATE_NAME}}} {{message=`;
            const MSG_SUFFIX = "}}";

            const defaultPlayerMsgContent = TrapSystem.config.messages.defaults.playerNotice;
            const defaultGmMsgContent = TrapSystem.config.messages.defaults.gmNotice;

            // Helper to clean internal backslashes like {placeholder\\} to {placeholder}
            const cleanInternalPlaceholderEscapes = (text) => {
                if (typeof text !== 'string') return text;
                // Regex: Looks for {content (group 1 ends before \)}, then a literal backslash, then }
                // Replaces {content\} with {content}
                return text.replace(/\\{(\w+)\\\\\\/g, '{$1}');
            };

            const extractMessageContent = (fullStoredMsg, prefix, suffix, defaultContent) => {
                let extractedContent = defaultContent; 

                if (typeof fullStoredMsg === 'string') {
                    if (fullStoredMsg.startsWith(prefix) && fullStoredMsg.endsWith(suffix)) {
                        extractedContent = fullStoredMsg.substring(prefix.length, fullStoredMsg.length - suffix.length);
                    } else { 
                        extractedContent = fullStoredMsg; 
                    }

                    const pipeIndex = extractedContent.indexOf('|');
                    if (pipeIndex !== -1) {
                        let part1 = extractedContent.substring(0, pipeIndex);
                        let part2 = extractedContent.substring(pipeIndex + 1);
                        
                        let cleanedPart1 = cleanInternalPlaceholderEscapes(part1);
                        let cleanedPart2 = cleanInternalPlaceholderEscapes(part2);

                        if (cleanedPart1 === cleanedPart2) { 
                            TrapSystem.utils.log(`[DEBUG] extractMessageContent: Duplicated content (after cleaning internal \\): "${cleanedPart1}". Using cleaned first part.`, 'debug');
                            extractedContent = cleanedPart1; 
                        } else {
                             TrapSystem.utils.log(`[DEBUG] extractMessageContent: Pipe found, but parts differ after cleaning. P1_cleaned: "${cleanedPart1}", P2_cleaned: "${cleanedPart2}". Keeping original and cleaning it: "${extractedContent}"`, 'debug');
                             extractedContent = cleanInternalPlaceholderEscapes(extractedContent);
                        }
                    } else {
                        extractedContent = cleanInternalPlaceholderEscapes(extractedContent);
                    }
                }
                return extractedContent;
            };
            
            let currentPlayerMsgContent = extractMessageContent(trapConfig.passiveNoticePlayer, PLAYER_MSG_PREFIX, MSG_SUFFIX, defaultPlayerMsgContent);
            let currentGmMsgContent = extractMessageContent(trapConfig.passiveNoticeGM, GM_MSG_PREFIX, MSG_SUFFIX, defaultGmMsgContent);
            
            const getSafeQueryDefault = (content) => {
                return content.replace(/\|/g, '##PIPE##') 
                              .replace(/\}/g, '##RBRACE##') 
                              .replace(/\{/g, '##LBRACE##') // Added for completeness
                              .replace(/\?/g, '##QMARK##') 
                              .replace(/"/g, '##DQUOTE##')  
                              .replace(/\)/g, '##RPAREN##') 
                              .replace(/\(/g, '##LPAREN##'); 
            };

            const playerMsgQueryDefault = getSafeQueryDefault(currentPlayerMsgContent);
            const gmMsgQueryDefault = getSafeQueryDefault(currentGmMsgContent);

            const sanitizeForMenuPreview = (str, maxLength = 35) => {
                if (!str) return "(Not Set)";
                let preview = str.replace(/&{template:[^}]+}/g, "").replace(/{{[^}]+}}/g, " [...] ");
                preview = preview.replace(/<[^>]+>/g, ""); 
                preview = preview.replace(/\[([^\]]*)\]\(([^)]*)\)/g, "$1"); 
                preview = preview.trim();
                if (preview.length > maxLength) preview = preview.substring(0, maxLength - 3) + "...";
                return preview.replace(/&/g, '&amp;').replace(/{/g, '&#123;').replace(/}/g, '&#125;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            };

            const playerMsgPreview = sanitizeForMenuPreview(currentPlayerMsgContent);
            const gmMsgPreview = sanitizeForMenuPreview(currentGmMsgContent);

            // Build placeholder help text
            const placeholderHelp = Object.entries(TrapSystem.config.messages.placeholders)
                .map(([key, desc]) => `- {${key}}: ${desc}`)
                .join("\n");

            const debounceTimeSeconds = (TrapSystem.config.messages.passiveNoticeDebounceTime || 100000) / 1000;

            const menu = [
                "&{template:default}",
                `{{name=🛠️ Passive Setup: ${trapToken.get('name') || 'Unnamed Trap'}}}`,
                `{{Current DC=${currentDC}}}`,
                `{{Current Range from center=${currentRange}ft (0 for none)}}`,
                `{{Detection Aura=${currentShowAura ? 'Enabled' : 'Disabled'}}}`,
                `{{PC Msg Content=${playerMsgPreview}}}`,
                `{{GM Msg Content=${gmMsgPreview}}}`,
                `{{Token Fallback=${currentTokenBar}}}`,
                `{{Luck Roll=${currentLuckRoll ? 'Enabled' : 'Disabled'}}}`,
                `{{Luck Die=${currentLuckDie}}}`,
                "{{Actions=",
                `[Set Trap DC](!trapsystem setpassive dc ${trapToken.id} ?{DC|${currentDC}})`,
                `[Set Range](!trapsystem setpassive range ${trapToken.id} ?{Range ft from Center - 0 for none|${currentRange}})`,
                `[Set PC Msg](!trapsystem setpassive playermsg ${trapToken.id} ?{Player Message with {placeholders}|${playerMsgQueryDefault}})`,
                `[Set GM Msg](!trapsystem setpassive gmmsg ${trapToken.id} ?{GM Message with {placeholders}|${gmMsgQueryDefault}})`,
                `[Toggle Luck](!trapsystem setpassive luckroll ${trapToken.id} ${!currentLuckRoll})`,
                `[Set Luck 🎲](!trapsystem setpassive luckdie ${trapToken.id} ?{Luck Die - e.g., 1d6|${currentLuckDie}})`,
                `[Toggle Detection Range Aura](!trapsystem setpassive showaura ${trapToken.id} ${!currentShowAura})`,
                `[Toggle Passive](!trapsystem setpassive toggle ${trapToken.id})`,
                `[Set TokenBar](!trapsystem setpassive tokenbar ${trapToken.id} ?{Token Bar Fallback - e.g., bar1|bar1 🟢|bar2 🔵|bar3 🔴|none})`,
                "}}",
                "{{⚠️ Notes=",
                "- For custom messages, please avoid using emojis. Your message will be wrapped in a standard alert template which may not display emojis correctly.\n",
                `- Player alerts for identical messages are debounced. If the same alert is triggered for the same character within ${debounceTimeSeconds} seconds, it will be suppressed for that player (GM alerts are not debounced), note distance placeholders will not be treated as identical messages.`, // Added debounce info
                "}}",
                `{{⚠️ Help=Available placeholders: \n ${placeholderHelp}}}`
            ];
            TrapSystem.utils.chat(menu.join(" "), playerId);
        },

        // Handle Setting Passive Property
        handleSetPassiveProperty(commandParams, playerId) {
            TrapSystem.utils.log(`[DEBUG] handleSetPassiveProperty received commandParams: ${JSON.stringify(commandParams)}`, 'debug');

            const tempUnescape = (s) => {
                if (typeof s !== 'string') return s;
                let temp = s;
                // temp = temp.replace(/(\{\w+)\\\\{2}\}/g, '$1}'); // Example of a specific placeholder unescape, if needed separately
                
                temp = temp.replace(/##PIPE##/g, "|")
                           .replace(/##RBRACE##/g, "}")
                           .replace(/##LBRACE##/g, "{") // Added for completeness
                           .replace(/##QMARK##/g, "?")
                           .replace(/##DQUOTE##/g, '"')
                           .replace(/##RPAREN##/g, ")")
                           .replace(/##LPAREN##/g, "(");
                return temp;
            };

            if (commandParams.length < 2) {
                TrapSystem.utils.chat("❌ Insufficient arguments for setpassive. Expected: property trapId [value]", playerId);
                return;
            }

            const property = commandParams[0].toLowerCase();
            const trapId = commandParams[1];
            let rawValueFromArgs = commandParams.length > 2 ? commandParams.slice(2).join(" ") : "";
            let finalValueToStore = rawValueFromArgs; // Initialize with raw args

            const trapToken = getObj("graphic", trapId);
            if (!trapToken) {
                TrapSystem.utils.chat(`❌ Trap token with ID ${trapId} not found.`, playerId);
                return;
            }

            let trapData = TrapSystem.utils.parseTrapNotes(trapToken.get("gmnotes"));
            
            // <<<< ADDED DETAILED LOGGING POINT >>>>
            if (trapData) {
                TrapSystem.utils.log(`[DEBUG] HPSP: trapData directly from parseTrapNotes: passiveNoticeGM='${trapData.passiveNoticeGM}', passiveNoticePlayer='${trapData.passiveNoticePlayer}', passiveSpotDC='${trapData.passiveSpotDC}', rawDetectionBlock='${trapData.rawDetectionBlock ? trapData.rawDetectionBlock.substring(0,100) : null}'`, 'debug');
            } else {
                TrapSystem.utils.log(`[DEBUG] HPSP: parseTrapNotes returned null. Will initialize new trapData.`, 'debug');
            }
            // <<<< END ADDED DETAILED LOGGING POINT >>>>

            if (!trapData) { // This block executes if parseTrapNotes returned null
                TrapSystem.utils.log(`No valid trap data found for ${trapId} or notes empty/malformed. Initializing new trapData for passive setup.`, 'warn');
                trapData = {
                    type: "standard", currentUses: 0, maxUses: 0, isArmed: true,
                    primaryMacro: null, options: [], successMacro: null, failureMacro: null,
                    checks: [], movementTrigger: true, autoTrigger: false, position: "intersection",
                    passiveSpotDC: null, passiveMaxRange: null, passiveNoticePlayer: null,
                    passiveNoticeGM: null, ppTokenBarFallback: null, showDetectionAura: false,
                    enableLuckRoll: false, luckRollDie: "1d6",
                    rawTriggerBlock: null, rawDetectionBlock: null
                };
            }
            
            if (property === "playermsg" || property === "gmmsg") {
                let unescapedFullRawInput = tempUnescape(rawValueFromArgs);
                TrapSystem.utils.log(`[DEBUG] HPSP: Unescaped input for ${property}: "${unescapedFullRawInput}"`, 'debug');
                finalValueToStore = unescapedFullRawInput;

                const pipeIndex = finalValueToStore.indexOf('|');
                if (pipeIndex !== -1) {
                    finalValueToStore = finalValueToStore.substring(0, pipeIndex);
                    TrapSystem.utils.log(`[DEBUG] HPSP: Truncated message at pipe. Storing: "${finalValueToStore}"`, 'debug');
                }
            }

            const propToStoreOnTrapData = property === 'dc' ? 'passiveSpotDC' :
                                          property === 'range' ? 'passiveMaxRange' :
                                          property === 'playermsg' ? 'passiveNoticePlayer' :
                                          property === 'gmmsg' ? 'passiveNoticeGM' :
                                          property === 'tokenbar' ? 'ppTokenBarFallback' :
                                          property === 'luckroll' ? 'enableLuckRoll' :
                                          property === 'luckdie' ? 'luckRollDie' :
                                          property === 'showaura' ? 'showDetectionAura' : null;
                                          property === 'passiveenabled' ? 'passiveEnabled' : null;

            let updateMade = false;

            if (property === "toggle") {
                const currentState = trapData.passiveEnabled === false ? false : true;
                trapData.passiveEnabled = !currentState;
                updateMade = true;
                TrapSystem.utils.log(`Toggled passive detection for trap ${trapId} to ${trapData.passiveEnabled ? 'on' : 'off'}.`, 'info');
            } else if (propToStoreOnTrapData) {
                let valueToSet = finalValueToStore;
                if (property === "dc") {
                    const dcVal = parseInt(valueToSet, 10);
                    if (isNaN(dcVal) || dcVal < 0) { TrapSystem.utils.chat("❌ Invalid DC value. Must be a non-negative number.", playerId); return; }
                    valueToSet = dcVal;
                    // Update token bar when DC is set
                    if (trapToken) {
                        trapToken.set({
                            bar2_value: dcVal,
                            bar2_max: dcVal,
                            showplayers_bar2: false
                        });
                    }
                } else if (property === "range") {
                    const rangeVal = parseFloat(valueToSet);
                    if (isNaN(rangeVal) || rangeVal < 0) { TrapSystem.utils.chat("❌ Invalid Range value. Must be a non-negative number.", playerId); return; }
                    valueToSet = rangeVal;
                } else if (property === "tokenbar") {
                    // Handles input like "bar1 🟢", "bar2 🔵", or "none" from the dropdown.
                    const parsedValue = String(valueToSet).split(' ')[0].trim();
                    valueToSet = (parsedValue.toLowerCase() === "none" || parsedValue === "") ? null : parsedValue;
                } else if (property === "luckroll") {
                    valueToSet = String(valueToSet).toLowerCase() === "true";
                } else if (property === "luckdie") {
                    if (!/^\d+d\d+$/i.test(valueToSet)) {
                        TrapSystem.utils.chat("❌ Invalid die format. Please use format like '1d6'.", playerId);
                        return;
                    }
                    valueToSet = String(valueToSet).trim();
                } else if (property === "showaura") {
                    valueToSet = String(valueToSet).toLowerCase() === "true";
                }
                // For playermsg and gmmsg, valueToSet is already the potentially unescaped string
                trapData[propToStoreOnTrapData] = valueToSet;
                updateMade = true;
                TrapSystem.utils.log(`Set trapData.${propToStoreOnTrapData} = ${JSON.stringify(valueToSet)} for trap ${trapId}.`, 'debug');
            } else {
                TrapSystem.utils.chat(`❌ Unknown passive property: ${property}. Use dc, range, playermsg, gmmsg, tokenbar, luckroll, luckdie, showaura, or disable.`, playerId);
                TrapSystem.passive.showPassiveSetupMenu(trapToken, playerId); // Show menu again on error
                return;
            }

            if (updateMade) {
                const newGmNotesString = TrapSystem.utils.constructGmNotesFromTrapData(trapData);
                
                try {
                    const encodedNewGmNotes = encodeURIComponent(newGmNotesString);
                    trapToken.set("gmnotes", encodedNewGmNotes);
                    TrapSystem.utils.log(`Successfully updated GM notes for trap ${trapId}. New notes (raw): '${newGmNotesString}'`, 'info');
                    // Re-parse to update visuals AND get the canonical data object for the menu refresh
                    const newlyParsedData = TrapSystem.utils.parseTrapNotes(encodedNewGmNotes, trapToken);
                    TrapSystem.passive.updateAuraForDetectionRange(trapToken);
                    TrapSystem.passive.showPassiveSetupMenu(trapToken, playerId, newlyParsedData);

                } catch (e) {
                    TrapSystem.utils.log(`Error encoding or setting GM notes for trap ${trapId}: ${e.message}`, 'error');
                    TrapSystem.utils.chat("❌ Error saving updated trap settings.", playerId);
                }
            } else {
                 // If no update was made (e.g. bad command), just show the menu with the last known data
                 TrapSystem.passive.showPassiveSetupMenu(trapToken, playerId, trapData);
            }  
        },

        // Centralized function for running a passive check for one token against one trap
        async runSinglePassiveCheck(observerToken, trapToken) {
            if (!observerToken || !trapToken) return;

            // Ensure the trap token is actually a trap before proceeding
            if (!TrapSystem.utils.isTrap(trapToken)) return;

            const trapData = TrapSystem.utils.parseTrapNotes(trapToken.get("gmnotes"), trapToken, false);

            // 1. Check if trap has passive detection enabled using the isPassive flag
            if (!trapData || !trapData.isPassive || trapData.passiveEnabled === false) {
                return; // No passive detection configured for this trap.
            }

            // Use character ID if available, otherwise use the token ID as the unique identifier for noticing.
            const observerId = observerToken.get('represents') || observerToken.id;

            // 2. Check if observer has already noticed this trap
            const alreadyNoticed = TrapSystem.state.passivelyNoticedTraps[trapToken.id] && TrapSystem.state.passivelyNoticedTraps[trapToken.id][observerId];
            if (alreadyNoticed) {
                if (TrapSystem.config.DEBUG) TrapSystem.utils.log(`Passive Notice SKIPPED for trap ${trapToken.id}: Observer ${observerId} has already noticed it.`, 'debug');
                return; // Already spotted this one.
            }

            // 3. Check for Line of Sight
            const hasLOS = TrapSystem.utils.hasLineOfSight(observerToken, trapToken);
            if (!hasLOS) {
                if (TrapSystem.config.DEBUG) TrapSystem.utils.log(`Passive detection of trap ${trapToken.id} by ${observerToken.id} failed: No Line of Sight.`, 'debug');
                return;
            }
            
            if (TrapSystem.config.DEBUG) TrapSystem.utils.log(`Passive detection check for trap ${trapToken.id} by ${observerToken.id}: Has Line of Sight.`, 'debug');
            
            // 4. Check distance vs max range
            const { mapUnitDistance } = TrapSystem.utils.calculateTokenDistance(observerToken, trapToken);
            if (trapData.passiveMaxRange && mapUnitDistance > trapData.passiveMaxRange) {
                if (TrapSystem.config.DEBUG) TrapSystem.utils.log(`Passive detection of trap ${trapToken.id} by ${observerToken.id} failed: Out of max range (${mapUnitDistance.toFixed(1)}ft > ${trapData.passiveMaxRange}ft).`, 'debug');
                return;
            }

            // 5. Perform perception check, passing the correct trapData object
            const perceptionResult = await TrapSystem.passive.getCharacterPassivePerception(observerToken, trapData);
            if (perceptionResult.finalPP !== null && perceptionResult.finalPP >= trapData.passiveSpotDC) {
                TrapSystem.passive.handlePassiveNotice(observerToken, trapToken, perceptionResult, trapData, mapUnitDistance);
            }
        },

        // Add this to the 'passive' object
        async runPassiveChecksForToken(observerToken) {
            if (!observerToken) return;
        
            const pageId = observerToken.get('_pageid');
            const trapTokens = findObjs({ _type: "graphic", _pageid: pageId }).filter(t => TrapSystem.utils.isTrap(t));
        
            if (trapTokens.length === 0) {
                return; // No traps on the page to check against.
            }
            
            if (TrapSystem.config.DEBUG) TrapSystem.utils.log(`[DEBUG] Running passive checks for moving token '${observerToken.get('name')}' against ${trapTokens.length} traps.`, 'debug');
        
            const checkPromises = trapTokens.map(trap => {
                return this.runSinglePassiveCheck(observerToken, trap);
            });
            await Promise.all(checkPromises);
        },

        // Runs a passive check for all player tokens against all traps on a given page.
        runPageWidePassiveChecks(pageId) {
            if (!pageId) return;
            TrapSystem.utils.log(`Running page-wide passive checks for page ${pageId}.`, 'info');

            // Find all tokens on the page that represent a character
            const allTokensOnPage = findObjs({ _type: 'graphic', _pageid: pageId, layer: 'objects' });
            const playerTokens = allTokensOnPage.filter(t => t.get('represents'));

            // Find all traps on the page
            const trapTokens = allTokensOnPage.filter(t => TrapSystem.utils.isTrap(t));

            if (playerTokens.length > 0 && trapTokens.length > 0) {
                TrapSystem.utils.log(`Found ${playerTokens.length} player tokens and ${trapTokens.length} traps. Checking LOS for all pairs.`, 'debug');
                // For each token, check against each trap
                playerTokens.forEach(pToken => {
                    trapTokens.forEach(tToken => {
                        // Fire-and-forget the async check for each pair. This runs the check without
                        // blocking the main thread, important when looping through many tokens/traps.
                        TrapSystem.passive.runSinglePassiveCheck(pToken, tToken);
                    });
                });
            }
        }
    },
    
    commands: {
        handleResetDetection(selectedToken, playerId) { // Modified signature
            TrapSystem.utils.log('`handleResetDetection` called.', 'debug');
            let message = '';

            if (selectedToken && TrapSystem.utils.isTrap(selectedToken)) {
                const trapId = selectedToken.id;
                const trapName = selectedToken.get("name") || `Trap ID ${trapId}`;
                if (TrapSystem.state.passivelyNoticedTraps && TrapSystem.state.passivelyNoticedTraps[trapId]) {
                    // Also remove the persistent 'detected' flag from notes
                    let notes = selectedToken.get("gmnotes");
                    let decodedNotes = "";
                    try { decodedNotes = decodeURIComponent(notes); } catch (e) { decodedNotes = notes; }
                    
                    if (decodedNotes.includes("detected:[on]")) {
                        const updatedNotes = decodedNotes.replace(/\s*detected:\s*\[on\]/, '');
                        selectedToken.set("gmnotes", encodeURIComponent(updatedNotes));
                        TrapSystem.utils.parseTrapNotes(updatedNotes, selectedToken);
                    }
                    TrapSystem.utils.log(`Passively noticed state for trap ID '${trapId}' has been cleared.`, 'info');
                    message = `✅ Passive detection state for selected trap '${trapName}' has been reset.`;
                } else {
                    TrapSystem.utils.log(`No passively noticed state found for specific trap ID '${trapId}' to clear.`, 'info');
                    message = `ℹ️ No passive detection state to reset for selected trap '${trapName}'.`;
                }
            } else {
                // Clear the entire passively noticed traps state if no specific trap token is selected or if selected is not a trap
                if (Object.keys(TrapSystem.state.passivelyNoticedTraps).length > 0) {
                    // Find all traps and reset their auras if they were previously detected
                    const allTraps = findObjs({ _type: "graphic" }).filter(t => TrapSystem.utils.isTrap(t));
                    allTraps.forEach(trapToken => {
                        // Remove persistent flags from all traps
                        let notes = trapToken.get("gmnotes");
                        let decodedNotes = "";
                        try { decodedNotes = decodeURIComponent(notes); } catch (e) { decodedNotes = notes; }
                        
                        if (decodedNotes.includes("detected:[on]")) {
                            const updatedNotes = decodedNotes.replace(/\s*detected:\s*\[on\]/, '');
                            trapToken.set("gmnotes", encodeURIComponent(updatedNotes));
                            TrapSystem.utils.parseTrapNotes(updatedNotes, trapToken);
                        }
                    });
                    
                    TrapSystem.state.passivelyNoticedTraps = {};
                    TrapSystem.utils.log('`TrapSystem.state.passivelyNoticedTraps` (all) has been cleared.', 'info');
                    message = '✅ All passive detection states have been reset. Characters will need to re-detect all traps.';
                } else {
                    TrapSystem.utils.log('`TrapSystem.state.passivelyNoticedTraps` (all) was already empty.', 'info');
                    message = 'ℹ️ No passive detection states were active to reset.';
                }
            }

            // Notify the GM
            if (playerId) {
                TrapSystem.utils.whisper(playerId, message);
            } else {
                TrapSystem.utils.chat(message); // Fallback to public chat if no playerID
            }
        },
        
        hideAllAuras(durationMinutes, playerId) {
            if (TrapSystem.state.hideAurasTimeout) {
                clearTimeout(TrapSystem.state.hideAurasTimeout);
                TrapSystem.state.hideAurasTimeout = null;
            }

            TrapSystem.state.detectionAurasTemporarilyHidden = true;

            const allTraps = findObjs({ _type: "graphic" }).filter(t => TrapSystem.utils.isTrap(t));
            allTraps.forEach(trapToken => {
                TrapSystem.passive.updateAuraForDetectionRange(trapToken);
            });

            let message = "👁️ All detection auras are now hidden.";
            
            const durationMs = parseFloat(durationMinutes) * 60 * 1000;
            if (!isNaN(durationMs) && durationMs > 0) {
                TrapSystem.state.hideAurasTimeout = setTimeout(() => {
                    this.showAllAuras(playerId, true);
                }, durationMs);
                message += ` They will automatically reappear in ${durationMinutes} minute(s).`;
            }

            TrapSystem.utils.whisper(playerId, message);
        },

        showAllAuras(playerId, isAuto = false) {
            if (TrapSystem.state.hideAurasTimeout) {
                clearTimeout(TrapSystem.state.hideAurasTimeout);
                TrapSystem.state.hideAurasTimeout = null;
            }

            TrapSystem.state.detectionAurasTemporarilyHidden = false;

            const allTraps = findObjs({ _type: "graphic" }).filter(t => TrapSystem.utils.isTrap(t));
            allTraps.forEach(trapToken => {
                TrapSystem.passive.updateAuraForDetectionRange(trapToken);
            });
            
            const message = isAuto 
                ? "⏰ Timer expired. All detection auras have been restored."
                : "👁️ All detection auras are now restored.";

            TrapSystem.utils.whisper(playerId, message);
        }
    }
};

// ---------------------------------------------------
// 7) ON READY
// ---------------------------------------------------
on("ready", () => {
    TrapSystem.utils.log("Trap System + Interaction Menu v1.0.0 Ready!", 'success');
    if (typeof CommandMenu !== 'undefined' && CommandMenu.utils && CommandMenu.utils.addInitStatus) {
        CommandMenu.utils.addInitStatus('TrapSystem', 'success', null, 'success');
    }
});

// ---------------------------------------------------
// 8) TOKEN MOVEMENT, NOTES, AND LOCKING HOOK
// ---------------------------------------------------
on("change:graphic", async (obj, prev) => {
    if (!obj || !prev) return;
    try {
        // --- 1. Token Locking Logic --- Approved!
        // If a token is locked, prevent it from being moved. This must be the first check.
        if (TrapSystem.state.lockedTokens[obj.id] && (obj.get("left") !== prev.left || obj.get("top") !== prev.top)) {
            obj.set({ left: prev.left, top: prev.top });
            return; // Stop further processing for this locked token's movement event.
        }

        // --- 2. Movement Trigger Logic --- Approved!
        // For any token that is not a trap itself, check if its movement triggers a trap.
        if ((obj.get("left") !== prev.left || obj.get("top") !== prev.top) && !TrapSystem.utils.isTrap(obj)) {
            await TrapSystem.passive.runPassiveChecksForToken(obj);
            TrapSystem.detector.checkTrapTrigger(obj, prev.left, prev.top);
        }

        // --- 3. Ignore Traps (Blue Marker) Status Change ---
        if (obj.get("statusmarkers") !== prev.statusmarkers) {
            const curMarkers = obj.get("statusmarkers") || "";
            const prevMarkers = prev.statusmarkers || "";
            if (prevMarkers.includes("blue") && !curMarkers.includes("blue")) {
                let notes = obj.get("gmnotes") || "";
                if (notes.includes("{ignoretraps}")) {
                    obj.set("gmnotes", notes.replace(/\{ignoretraps\}/g, ''));
                    TrapSystem.utils.chat(`Removed ignoretraps tag from ${obj.get("name")||"token"} (blue marker removed)`);
                }
            }
        }

        // --- 4. Trap Token's Own Changes (GM Notes, Movement, Resizing) ---
        const currentNotesRaw = obj.get("gmnotes") || "";
        const prevNotesRaw = prev.gmnotes || "";

        // Decode both notes to normalize them before comparison.
        // This prevents the event from firing if the only change was in URL encoding.
        let currentNotes, prevNotes;
        try { currentNotes = decodeURIComponent(currentNotesRaw); } catch(e) { currentNotes = currentNotesRaw; }
        try { prevNotes = decodeURIComponent(prevNotesRaw); } catch(e) { prevNotes = prevNotesRaw; }

        // Only re-parse if the gmnotes property was actually part of the change event AND the content is different.
        const notesHaveChanged = prev.hasOwnProperty('gmnotes') && currentNotes !== prevNotes;

        const isCurrentlyTrap = currentNotes.includes("!traptrigger");
        const wasPreviouslyTrap = prevNotes ? prevNotes.includes("!traptrigger") : false;

        // 4a. GM Notes were changed.
        if (notesHaveChanged) {
            if (wasPreviouslyTrap && !isCurrentlyTrap) {
                // If it WAS a trap but ISN'T anymore (e.g., notes cleared), clean up visuals.
                TrapSystem.utils.log(`Trap config removed from ${obj.id}. Clearing visuals.`, 'info');
                obj.set({
                    bar1_value: null, bar1_max: null, showplayers_bar1: false,
                    aura1_color: "transparent", aura1_radius: "", showplayers_aura1: false,
                    bar2_value: null, bar2_max: null, showplayers_bar2: false,
                    aura2_color: "transparent", aura2_radius: "", showplayers_aura2: false
                });
            } else if (isCurrentlyTrap) {
                // If it IS a trap (either new or modified), parse its notes to set the correct visuals.
                // We pass the RAW notes to parseTrapNotes, as it has its own decoding logic.
                TrapSystem.utils.parseTrapNotes(currentNotesRaw, obj);
                TrapSystem.passive.updateAuraForDetectionRange(obj); // Recalculate aura on notes change
            }
        }
        
        // 4b. The trap token itself was moved, resized, or rotated.
        if (isCurrentlyTrap) {
            const sizeChanged = obj.get("width") !== prev.width || obj.get("height") !== prev.height;
            const positionOrRotationChanged = obj.get("left") !== prev.left || obj.get("top") !== prev.top || obj.get("rotation") !== prev.rotation;

            if (sizeChanged) {
                // If trap was resized, its aura might need to be recalculated.
                obj.set({ aura1_radius: TrapSystem.utils.calculateDynamicAuraRadius(obj) });
                TrapSystem.passive.updateAuraForDetectionRange(obj); // Recalculate detection aura on resize
            }

            if ((sizeChanged || positionOrRotationChanged) && Object.values(TrapSystem.state.lockedTokens).some(lock => lock.trapToken === obj.id)) {
                // If trap moved/resized and has tokens locked to it, update their positions.
                for (const lockedTokenId in TrapSystem.state.lockedTokens) {
                    const lockData = TrapSystem.state.lockedTokens[lockedTokenId];
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
        TrapSystem.utils.log(`Error in the main on("change:graphic") handler: ${err.message}`, 'error');
    }
});

// ---------------------------------------------------
// 9) CHAT COMMANDS
// ---------------------------------------------------
on("chat:message",(msg) => {
    // Rolls from character sheets
    if(msg.type==="advancedroll") {
        try {
            TrapSystem.utils.log(`Received advancedroll message: ${JSON.stringify(msg)}`, 'debug');
            let rollType = null;
            if(msg.content.includes("dnd-2024__header--Advantage")) rollType="advantage";
            if(msg.content.includes("dnd-2024__header--Disadvantage")) rollType="disadvantage";
            if(msg.content.includes("dnd-2024__header--Normal")) rollType="normal";

            const re = /die__total[^>]*(?:data-result="(\d+)")?[^>]*>\s*(\d+)\s*</g;
            let dieMatches = msg.content.match(re);
            let dieResults = [];
            if(dieMatches) {
                dieMatches.forEach(m => {
                    let dr = m.match(/data-result="(\d+)"/);
                    let tr = m.match(/>\s*(\d+)\s*</);
                    if(dr) dieResults.push(parseInt(dr[1],10));
                    else if(tr) dieResults.push(parseInt(tr[1],10));
                });
            }
            if(dieResults.length>0) {
                // Try to find pending check by character ID first
                let pending = null;
                if (msg.characterId) { // Corrected: was msg.characterId in original FX version
                    pending = TrapSystem.state.pendingChecksByChar[msg.characterId];
                    if (pending) {
                        TrapSystem.utils.log(`Found pending check by character ID: ${msg.characterId}`, 'debug');
                    }
                }
                
                // If not found by character ID, try player ID
                if (!pending) {
                    pending = TrapSystem.state.pendingChecks[msg.playerid];
                    if (pending) {
                        TrapSystem.utils.log(`Found pending check by player ID: ${msg.playerid}`, 'debug');
                    }
                }

                if (!pending) {
                    TrapSystem.utils.log(`No pending check found for player:${msg.playerid} or character:${msg.characterId} from advancedroll`, 'debug');
                    return;
                }

                let total;
                const pref= msg.content.match(/die__total--preferred[^>]*data-result="(\d+)"/);
                if(pref) {
                    total = parseInt(pref[1],10);
                } else if(dieResults.length >= 2 && rollType) {
                    if(rollType==="advantage") total = Math.max(...dieResults);
                    else if(rollType==="disadvantage") total = Math.min(...dieResults);
                    else total = dieResults[0];
                } else {
                    total = dieResults[0];
                }

                // Extract rolled skill/ability/save from header
                let rolledSkillName = null;
                const titleMatch = msg.content.match(/<div class=\"header__title\">([^<]+)(?: Check| Save)?<\/div>/);
                if (titleMatch && titleMatch[1]) {
                    rolledSkillName = titleMatch[1].trim();
                    TrapSystem.utils.log(`Extracted rolled skill/ability from advancedroll: ${rolledSkillName}`, 'debug');
                }

                const rollData = {
                    total,
                    firstRoll: dieResults[0],
                    secondRoll: dieResults[1],
                    isAdvantageRoll: (dieResults.length >= 2),
                    rollType,
                    characterid: msg.characterId, // Ensure this is passed
                    playerid: msg.playerid,
                    rolledSkillName // <-- new field
                };
                TrapSystem.utils.log(`Processed advancedroll data: ${JSON.stringify(rollData)}`, 'debug');
                TrapSystem.interaction.handleRollResult(rollData, msg.playerid);
            }
        } catch(e) {
            TrapSystem.utils.log(`Error in advancedroll parse: ${e.message}`, 'error'); // Added .message
        }
        return;
    }
    if(msg.type==="rollresult") {
        try {
            TrapSystem.utils.log(`Received rollresult message: ${JSON.stringify(msg)}`, 'debug');
            const r = JSON.parse(msg.content);
            let rollTotal = null;

            if (r && typeof r.total !== 'undefined') {
                rollTotal = r.total;
            } else if (r && r.rolls && r.rolls.length > 0 && r.rolls[0].results && r.rolls[0].results.length > 0 && typeof r.rolls[0].results[0].v !== 'undefined') {
                rollTotal = r.rolls[0].results[0].v;
            }

            if (rollTotal !== null) {
                const rollData = {
                    total: rollTotal,
                    playerid: msg.playerid // This is playerid_of_roller
                    // characterid will be determined next
                };

                let charIdFromRoll = r.characterid || (r.rolls && r.rolls[0] && r.rolls[0].characterid);

                if (!charIdFromRoll && !TrapSystem.utils.playerIsGM(msg.playerid)) { 
                    const allCharacters = findObjs({ _type: "character" });
                    const controlledPlayerCharacters = allCharacters.filter(char => {
                        const controlledByArray = (char.get("controlledby") || "").split(",");
                        return controlledByArray.includes(msg.playerid) && controlledByArray.some(pId => pId && pId.trim() !== "" && !TrapSystem.utils.playerIsGM(pId));
                    });

                    if (controlledPlayerCharacters.length === 1) {
                        const uniqueChar = controlledPlayerCharacters[0];
                        rollData.characterid = uniqueChar.id; // Add characterid if uniquely determined
                        TrapSystem.utils.log(`Flat roll by player ${msg.playerid} auto-associated with single controlled character ${uniqueChar.get('name')} (ID: ${uniqueChar.id}) for rollData.`, 'debug');
                        // DO NOT modify pendingChecks here; handleRollResult will do the matching.
                    } else if (controlledPlayerCharacters.length > 1) {
                        TrapSystem.utils.log(`Flat roll by player ${msg.playerid} who controls multiple characters. rollData will not have characterid.`, 'debug');
                    } else {
                         TrapSystem.utils.log(`Flat roll by player ${msg.playerid} who controls no uniquely assignable characters for this roll. rollData will not have characterid.`, 'debug');
                    }
                } else if (charIdFromRoll) {
                    rollData.characterid = charIdFromRoll;
                }

                TrapSystem.utils.log(`Processed rollresult. Sending to handleRollResult: ${JSON.stringify(rollData)}`, 'debug');
                TrapSystem.interaction.handleRollResult(rollData, msg.playerid); // msg.playerid is playerid_of_roller
            } else {
                TrapSystem.utils.log(`Could not parse total from rollresult: ${msg.content}`, 'warning');
            }
        } catch(e) {
            TrapSystem.utils.log(`Error in rollresult parse: ${e.message}`, 'error'); // Added .message
        }
        return;
    }
    // If not an API command, ignore
    if(msg.type!=="api") return;

    // [NEW] Listen for token ordering if recording is active
    if (TrapSystem.state.macroExportRecordOrdering && msg.content.startsWith("!token-mod")) {
        TrapSystem.macroExporter.processOrderCommand(msg.content);
        // Note: We don't return here, as it might be a TokenMod command *within* an exported macro,
        // or the user might issue other TrapSystem commands.
        // The processOrderCommand just passively records.
    }

    // New, more robust command parsing
    const args = (msg.content.match(/[^\s"]+|"([^"]*)"/g) || []).map(arg => 
        (arg.startsWith('"') && arg.endsWith('"')) ? arg.slice(1, -1) : arg
    );
    const command = args[0];

    if(command === "!trapsystem") {
        TrapSystem.utils.log(`[API Handler] Received !trapsystem command. Action: ${args[1] || 'help'}. Full args: ${JSON.stringify(args)}`, 'debug');
        if(!args[1]) {
            TrapSystem.utils.showHelpMenu("API");
            return;
        }

        const action = args[1];
        const selectedToken = msg.selected ? getObj("graphic", msg.selected[0]._id) : null;

        // Whitelist 'interact' as it gets the trap token ID from arguments.
        // Sub-actions within 'interact' will handle specific token needs (e.g., a triggering character for a skill check).
        if (!selectedToken && !["enable", "disable", "toggle", "status", "help", "allowall", "exportmacros", "resetstates", "resetmacros", "fullreset", "allowmovement", "resetdetection", "interact", "hidedetection", "showdetection"].includes(action.toLowerCase())) {
            TrapSystem.utils.chat('❌ Error: No token selected for this action!');
            TrapSystem.utils.log(`[API Handler] Action '${action}' requires a selected token, but none was found.`, 'warn');
                return;
        }

        switch (action) {
            case "setup":
                TrapSystem.utils.log(`[API Handler] Attempting to call setupTrap. Token ID: ${selectedToken ? selectedToken.id : 'null'}. Args for func: ${args.slice(2).join(', ')}`, 'debug');
                try {
                TrapSystem.triggers.setupTrap(
                    selectedToken,
                    args[2], // uses
                    args[3], // mainMacro
                    args[4], // optional2
                    args[5], // optional3
                        args[6], // movement
                        args[7]  // autoTrigger
                );
                } catch (e) {
                    TrapSystem.utils.log(`[API Handler] ERROR calling setupTrap: ${e.message} ${e.stack}`, 'error');
                    TrapSystem.utils.chat('❌ An internal error occurred while trying to setup the standard trap.');
                }
                break;
            case "setupinteraction": {
                TrapSystem.utils.log(`[API Handler] Attempting to call setupInteractionTrap. Token ID: ${selectedToken ? selectedToken.id : 'null'}. Raw args for parsing: ${args.slice(2).join(', ')}`, 'debug');
                try {
                     // Check a minimum length. The exact number is tricky due to multi-word skills. Let's say at least 8.
                     if (args.length < 8) { // e.g., !trapsystem setupinteraction 1 macro macro macro None 10 true true
                        TrapSystem.utils.chat('❌ Error: Missing parameters for interaction trap setup.');
                        return;
                    }
                    const uses = args[2];
                    const primaryMacro = args[3];
                    const successMacro = args[4];
                    const failureMacro = args[5];

                    const autoTriggerEnabled = args[args.length - 1];
                    const movement = args[args.length - 2];
                    const movementTriggerEnabled = args[args.length - 3];
                    
                    // All args between the macros and the final two flags are for the checks.
                    const checkArgs = args.slice(6, args.length - 3);

                    const checks = [];
                    let currentSkillParts = [];
                    
                    for(const arg of checkArgs) {
                        // If the argument is a number, it's a DC. This concludes the current skill check.
                        if (!isNaN(parseInt(arg))) {
                            if (currentSkillParts.length > 0) {
                                const skillName = currentSkillParts.join(' ');
                                // Only add the check if the name isn't "None"
                                if (skillName.toLowerCase() !== 'none') {
                                    checks.push({ type: skillName, dc: arg });
                                }
                                // Reset for the next check
                                currentSkillParts = [];
                            }
                        } else { // If it's not a number, it's part of the skill's name.
                            currentSkillParts.push(arg);
                        }
                    }

                    const check1Type = checks[0] ? checks[0].type : "None";
                    const check1DC = checks[0] ? checks[0].dc : "10";
                    const check2Type = checks[1] ? checks[1].type : "None";
                    const check2DC = checks[1] ? checks[1].dc : "10";

                    TrapSystem.utils.log(`[API Handler] Parsed for setupInteractionTrap - Uses: ${uses}, PrimaryM: ${primaryMacro}, SuccessM: ${successMacro}, FailM: ${failureMacro}, C1Type: '${check1Type}', C1DC: ${check1DC}, C2Type: '${check2Type}', C2DC: ${check2DC}, MoveEnabled: ${movementTriggerEnabled}, AutoTrigger: ${autoTriggerEnabled}`, 'debug');

                    TrapSystem.triggers.setupInteractionTrap(
                        selectedToken,uses,
                        primaryMacro, successMacro, failureMacro,
                        check1Type, check1DC,
                        check2Type, check2DC,
                        movementTriggerEnabled,
                        movement,autoTriggerEnabled
                    );
                } catch (e) {
                    TrapSystem.utils.log(`[API Handler] ERROR in setupInteractionTrap case: ${e.message} ${e.stack}`, 'error');
                    TrapSystem.utils.chat('❌ An internal error occurred while trying to setup the interaction trap.');
                }
                } break;
            case "toggle": {
                const tid = args[2] || (selectedToken && selectedToken.id);
                if(!tid) {
                    TrapSystem.utils.chat('❌ No token selected or provided to toggle');
                    return;
                }
                const tk = getObj("graphic", tid);
                TrapSystem.triggers.toggleTrap(tk);
                } break;
            case "status": {
                const tid = args[2] || (selectedToken && selectedToken.id);
                if(!tid) {
                    TrapSystem.utils.chat('❌ No token selected or provided for status');
                    return;
                }
                const tk = getObj("graphic", tid);
                TrapSystem.triggers.getTrapStatus(tk);
                } break;
            case "allowmovement":
                const movementTokenId = args[2] && args[2].trim();
                if (movementTokenId === 'selected') {
                    if (!msg.selected || !msg.selected[0]) {
                        TrapSystem.utils.chat("❌ Error: No token selected!");
                        return;
                    }
                    TrapSystem.triggers.allowMovement(msg.selected[0]._id);
                } else if (movementTokenId) {
                    TrapSystem.triggers.allowMovement(movementTokenId);
                } else {
                    TrapSystem.utils.chat("❌ Error: No token specified!");
                }
                break;
            case "marktriggered": {
                // The incoming command is split by spaces.
                // e.g. !trapsystem marktriggered TOKENID TRAPID Text Here
                // We need to grab the token ID (arg 2), trap ID (arg 3),
                // and then join everything after that to reassemble the macro name.
                const parts = msg.content.split(' ');
                if (parts.length < 5) {
                    TrapSystem.utils.chat('❌ marktriggered: Missing tokenId, trapId, or identifier!');
                    break;
                }
                const tokenId = parts[2];
                const trapId = parts[3];
                const macroIdentifier = parts.slice(4).join(' '); // e.g., "primary" or "option 0"
                TrapSystem.triggers.markTriggered(tokenId, trapId, macroIdentifier);
                break;
            }
            case "enable":
                TrapSystem.triggers.enableTriggers();
                break;
            case "disable":
                TrapSystem.triggers.disableTriggers();
                break;
            case "trigger":
                if(!selectedToken) {
                    TrapSystem.utils.chat('❌ No token selected for trigger');
                    return;
                }
                TrapSystem.triggers.manualTrigger(selectedToken);
                break;
            case "ignoretraps":
                if(!selectedToken) {
                    TrapSystem.utils.chat('❌ No token selected for ignoretraps');
                    return;
                }
                TrapSystem.utils.toggleIgnoreTraps(selectedToken);
                break;
            case "showmenu":
                if(!selectedToken) {
                    TrapSystem.utils.chat('❌ No token selected for showmenu');
                    return;
                }
                TrapSystem.menu.showInteractionMenu(selectedToken);
                break;
            case "interact":
                if(args.length < 4) {
                    TrapSystem.utils.chat("❌ Missing parameters for interact");
                    return;
                }
                {
                    const intToken = getObj("graphic", args[2]);
                    if(!intToken) {
                        TrapSystem.utils.chat("❌ Invalid trap token ID!");
                        return;
                    }
                    // This is the fix: passing args[4]
                    TrapSystem.menu.handleInteraction(intToken, args[3], msg.playerid, args[4]);
                }
                break;
            case "allow":
                if(args.length < 4) {
                    TrapSystem.utils.chat("❌ Missing parameters for allow command!");
                    return;
                }
                {
                    const allowToken = getObj("graphic", args[2]);
                    if(!allowToken) {
                        TrapSystem.utils.chat("❌ Invalid trap token ID!");
                        return;
                    }
                    // This is the fix: passing args[3] as the playerid, and args[4] as the triggeredTokenId
                    TrapSystem.menu.handleAllowAction(allowToken, args[3], args[4]);
                }
                break;
            case "selectcharacter":
                if (args.length < 5) {
                    TrapSystem.utils.chat("❌ Missing parameters for selectcharacter!");
                    return;
                }
                {
                    const trapToken = getObj("graphic", args[2]);
                    const character = getObj("character", args[3]);
                    const playerid = args[4];
                    const triggeredTokenId = args[5] || null; // Correctedly reads the ID

                    if (!trapToken || !character) {
                        TrapSystem.utils.chat("❌ Invalid token or character ID!");
                        return;
                    }
                    
                    if (!TrapSystem.state.pendingChecks[playerid]) {
                                TrapSystem.state.pendingChecks[playerid] = {};
                            }
                    TrapSystem.state.pendingChecks[playerid].characterId = character.id;
                    TrapSystem.state.pendingChecks[playerid].characterName = character.get("name");
                            TrapSystem.state.pendingChecks[playerid].triggeredTokenId = triggeredTokenId;
                            
                    if (TrapSystem.state.pendingChecksByChar && character.id) {
                        TrapSystem.state.pendingChecksByChar[character.id] = {
                                    ...TrapSystem.state.pendingChecks[playerid],
                            token: trapToken
                        };
                    }

                    TrapSystem.utils.log(`Stored character info - ID:${character.id}, Name:${character.get("name")}, Victim:${triggeredTokenId}`, 'debug');
                    
                    // Correctly passes the ID to the menu function
                    TrapSystem.menu.showGMResponseMenu(trapToken, playerid, triggeredTokenId);
                }
                break;
            case "check":
                if (args.length < 5) {
                    TrapSystem.utils.chat("❌ Missing parameters for check command!");
                    return;
                }
                {
                    const cToken = getObj("graphic", args[2]);
                    if (!cToken) {
                        TrapSystem.utils.chat("❌ Invalid trap token ID!");
                        return;
                    }
                    let playerid = args[4];
                    if (playerid === 'null' || !playerid) {
                        playerid = msg.playerid;
                        TrapSystem.utils.log(`[FIX] 'check' command playerid was invalid, using msg.playerid: ${playerid}`, 'debug');
                    }
                    const triggeredTokenId = args.length > 5 ? args[5] : null;
                    TrapSystem.menu.handleSkillCheck(cToken, parseInt(args[3], 10), playerid, false, false, 'gm', triggeredTokenId);
                }
                break;
            case "customcheck":
                if (args.length < 7) { // e.g., !trapsystem customcheck TRAPID PLAYERID TOKENID Skill Name 10
                    TrapSystem.utils.chat("❌ Missing parameters for customcheck command! Requires at least skill and DC.");
                return;
            }
                {
                    const cToken = getObj("graphic", args[2]);
                    if (!cToken) {
                        TrapSystem.utils.chat("❌ Invalid trap token ID for customcheck!");
                        return;
                    }
                    const playerid = args[3];
                    const triggeredTokenId = args[4] !== 'null' ? args[4] : null;

                    // The last argument is always the DC.
                    const dc = args[args.length - 1];
                    // Everything between arg 4 and the last arg is the skill name.
                    const skillType = args.slice(5, args.length - 1).join(' ');

                    TrapSystem.menu.handleCustomCheck(cToken, playerid, triggeredTokenId, skillType, dc);
                }
                break;
            case "rollcheck":
                if (args.length < 6) { // !trapsystem rollcheck trapId index advantage playerid
                    TrapSystem.utils.chat("❌ Missing parameters for rollcheck!");
                    return;
                }
                {
                    const rToken = getObj("graphic", args[2]);
                    if (!rToken) {
                        TrapSystem.utils.chat("❌ Invalid trap token ID!");
                        return;
                    }
                    const checkIndex = args[3];
                    const advantage = args[4];
                    let playerid = args[5];
                    const triggeredTokenId = args.length > 6 ? args[6] : null;

                    // FIX: If playerid from command is 'null', use the sender's ID (the GM).
                    if (playerid === 'null' || !playerid) {
                        playerid = msg.playerid;
                        TrapSystem.utils.log(`[FIX] rollcheck playerid was invalid, using msg.playerid: ${playerid}`, 'debug');
                    }
                    
                    // The command does not pass a modifier. It's always 0.
                    TrapSystem.menu.handleRollCheck(rToken, checkIndex, advantage, playerid, 0, triggeredTokenId);
                }
                break;
            case "setdc":
                if(args.length < 5) {
                    TrapSystem.utils.chat("❌ Missing parameters for setdc command!");
                    return;
                }
                {
                    const dToken = getObj("graphic", args[2]);
                    if(!dToken) {
                        TrapSystem.utils.chat("❌ Invalid trap token ID!");
                        return;
                    }
                    // Pass triggeredTokenId from args[6]
                    TrapSystem.menu.handleSetDC(dToken, args[3], args[4], args[5], args[6] || null);
                }
                break;
            case "help": {
                TrapSystem.utils.showHelpMenu("TrapSystem");
                } 
                break;
            case "fail":
                if (args.length < 4) {
                    TrapSystem.utils.chat("❌ Error: Missing parameters for fail command!");
                    return;
                }
                {
                    const failToken = getObj("graphic", args[2]);
                    if (!failToken) {
                        TrapSystem.utils.chat("❌ Error: Invalid trap token ID!");
                        return;
                    }
                    // This is the fix: passing args[3] and args[4]
                    TrapSystem.menu.handleFailAction(failToken, args[3], args[4]);
                }
                break;
            case "manualtrigger": {
                const parts = msg.content.split(' ');
                if (parts.length < 4) {
                    TrapSystem.utils.chat("❌ Missing parameters for manualtrigger!");
                    return;
                }
                const trapId = parts[2];
                const macroIdentifier = parts.slice(3).join(' '); // e.g., "primary" or "option 0"
                TrapSystem.triggers.manualMacroTrigger(trapId, macroIdentifier);
                break;
            }
            case "displaydc":
                // args: !trapsystem displaydc trapToken.id checkIndex playerid
                if (args.length < 5) {
                    TrapSystem.utils.chat("❌ Missing parameters for displaydc!");
                    return;
                }
                {
                    const dToken = getObj("graphic", args[2]);
                    if(!dToken) {
                        TrapSystem.utils.chat("❌ Invalid trap token ID for displaydc!");
                        return;
                    }
                    // Call the dedicated handler
                    TrapSystem.menu.handleDisplayDC(dToken, args[3], args[4]);
                }
                break;
            case "allowall":
                TrapSystem.triggers.allowAllMovement();
                break;
            case "resolvemismatch": {
                // Usage: !trapsystem resolvemismatch [entityId] [trapTokenId] [accept|reject] [rollValueIfAccepted] [rollType] [isAdvantageRoll]
                const entityId = args[2]; // characterId or playerid
                const trapTokenId = args[3];
                const action = args[4];
                const rollValue = args[5] ? parseInt(args[5], 10) : null;
                const rollType = args[6] || 'normal';
                const isAdvantageRoll = args[7] === '1';
                let pendingCheck = TrapSystem.state.pendingChecksByChar[entityId] || TrapSystem.state.pendingChecks[entityId];
                const trapToken = getObj("graphic", trapTokenId);
                if (!pendingCheck || !trapToken) {
                    TrapSystem.utils.chat('❌ Could not resolve mismatch: missing pending check or trap token.');
                    return;
                }
                if (action === 'accept') {
                    // Process the roll as normal, using the provided roll value and rollType/advantage
                    const rollData = {
                        total: rollValue,
                        firstRoll: rollValue,
                        secondRoll: null,
                        isAdvantageRoll: isAdvantageRoll,
                        rollType: rollType,
                        characterid: pendingCheck.characterId,
                        playerid: pendingCheck.playerid,
                        rolledSkillName: pendingCheck.config.checks[0].type // treat as expected type
                    };
                    TrapSystem.utils.chat('✅ GM accepted the roll. Processing result...');
                    TrapSystem.interaction.handleRollResult(rollData, pendingCheck.playerid);
                } else if (action === 'reject') {
                    // Redisplay the "Skill Check Required" menu for the player
                    let playerid = pendingCheck.playerid;
                    let checkIndex = pendingCheck.checkIndex || 0;
                    let advantageType = pendingCheck.advantage || 'normal'; // Get original advantage type

                    // Call handleRollCheck to show the player the simpler prompt
                    TrapSystem.menu.handleRollCheck(trapToken, checkIndex, advantageType, playerid);
                }
                return;
            }
            // Macro Export Commands
            case "exportmacros":
                TrapSystem.macroExporter.exportMacros();
                break;
            case "resetstates":
                if (TrapSystem.macroExporter.resetTokenStates()) {
                    sendChat("TrapSystem", "/w gm ✅ States reset to exported versions.");
                } else {
                    sendChat("TrapSystem", "/w gm ℹ️ No states needed resetting or were available to reset.");
                }
                TrapSystem.state.macroExportRecordOrdering = false; // Stop recording after explicit reset
                break;
            case "resetmacros":
                if (TrapSystem.macroExporter.resetMacros()) {
                    sendChat("TrapSystem", "/w gm ✅ Macros reset to exported actions.");
                } else {
                    sendChat("TrapSystem", "/w gm ℹ️ No macros needed resetting or were available to reset.");
                }
                break;
            case "fullreset":
                TrapSystem.macroExporter.fullReset();
                break;
            case "passivemenu":
                if (!msg.selected || msg.selected.length === 0) {
                    TrapSystem.utils.chat("❌ Please select a trap token to configure its passive settings.", msg.playerid);
                    return;
                }
                const trapForPassiveMenu = getObj("graphic", msg.selected[0]._id);
                TrapSystem.passive.showPassiveSetupMenu(trapForPassiveMenu, msg.playerid);
                break;
            case "setpassive":
                // args from chat: ["!trapsystem", "setpassive", "dc", "TRAP_ID", "15"]
                if (args.length < 4) { // Need at least !trapsystem setpassive property trapId (value can be optional for disable)
                    TrapSystem.utils.chat("❌ Insufficient arguments for setpassive. Expected: property trapId value(s)", msg.playerid);
                    return;
                }
                // Pass args starting from "dc", "TRAP_ID", "15"
                TrapSystem.passive.handleSetPassiveProperty(args.slice(2), msg.playerid); 
                break;
            case 'resetdetection':
                TrapSystem.commands.handleResetDetection(selectedToken, msg.playerid);
                break;
            case "hidedetection": { // <-- ADD THIS BLOCK
                const duration = args[2] || 0; // If no duration, it hides indefinitely until 'show' is called
                TrapSystem.commands.hideAllAuras(duration, msg.playerid);
                break;
            }
            case "showdetection": // <-- AND ADD THIS BLOCK
                TrapSystem.commands.showAllAuras(msg.playerid);
                break;
            case "rearm": {
                const tid = args[2];
                if (!tid) {
                    TrapSystem.utils.chat('❌ No trap ID provided to rearm.');
                    return;
                }
                const tk = getObj("graphic", tid);
                if (!tk || !TrapSystem.utils.isTrap(tk)) {
                    TrapSystem.utils.chat('❌ Could not find a valid trap with that ID to rearm.');
                    return;
                }
                // toggleTrap will handle setting uses to 1 if it's depleted.
                TrapSystem.triggers.toggleTrap(tk);
                break;
            }
            default:
                TrapSystem.utils.chat(`❌ Unknown command: ${action}\nUse !trapsystem help for command list`);
        }
    }
});

// ---------------------------------------------------
// 9) EVENT LISTENERS DETECTIONS
// ---------------------------------------------------

// Event listener for when a MODERN door opens, triggering passive checks
on("change:door", (obj, prev) => {
    try {
        const wasJustOpened = obj.get('isOpen') && !prev.isOpen;
        if (wasJustOpened) {
            TrapSystem.utils.log(`Modern door ${obj.id} was opened. Running passive checks for all tokens on page.`, 'info');
            TrapSystem.passive.runPageWidePassiveChecks(obj.get('_pageid'));
        }
    } catch (err) {
        TrapSystem.utils.log(`Error in on("change:door") for door check on object ${obj.id}: ${err.message}\nStack: ${err.stack}`, 'error');
    }
});

// Event listener for when a LEGACY door (path) opens, triggering passive checks
on("change:path", (obj, prev) => {
    try {
        // This handler is now only for legacy path-based doors
        const isLegacyDoor = obj.get('layer') === 'walls' && typeof obj.get('door_open') !== 'undefined';
        if (isLegacyDoor) {
            const wasLegacyDoorOpened = obj.get('door_open') && !prev.door_open;
            if (wasLegacyDoorOpened) {
                TrapSystem.utils.log(`Legacy door ${obj.id} was opened. Running passive checks for all tokens on page.`, 'info');
                TrapSystem.passive.runPageWidePassiveChecks(obj.get('_pageid'));
            }
        }
    } catch (err) {
        TrapSystem.utils.log(`Error in on("change:path") for legacy door check on object ${obj.id}: ${err.message}\nStack: ${err.stack}`, 'error');
    }
});