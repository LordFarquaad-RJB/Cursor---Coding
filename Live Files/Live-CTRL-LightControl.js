/**
 * LightControl.js
 * Consolidated lighting and visibility control system for Roll20
 */

const LightControl = {
    // Configuration
    config: {
        DEFAULT_GRID_SIZE: 70,
        VALID_LAYERS: ["walls", "gmlayer", "map", "objects"]
    },

    // Utility functions
    utils: {
        log(message, type = 'info') {
            const prefix = {
                info: '📜',
                error: '❌',
                success: '✅',
                warning: '⚠️'
            }[type] || '📜';
            log(`${prefix} ${message}`);
        },
        isGM(playerid) {
            return playerIsGM(playerid);
        },
        sendGmMessage(content) {
            sendChat("LightControl", `/w gm ${content}`, null, { noarchive: true });
        }
    },

    // Help Command
    help: {
        showHelp(playerid) {
            if (!LightControl.utils.isGM(playerid)) {
                let player_obj = getObj('player', playerid);
                let display_name = "";
                if(player_obj){
                    display_name = player_obj.get('_displayname');
                }
                sendChat("LightControl", "/w " + display_name + " 权限错误：此命令仅限GM使用。", null, {noarchive: true});
                return;
            }
            const helpMsg = [
                "&{template:default} {{name=LightControl Help}}",
                "{{Core Commands=}}",
                "{{**!wall** = Manipulate Dynamic Lighting (pathv2) walls.}}",
                "{{  `!wall [ID] <action> [gridSize] [grids]`}}",
                "{{  Actions: `moveLeft`, `moveRight`, `moveUp`, `moveDown`, `hide`, `reveal`, `layer <layerName>`}}",
                "{{  Example: `!wall -Mxyz123 moveLeft 70 2`}}",
                "{{**!door** = Manipulate native Door/Window objects.}}",
                "{{  `!door [ID|<all_on_page>|<area shape dimension action>] <action_if_ID_or_all_on_page>`}}",
                "{{  Actions: `open`, `close`, `lock`, `unlock`, `reveal`, `set_secret_true`}}",
                "{{  Area Ops: `!door area square <grids> <action>` or `!door area circle <grids> <action>`}}",
                "{{  Example (single): `!door -Mabc456 open`}}",
                "{{  Example (page): `!door all_on_page lock`}}",
                "{{  Example (area): `!door area square 5 open`}}",
                "{{**!lc toggledarkness** = Toggles lights off/on in an area, remembering previous states.}}",
                "{{  `!lc toggledarkness <shape> [dimensions...] [--id <switch_name>]`}}",
                "{{  Shapes: `square <grids>`, `circle <grids>`}}",
                "{{  Example: `!lc toggledarkness square 5`}}",
                "{{  Example: `!lc toggledarkness circle 3 --id room_torch`}}",
                "{{---General---}}",
                "{{`!lc help` or `!lightcontrol help` = Shows this help message.}}",
                // Placeholder for future commands
                "{{More commands coming soon!}}"
            ].join(" ");
            LightControl.utils.sendGmMessage(helpMsg);
        }
    },

    // Wall Management
    wall: {
        processWallCommand(args) {
            if (args.length < 3) {
                sendChat("API", "/w gm ❌ Error: Missing parameters! Use: **!wall [ID] moveLeft/moveRight/moveUp/moveDown/hide/reveal/layer [Grid Size] [Grids]**");
                return;
            }

            let wallID = args[1];
            let action = args[2].toLowerCase();
            let gridSize = args[3] ? parseInt(args[3], 10) : LightControl.config.DEFAULT_GRID_SIZE;
            let gridsToMove = args[4] ? parseInt(args[4], 10) : 1;
            let totalMove = gridSize * gridsToMove;

            if (!wallID) {
                sendChat("API", "/w gm ❌ Error: No wall ID provided.");
                return;
            }

            // Attempt to get the pathv2 object
            let wall = getObj("pathv2", wallID);
            if (!wall) {
                sendChat("API", `/w gm ❌ Error: Wall ${wallID} not found.`);
                return;
            }

            // Current coords
            let currentX = wall.get("x");
            let currentY = wall.get("y");

            switch (action) {
                case "moveright":
                    wall.set("x", currentX + totalMove);
                    LightControl.utils.sendGmMessage(`🏗️ **Wall Moved Right (${gridsToMove} grids, ${totalMove}px):** ${wallID}`);
                    break;

                case "moveleft":
                    wall.set("x", currentX - totalMove);
                    LightControl.utils.sendGmMessage(`🏗️ **Wall Moved Left (${gridsToMove} grids, ${totalMove}px):** ${wallID}`);
                    break;

                case "moveup":
                    wall.set("y", currentY - totalMove);
                    LightControl.utils.sendGmMessage(`🏗️ **Wall Moved Up (${gridsToMove} grids, ${totalMove}px):** ${wallID}`);
                    break;

                case "movedown":
                    wall.set("y", currentY + totalMove);
                    LightControl.utils.sendGmMessage(`🏗️ **Wall Moved Down (${gridsToMove} grids, ${totalMove}px):** ${wallID}`);
                    break;

                case "hide":
                    wall.set("layer", "gmlayer");
                    LightControl.utils.sendGmMessage(`🔥 **Wall Hidden (GM Layer):** ${wallID}`);
                    break;

                case "reveal":
                    wall.set("layer", "walls");
                    LightControl.utils.sendGmMessage(`👁 **Wall Revealed (Dynamic Lighting Layer):** ${wallID}`);
                    break;

                case "layer": {
                    let newLayer = args[3]?.toLowerCase();
                    if (!LightControl.config.VALID_LAYERS.includes(newLayer)) {
                        LightControl.utils.sendGmMessage(`❌ Invalid layer! Use: ${LightControl.config.VALID_LAYERS.join(", ")}`);
                        return;
                    }

                    wall.set("layer", newLayer);
                    LightControl.utils.sendGmMessage(`🔄 **Wall Moved to Layer: ${newLayer}**`);
                    break;
                }

                default:
                    LightControl.utils.sendGmMessage(`❌ Invalid wall command. Use:  
                    **!wall [ID] moveLeft/moveRight/moveUp/moveDown/hide/reveal/layer [Grid Size] [Grids]**`);
            }
        }
    },

    // Door/Window Management
    door: {
        processDoorCommand(args) {
            if (args.length < 2) { // Min length for !door <target>
                LightControl.utils.sendGmMessage("❌ Error: Missing parameters for !door command. Try `!lc help`.");
                return;
            }

            const originalTarget = args[1];
            const keyword = originalTarget.toLowerCase();
            const playerid = args.whoisplayerid; // Passed from main handler

            if (keyword === "all_on_page") {
                if (args.length < 3) { LightControl.utils.sendGmMessage("❌ Error: Missing action for `all_on_page`. Use: `!door all_on_page <action>`."); return; }
                const action = args[2].toLowerCase();
                if (!LightControl.utils.isGM(playerid)) {
                    let player_obj = getObj('player', playerid);
                    let display_name = "";
                    if(player_obj) display_name = player_obj.get('_displayname');
                    sendChat("LightControl", "/w " + display_name + " 权限错误：all_on_page 操作仅限GM使用。", null, {noarchive: true});
                    return;
                }
                this.processAllDoorsOnPage(action, Campaign().get("playerpageid"));
            }
            else if (keyword === "area") {
                if (args.length < 5) { // !door area shape dimension action
                     LightControl.utils.sendGmMessage("❌ Error: Missing parameters for `area` operation. Use: `!door area <shape> <dimension> <action>`."); return; 
                }
                const shape = args[2].toLowerCase();
                const dimension = parseInt(args[3]);
                const action = args[4].toLowerCase();
                const selectedGraphics = (args.selected || []).map(s => getObj("graphic", s._id)).filter(g => g && g.get("_subtype") === "token");
                
                this.processAreaDoorCommand(shape, dimension, action, selectedGraphics, playerid);
            }
            else { // Assumed to be a specific door ID
                if (args.length < 3) { LightControl.utils.sendGmMessage("❌ Error: Missing action for specific door ID. Use: `!door [ID] <action>`."); return; }
                const doorID = originalTarget;
                const action = args[2].toLowerCase();
                this.processSingleDoor(doorID, action, playerid);
            }
        },

        processSingleDoor(doorID, action, playerid) {
             // GM check can be added here if certain actions on single doors are GM-only, but typically not needed.
            let door = getObj("door", doorID) || getObj("window", doorID);
            if (!door) {
                LightControl.utils.sendGmMessage(`❌ Error: Door or Window ${doorID} not found.`);
                return;
            }
            let feedback = this.applyActionToDoorObject(door, action);
            LightControl.utils.sendGmMessage(feedback || `❓ Unknown action or issue with door ${doorID}.`);
        },

        applyActionToDoorObject(doorObject, action) {
            let message = "";
            switch (action) {
                case "close": doorObject.set("isOpen", false); message = `🚪 **${doorObject.get('_type')} Closed:** ${doorObject.id}`; break;
                case "open":
                    doorObject.set("isOpen", true);
                    doorObject.set("isLocked", false);
                    message = `🚪 **${doorObject.get('_type')} Opened and Unlocked:** ${doorObject.id}`;
                    break;
                case "lock": doorObject.set("isLocked", true); message = `🔒 **${doorObject.get('_type')} Locked:** ${doorObject.id}`; break;
                case "unlock": doorObject.set("isLocked", false); message = `🔓 **${doorObject.get('_type')} Unlocked:** ${doorObject.id}`; break;
                case "reveal":
                    if (doorObject.get('_type') === 'door') {
                        doorObject.set("isSecret", false); message = `👁 **Secret Door Revealed:** ${doorObject.id}`;
                    } else { message = `⚠️ Windows cannot be secret. No action for ${doorObject.id}.`; }
                    break;
                case "set_secret_true":
                    if (doorObject.get('_type') === 'door') {
                        doorObject.set("isSecret", true); message = `🤫 **Door made Secret:** ${doorObject.id}`;
                    } else { message = `⚠️ Windows cannot be secret. No action for ${doorObject.id}.`; }
                    break;
                default: message = `❌ Invalid action \`${action}\` for ${doorObject.get('_type')} ${doorObject.id}.`; break;
            }
            return message;
        },

        processAllDoorsOnPage(action, pageid) {
            if (!pageid) {
                LightControl.utils.log("Error: No page ID provided for processAllDoorsOnPage.", 'error');
                LightControl.utils.sendGmMessage("❌ Error: Could not determine current page for page-wide door operation.");
                return;
            }

            let doorsAndWindows = findObjs({ _pageid: pageid, _type: "door" });
            doorsAndWindows = doorsAndWindows.concat(findObjs({ _pageid: pageid, _type: "window" }));

            if (doorsAndWindows.length === 0) {
                LightControl.utils.sendGmMessage("🚪 No doors or windows found on the current page.");
                return;
            }

            let changedCount = 0;
            doorsAndWindows.forEach(obj => {
                let processed = true;
                let singleFeedback = this.applyActionToDoorObject(obj, action);
                // Check if feedback indicates an actual change or just a warning/error for that object
                if (singleFeedback.startsWith("❌") || singleFeedback.startsWith("⚠️")) {
                    processed = false;
                }
                if (processed) changedCount++;
            });

            if (changedCount > 0) {
                LightControl.utils.sendGmMessage(`🚪 Processed ${changedCount} door(s)/window(s) on the page. Action: ${action}.`);
            } else {
                LightControl.utils.sendGmMessage(`🚪 No doors/windows were affected by the action \`${action}\` on this page (possibly due to type mismatch for secret actions or invalid action).`);
            }
        },

        processAreaDoorCommand(shape, dimension, action, selectedTokens, playerid) {
            if (!LightControl.utils.isGM(playerid)) {
                let player_obj = getObj('player', playerid);
                let display_name = "";
                if(player_obj) display_name = player_obj.get('_displayname');
                sendChat("LightControl", "/w " + display_name + " 权限错误：区域门窗操作仅限GM使用。", null, {noarchive: true});
                return;
            }

            if (!selectedTokens || selectedTokens.length === 0) {
                LightControl.utils.sendGmMessage("❌ Error: No tokens selected for area door operation. Please select token(s) to center the area.");
                return;
            }

            if (isNaN(dimension) || dimension <= 0) {
                LightControl.utils.sendGmMessage(`❌ Error: Invalid dimension value for ${shape}. Must be a positive number.`);
                return;
            }

            const pageid = selectedTokens[0].get("_pageid");
            const page = getObj("page", pageid);
            const finalGridSize = (page.get('scale_number') === 0 || page.get('snapping_increment') === 0) ? 70 : (page.get('scale_number') * 70 / page.get('snapping_increment'));
            
            let centerX = 0, centerY = 0;
            selectedTokens.forEach(t => { centerX += t.get("left"); centerY += t.get("top"); });
            centerX /= selectedTokens.length; centerY /= selectedTokens.length;

            const allDoorsAndWindowsOnPage = findObjs({ _pageid: pageid, _type: "door" })
                                        .concat(findObjs({ _pageid: pageid, _type: "window" }));
            
            let affectedObjects = [];

            switch (shape) {
                case "square":
                    const halfPixelSize = (dimension * finalGridSize) / 2;
                    affectedObjects = allDoorsAndWindowsOnPage.filter(obj => 
                        Math.abs(obj.get("left") - centerX) <= halfPixelSize && 
                        Math.abs(obj.get("top") - centerY) <= halfPixelSize
                    );
                    break;
                case "circle":
                    const radiusPixel = dimension * finalGridSize;
                    affectedObjects = allDoorsAndWindowsOnPage.filter(obj => {
                        const dx = obj.get("left") - centerX;
                        const dy = obj.get("top") - centerY;
                        return Math.sqrt(dx * dx + dy * dy) <= radiusPixel;
                    });
                    break;
                default:
                    LightControl.utils.sendGmMessage(`❌ Error: Unknown shape \`${shape}\`. Supported shapes: square, circle.`);
                    return;
            }

            if (affectedObjects.length === 0) {
                LightControl.utils.sendGmMessage(`🚪 No doors or windows found in the specified ${shape} area.`);
                return;
            }

            let changedCount = 0;
            affectedObjects.forEach(obj => {
                let singleFeedback = this.applyActionToDoorObject(obj, action);
                if (!singleFeedback.startsWith("❌") && !singleFeedback.startsWith("⚠️")) {
                    changedCount++;
                }
            });

            LightControl.utils.sendGmMessage(`🚪 Processed ${changedCount} of ${affectedObjects.length} door(s)/window(s) in the ${shape} area with action: ${action}.`);
        }
    },

    // Area Darkness Command (now ToggleDarkness)
    areaDarkness: {
        LIGHT_PROPERTIES_TO_SAVE: [
            "light_radius", "light_dimradius", "light_otherplayers", "light_hassight",
            "light_angle", "light_losangle", "light_multiplier", "light_color"
        ],

        parseToggleArgs(args) {
            let shape, dimensions = [], switchId = null;
            let i = 0;
            if (args[i]) {
                shape = args[i].toLowerCase();
                i++;
            }

            // Consume dimension args until --id or end
            while(args[i] && args[i] !== "--id") {
                dimensions.push(args[i]);
                i++;
            }

            // Check for --id
            if (args[i] === "--id" && args[i+1]) {
                switchId = args[i+1];
                i += 2; 
            }
            return { shape, dimensions, switchId };
        },

        processToggleDarknessCommand(fullArgs, selectedTokens, playerid) {
            if (!LightControl.utils.isGM(playerid)) {
                let player_obj = getObj('player', playerid);
                let display_name = "";
                if(player_obj) display_name = player_obj.get('_displayname');
                sendChat("LightControl", "/w " + display_name + " 权限错误：此命令仅限GM使用。", null, {noarchive: true});
                return;
            }

            if (!selectedTokens || selectedTokens.length === 0) {
                LightControl.utils.sendGmMessage("❌ Error: No tokens selected. Please select token(s) to center the area.");
                return;
            }
            
            // Initialize state if it doesn't exist
            state.LightControl = state.LightControl || {};
            state.LightControl.toggledLightStates = state.LightControl.toggledLightStates || {};

            const { shape, dimensions, switchId } = this.parseToggleArgs(fullArgs.slice(1)); // fullArgs[0] is 'toggledarkness'

            if (!shape || dimensions.length === 0) {
                LightControl.utils.sendGmMessage("❌ Error: Missing shape or dimensions. Use `!lc toggledarkness <shape> [dims...] [--id id]`. Try `!lc help`.");
                return;
            }
            
            // --- Determine Center Point ---
            let centerX, centerY, pageid;
            const idsMatch = fullArgs.join(' ').match(/--ids\s+([-\w\s,]+)/);
            
            if (idsMatch && idsMatch[1]) {
                const ids = idsMatch[1].split(/[,\s]+/).filter(Boolean);
                const centerTokens = ids.map(id => getObj("graphic", id)).filter(Boolean);
                if (centerTokens.length === 0) {
                    LightControl.utils.sendGmMessage("❌ Error: No valid tokens found for the provided --ids.");
                    return;
                }
                centerX = centerTokens.reduce((sum, t) => sum + t.get("left"), 0) / centerTokens.length;
                centerY = centerTokens.reduce((sum, t) => sum + t.get("top"), 0) / centerTokens.length;
                pageid = centerTokens[0].get("_pageid");
            } else if (selectedTokens && selectedTokens.length > 0) {
                centerX = selectedTokens.reduce((sum, t) => sum + t.get("left"), 0) / selectedTokens.length;
                centerY = selectedTokens.reduce((sum, t) => sum + t.get("top"), 0) / selectedTokens.length;
                pageid = selectedTokens[0].get("_pageid");
            } else {
                LightControl.utils.sendGmMessage("❌ Error: No tokens selected or specified via --ids. Please select token(s) to center the area.");
                return;
            }
            // --- End Center Point Logic ---

            const stateKey = `${pageid}_${switchId || "_default_toggle"}`;
            const page = getObj("page", pageid);
            const finalGridSize = (page.get('scale_number') === 0 || page.get('snapping_increment') === 0) ? 70 : (page.get('scale_number') * 70 / page.get('snapping_increment'));

            // Check if we are restoring lights
            if (state.LightControl.toggledLightStates[stateKey]) {
                const savedStates = state.LightControl.toggledLightStates[stateKey];
                let restoreCommandParts = [];
                Object.keys(savedStates).forEach(tokenId => {
                    const tokenState = savedStates[tokenId];
                    let tokenSetParts = [];
                    this.LIGHT_PROPERTIES_TO_SAVE.forEach(prop => {
                        // Ensure undefined or null are handled, perhaps by not setting if not in saved state or using a default for TokenMod if necessary
                        if (tokenState[prop] !== undefined && tokenState[prop] !== null) {
                             // TokenMod expects true/false for booleans, not strings "true"/"false"
                            let value = tokenState[prop];
                            if (typeof value === 'boolean') {
                                tokenSetParts.push(`${prop}|${value}`);
                            } else {
                                tokenSetParts.push(`${prop}|'${value}'`); // Enclose string values in single quotes for TokenMod robustness
                            }
                        } else if (prop === 'light_color' && (tokenState[prop] === undefined || tokenState[prop] === null)) {
                            tokenSetParts.push(`${prop}|transparent`); // Default color to transparent if not set
                        }
                    });
                    if (tokenSetParts.length > 0) {
                        restoreCommandParts.push(`--ids ${tokenId} --set ${tokenSetParts.join(" ")}`);
                    }
                });

                if (restoreCommandParts.length > 0) {
                    const fullRestoreCommand = `!token-mod ${restoreCommandParts.join(" ")}`;
                    LightControl.utils.sendGmMessage("**Generated TokenMod Command (click to restore lights):**<br>" +
                        `<a href=\"` + fullRestoreCommand.replace(/"/g, "&quot;").replace(/'/g, "&apos;") + `\">💡 Restore Lights</a>` +
                        `<br><br><i>Lights restored for switch: ${switchId || "default"}</i>`);
                    delete state.LightControl.toggledLightStates[stateKey]; // Clear the state after restoring
                } else {
                    LightControl.utils.sendGmMessage("💡 No saved light states to restore for this switch.");
                }
                return;
            }

            // Proceed to turn lights OFF and save state
            let tokensToAffectAndSave = {};
            const allTokensOnPage = findObjs({ _pageid: pageid, _type: "graphic", _subtype: "token" });

            let dimensionValue;
            switch (shape) {
                case "square":
                    if (dimensions.length < 1) { LightControl.utils.sendGmMessage("❌ Square needs size."); return; }
                    dimensionValue = parseInt(dimensions[0]);
                    if (isNaN(dimensionValue) || dimensionValue <= 0) { LightControl.utils.sendGmMessage("❌ Invalid square size."); return; }
                    const halfPixelSize = (dimensionValue * finalGridSize) / 2;
                    allTokensOnPage.forEach(token => {
                        if (Math.abs(token.get("left") - centerX) <= halfPixelSize && Math.abs(token.get("top") - centerY) <= halfPixelSize) {
                            if (token.get("light_radius") > 0 || token.get("light_dimradius") > 0) {
                                let currentProps = {};
                                this.LIGHT_PROPERTIES_TO_SAVE.forEach(prop => currentProps[prop] = token.get(prop));
                                tokensToAffectAndSave[token.id] = currentProps;
                            }
                        }
                    });
                    break;
                case "circle":
                    if (dimensions.length < 1) { LightControl.utils.sendGmMessage("❌ Circle needs radius."); return; }
                    dimensionValue = parseInt(dimensions[0]);
                    if (isNaN(dimensionValue) || dimensionValue <= 0) { LightControl.utils.sendGmMessage("❌ Invalid circle radius."); return; }
                    const radiusPixel = dimensionValue * finalGridSize;
                    allTokensOnPage.forEach(token => {
                        const dx = token.get("left") - centerX; const dy = token.get("top") - centerY;
                        if (Math.sqrt(dx * dx + dy * dy) <= radiusPixel) {
                            if (token.get("light_radius") > 0 || token.get("light_dimradius") > 0) {
                                let currentProps = {};
                                this.LIGHT_PROPERTIES_TO_SAVE.forEach(prop => currentProps[prop] = token.get(prop));
                                tokensToAffectAndSave[token.id] = currentProps;
                            }
                        }
                    });
                    break;
                default:
                    LightControl.utils.sendGmMessage(`❌ Unknown shape \`${shape}\`. Use square or circle.`);
                    return;
            }

            const tokenIdsToTurnOff = Object.keys(tokensToAffectAndSave);
            if (tokenIdsToTurnOff.length > 0) {
                state.LightControl.toggledLightStates[stateKey] = tokensToAffectAndSave;
                const turnOffCommand = `!token-mod --ids ${tokenIdsToTurnOff.join(",")} --set light_radius|0 light_dimradius|0`;
                LightControl.utils.sendGmMessage("**Generated TokenMod Command (click to turn off lights):**<br>" +
                    `<a href=\"` + turnOffCommand.replace(/"/g, "&quot;") + `\">🌑 Turn Off Lights (${tokenIdsToTurnOff.length} Token(s))</a>` +
                    `<br><br><i>Run <code>!lc toggledarkness ${shape} ${dimensions.join(" ")} ${switchId ? "--id " + switchId : ""}</code> again to restore.</i>`);
            } else {
                LightControl.utils.sendGmMessage("💡 No tokens emitting light found in the specified area to turn off.");
            }
        }
    }
};

// Initialize on ready
on("ready", function() {
    LightControl.utils.log("✅ LightControl System v1.1.0 Ready!");
    if (typeof CommandMenu !== 'undefined' && CommandMenu.utils && CommandMenu.utils.addInitStatus) {
        CommandMenu.utils.addInitStatus('LightControl', 'success', 'v1.1.0', 'success');
    }
});

// Handle chat messages
on("chat:message", function(msg) {
    if (msg.type !== "api") return;
    
    let args = msg.content.split(" ");
    let command = args[0].toLowerCase();

    // Wall Commands
    if (command === "!wall") {
        LightControl.wall.processWallCommand(args);
    }
    // Door Commands
    else if (command === "!door") {
        // Pass the player ID and selected graphics from the msg object for GM check and area operations
        LightControl.door.processDoorCommand({...args, whoisplayerid: msg.playerid, selected: msg.selected }); 
    }
    // LightControl specific commands (e.g., help)
    else if (command === "!lc" || command === "!lightcontrol") {
        const subCommand = args[1] ? args[1].toLowerCase() : null;
        if (subCommand === "help") {
            LightControl.help.showHelp(msg.playerid);
        }
        else if (subCommand === "toggledarkness") {
            const selectedGraphics = (msg.selected || []).map(s => getObj("graphic", s._id)).filter(g => g && g.get("_subtype") === "token");
            // Pass msg.content.split(" ") which is args array including the main command e.g. ["!lc", "toggledarkness", "square", "5"]
            // Then processToggleDarknessCommand will slice it from its own first arg.
            LightControl.areaDarkness.processToggleDarknessCommand(args.slice(1), selectedGraphics, msg.playerid); 
        }
        else {
            // Optionally send a default message or brief help if an !lc command is unknown
            LightControl.utils.sendGmMessage("Unknown LightControl command. Try `!lc help`.");
        }
    }
});