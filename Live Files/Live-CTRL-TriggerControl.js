// =================================================================================
// Enhanced TriggerControl Script v2.2.0
// =================================================================================
// This script provides two main triggering systems for Roll20:
//
// 1. TABLE TRIGGER SYSTEM
//    Automatically executes commands when rolling on rollable tables.
//    Usage: Put any command, macro, or text in your table items.
//
//    Examples:
//    - !token-mod --set statusmarkers|=red
//    - #MyMacro
//    - &{template:default} {{name=Trap}} {{text=You triggered something!}}
//
// 2. TURN ORDER TRIGGER SYSTEM
//    Executes commands when a token's turn begins in combat.
//    Usage: Add [TOT: settings] command to a token's GM Notes.
//
//    Format: [TOT: settings] command
//    Settings (comma-separated):
//    - once or 1: Command only fires once per combat.
//    - #: Number of times to trigger (e.g., "3" for 3 times).
//    - round>#: Only trigger after this round number (e.g., "round>3").
//    - gm: Only visible to GM (whisper).
//    - player: Only visible to the token's controlling player
//    - all: Visible to everyone (default)
//
//    Examples:
//    - [TOT: 1] #StartOfTurnMacro
//    - [TOT: 3] !token-mod --set statusmarkers|=blue
//    - [TOT: once,gm] &{template:default} {{name=Secret Effect}} {{text=Hidden message}}
//    - [TOT: 2,player] &{template:default} {{name=Turn Effect}} {{text=Your turn begins!}}
//    - [TOT: round>2,once] &{template:default} {{name=Lair Action}} {{text=The ground shakes!}}
//
// 3. COMMAND TYPES SUPPORTED
//    - API Commands: !command or $command
//    - Macros: #MacroName
//    - Chat Messages: Any text or Roll20 templates
//    - Multi-line: Can combine multiple commands
//
// 4. PLACEHOLDER REPLACEMENT (Turn Order Triggers Only)
//    - <&token>: Replaced with the token's ID
//    - @{selected|token_id}: Replaced with the token's ID
//    - @{target|token_id}: Replaced with the token's ID
//
// 5. TROUBLESHOOTING
//    - If macros aren't working, check the macro name spelling
//    - If Turn Order triggers aren't firing, verify the [TOT] tag format
//    - If you see duplicate messages, ensure only one trigger script is active
//    - Commands appear in chat from "TableTrigger" or "TurnOrderTrigger"
//
// 6. COMMANDS
//    - !tt-reset: Manually resets all trigger counts and the round number.
//    - !tt-debug: Toggles extra debug logging to the API console.
//    - !rtm [TableName]: Manually rolls on the specified table.
//
// =================================================================================

const TriggerControlConfig = {
    DEBUG: false // Set to true for verbose logging. Can be toggled with !tt-debug
};

on("ready", () => {
    log("✅ Enhanced TriggerControl Script v2.2.0 Loaded.");
    if (typeof CommandMenu !== 'undefined' && CommandMenu.utils && CommandMenu.utils.addInitStatus) {
        CommandMenu.utils.addInitStatus('TriggerControl', 'success', null, 'success');
    }

    // Initialize state for Turn Order Trigger, with migration support
    if (!state.TurnOrderTrigger) {
        state.TurnOrderTrigger = {};
    }
    // Ensure properties exist for robust state migration
    if (typeof state.TurnOrderTrigger.triggeredCount === 'undefined') {
        log("⚙️ Initializing/Migrating state property: triggeredCount.");
        state.TurnOrderTrigger.triggeredCount = {};
    }
    if (typeof state.TurnOrderTrigger.roundNumber === 'undefined') {
        log("⚙️ Initializing/Migrating state property: roundNumber.");
        state.TurnOrderTrigger.roundNumber = 1;
    }
    if (typeof state.TurnOrderTrigger.topOfRoundTokenId === 'undefined') {
        log("⚙️ Initializing/Migrating state property: topOfRoundTokenId.");
        state.TurnOrderTrigger.topOfRoundTokenId = null;
    }
    // Clean up old state properties if they exist from previous versions
    if (state.TurnOrderTrigger.triggeredOnce) {
        log("⚙️ Migrating state: removing old 'triggeredOnce' property.");
        delete state.TurnOrderTrigger.triggeredOnce;
    }

    const utils = {
        /**
         * Executes a command string, which can be a macro, an API command, or plain text.
         * Handles placeholder replacement for token IDs.
         * Supports multiple commands separated by semicolons.
         * @param {string} commandString - The command(s) to execute (e.g., "#MyMacro; !token-mod...").
         * @param {object} tagToIdMap - A map of placeholder tags to token IDs (e.g., { token: '...' }).
         * @param {string} sender - The "who" to display in the chat for the command.
         * @param {string} visibility - Who can see the message ('gm', 'player', 'all').
         * @param {string} playerId - The player ID for player-specific messages.
         */
        executeCommand(commandString, tagToIdMap = {}, sender = 'TriggerControl', visibility = 'all', playerId = null) {
            try {
                commandString = (commandString || '').trim();
                if (!commandString) return;

                const commandsToRun = commandString.split(';');

                for (const singleCommand of commandsToRun) {
                    let cmdToProcess = singleCommand.trim();
                    if (!cmdToProcess) continue;

                    let macroText;

                    if (cmdToProcess.startsWith('#')) {
                        const macroName = cmdToProcess.substring(1);
                        const macro = findObjs({ _type: "macro", name: macroName })[0];
                        if (!macro) {
                            log(`❌ Macro not found: ${macroName}`);
                            sendChat(sender, `/w gm Error: Macro named '${macroName}' not found.`);
                            continue; // Go to the next command in the semicolon list
                        }
                        macroText = macro.get("action");
                    } else {
                        macroText = cmdToProcess;
                    }

                    // Replace placeholders
                    let processedText = macroText;
                    for (const [tag, tokenId] of Object.entries(tagToIdMap)) {
                        if (tokenId) {
                            const tagRegex = new RegExp(`<&${tag}>`, 'g');
                            processedText = processedText.replace(tagRegex, tokenId);
                        }
                    }
                    
                    // Replace selected/target placeholders for convenience
                    if (tagToIdMap.token) {
                        processedText = processedText.replace(/@\{selected\|token_id\}/g, tagToIdMap.token);
                        processedText = processedText.replace(/@\{target\|token_id\}/g, tagToIdMap.token);
                    }

                    // Execute the command(s)
                    const isApiCommand = line => line.trim().startsWith('!') || line.trim().startsWith('$');
                    const lines = processedText.split('\n');
                    const apiCommands = lines.filter(isApiCommand);
                    const chatMessage = lines.filter(line => !isApiCommand(line)).join('\n');

                    // Handle visibility
                    let messagePrefix = '';
                    if (visibility === 'gm') {
                        messagePrefix = '/w gm ';
                    } else if (visibility === 'player' && playerId) {
                        messagePrefix = `/w ${playerId} `;
                    }

                    if (chatMessage.trim()) {
                        sendChat(sender, messagePrefix + chatMessage);
                    }

                    apiCommands.forEach(apiCmd => {
                        let finalCmd = apiCmd.trim();
                        if (finalCmd.startsWith('$')) {
                            finalCmd = '!' + finalCmd.substring(1);
                        }
                        sendChat(sender, messagePrefix + finalCmd);
                    });
                } // end for loop

            } catch (err) {
                log(`❌ Error executing command: ${err.message}\nStack: ${err.stack}`);
            }
        }
    };

    // Common function to parse table-based inline rolls from msg.inlinerolls
    function parseInlinerolls(inlineRolls) {
        inlineRolls.forEach(ir => {
            let results = ir.results;
            if (!results || !results.rolls || results.rolls.length === 0) return;
            let firstRoll = results.rolls[0];
            if (!firstRoll.table || !firstRoll.results || firstRoll.results.length === 0) return;
            let tableItem = firstRoll.results[0].tableItem;
            if (!tableItem || !tableItem.name) return;

            let itemName = tableItem.name.trim();
            log(`📜 Extracted table item name: "${itemName}"`);
            handleItemName(itemName);
        });
    }

    // Common function to parse "rollresult" JSON
    function parseRollresult(jsonString) {
        let data;
        try {
            data = JSON.parse(jsonString);
        } catch (err) {
            log(`❌ Error parsing JSON: ${err}`);
            return;
        }
        if (!data.rolls || data.rolls.length === 0) return;
        let firstRoll = data.rolls[0];
        if (!firstRoll.table || !firstRoll.results || firstRoll.results.length === 0) return;
        let tableItem = firstRoll.results[0].tableItem;
        if (!tableItem || !tableItem.name) return;

        let itemName = tableItem.name.trim();
        log(`📜 Extracted table item name (rollresult): "${itemName}"`);
        handleItemName(itemName);
    }

    // Function to handle a table item name: locate the first "!" and re-send as an API command
    function handleItemName(itemName) {
        log(`🔎 Checking table item for wrapped command: "${itemName}"`);

        const startIndex = itemName.indexOf('{');
        const endIndex = itemName.lastIndexOf('}');

        if (startIndex !== -1 && endIndex > startIndex) {
            // Command is wrapped in {}, extract it.
            const commandToExecute = itemName.substring(startIndex + 1, endIndex).trim();
            if (commandToExecute) {
                log(`⚡ Extracted wrapped command: "${commandToExecute}"`);
                utils.executeCommand(commandToExecute, {}, 'TableTrigger');
            } else {
                log(`➡️ Found empty wrapper {} in "${itemName}". Ignoring.`);
            }
        } else {
            // No wrapper found. Log it and do nothing to enforce the new format.
            log(`➡️ No command wrapped in {} found in "${itemName}". Ignoring.`);
        }
    }

    // Function to handle macro recursion in table results
    function handleMacro(resultText) {
        let resultLines = resultText.split("\n");
        
        _.each(resultLines, function(line, index, resultArray) {
            let lineArray = line.split(' ');
            
            _.each(lineArray, function(word, index, parentArray) {
                if (word[0] === '#') {
                    let macro = findObjs({ type: 'macro', name: word.substring(1) });
                    parentArray[index] = macro.length > 0 ? handleMacro(macro[0].get('action')) : word;
                }
            });
            
            resultArray[index] = lineArray.join(' ');
        });
        
        return resultLines.join("\n");
    }

    // Function to roll a table with weighted items
    function rollTable(tableId, msgFrom) {
        let items = findObjs({ type: 'tableitem', rollabletableid: tableId });
        if (items.length > 0) {
            let weightedList = [];
            items.forEach(item => {
                let weight = item.get('weight');
                _.times(weight, () => weightedList.push(item.id));
            });
            let chosenItemId = weightedList[randomInteger(weightedList.length) - 1];
            let chosenItem = getObj('tableitem', chosenItemId);
            if (chosenItem) {
                let resultText = chosenItem.get('name');
                handleItemName(resultText); // Use the unified handler
            }
        } else {
            sendChat('TableTrigger', `/w "${msgFrom}" No items on this table.`);
        }
    }

    // Function to find and roll a table by name
    function findTable(msgFrom, tableName) {
        let tables = findObjs({ type: 'rollabletable', name: tableName }, { caseInsensitive: true });
        if (tables.length < 1) {
            sendChat('TableTrigger', `/w "${msgFrom}" No such table exists.`);
        } else {
            rollTable(tables[0].id, msgFrom);
        }
    }

    // Function to determine message sender
    function getFrom(params, playerId) {
        let msgFrom = titleCase(params[1].replace(/-/g, ' '));
        
        if (params.length > 2) {
            msgFrom = params.splice(2).join(' ');
            msgFrom = msgFrom.toLowerCase() == 'myself' ? ('player|' + playerId) : msgFrom;
        }
        
        return msgFrom;
    }

    // Helper function for title case
    function titleCase(str) {
        return str.toLowerCase().replace(/(^| )(\w)/g, function(x) {
            return x.toUpperCase();
        });
    }

    // Listen for both chat messages and API commands
    on("chat:message", function(msg) {
        if (msg.type === 'api') {
            const args = msg.content.split(' ');
            const command = args[0].toLowerCase();

            switch(command) {
                case '!tt-reset':
                    state.TurnOrderTrigger.triggeredCount = {};
                    state.TurnOrderTrigger.roundNumber = 1;
                    state.TurnOrderTrigger.topOfRoundTokenId = null;
                    log('🔄 TriggerControl counts and round number have been manually reset.');
                    sendChat('TriggerControl', '/w gm Trigger counts and round number have been reset.');
                    return;
                case '!tt-debug':
                    TriggerControlConfig.DEBUG = !TriggerControlConfig.DEBUG;
                    const status = TriggerControlConfig.DEBUG ? 'ON' : 'OFF';
                    log(`🐞 Debug mode is now ${status}.`);
                    sendChat('TriggerControl', `/w gm Debug mode is now ${status}.`);
                    return;
                case '!rtm':
                    if (args.length < 2) {
                        sendChat('TableTrigger', '/w gm Please provide a table name.');
                        return;
                    }
                    const tableName = args.slice(1).join(' ');
                    const player = getObj('player', msg.playerid);
                    const msgFrom = player ? player.get('displayname') : 'API';
                    findTable(msgFrom, tableName);
                    return;
            }
        }

        // Handle table rolls from inline rolls
        if ((msg.type === "general" || msg.type === "whisper") && msg.inlinerolls) {
            parseInlinerolls(msg.inlinerolls);
        }

        // Handle table rolls from rollresult (less common)
        if (msg.type === "rollresult" && msg.content) {
            parseRollresult(msg.content);
        }
    });

    // =================================================================================
    // Turn Order Trigger
    // =================================================================================
    // This section handles triggering commands or messages when tokens are added
    // to the turn order. The trigger configuration is stored in the token's GM notes.
    //
    // GM Notes Format:
    // [TOT: settings] command
    //
    // - [TOT]: Required tag to enable the trigger.
    // - settings (optional): Comma-separated list of settings.
    //   - 'once': The trigger will only fire once per combat for this token. Combat
    //             is considered ended when the turn order is cleared.
    // - command: The API command or chat message to send.
    //
    // Example:
    // [TOT: once] !token-mod --set statusmarkers|=red
    // [TOT] &{template:default} {{name=Spike Trap}} {{text=You stepped on a trap!}}
    // =================================================================================
    
    on('change:campaign:turnorder', (obj, prev) => {
        log('↔️ Turn order changed.');

        // Initialize state robustly in case it was corrupted
        if (!state.TurnOrderTrigger) {
            state.TurnOrderTrigger = {};
        }
        if (typeof state.TurnOrderTrigger.triggeredCount === 'undefined') {
            state.TurnOrderTrigger.triggeredCount = {};
        }
        if (typeof state.TurnOrderTrigger.roundNumber === 'undefined') {
            state.TurnOrderTrigger.roundNumber = 1;
        }
        if (typeof state.TurnOrderTrigger.topOfRoundTokenId === 'undefined') {
            state.TurnOrderTrigger.topOfRoundTokenId = null;
        }

        const newTurnOrderStr = obj.get('turnorder');
        if (newTurnOrderStr === "" || newTurnOrderStr === "[]") {
            log('↪️ Turn order cleared. Resetting trigger counts.');
            state.TurnOrderTrigger.triggeredCount = {};
            state.TurnOrderTrigger.roundNumber = 1;
            state.TurnOrderTrigger.topOfRoundTokenId = null; // Reset top of round
            return;
        }

        const prevTurnOrderStr = prev.turnorder || "[]";

        let newTurnOrder, prevTurnOrder;
        try {
            newTurnOrder = JSON.parse(newTurnOrderStr);
            prevTurnOrder = JSON.parse(prevTurnOrderStr);
        } catch (e) {
            log(`❌ Error parsing turn order JSON: ${e}`);
            return;
        }

        if (newTurnOrder.length === 0) return;

        const currentTurnTokenId = newTurnOrder[0].id;
        const prevTurnTokenId = (prevTurnOrder.length > 0) ? prevTurnOrder[0].id : null;

        // Trigger only if the token at the top of the order has changed
        if (currentTurnTokenId === prevTurnTokenId && prevTurnOrder.length > 0) {
            return;
        }
        
        if (currentTurnTokenId === "-1") return; // Ignore custom items

        // --- New Round Calculation Logic ---
        // Find the token with the highest initiative to mark the top of the round
        if (state.TurnOrderTrigger.topOfRoundTokenId === null || !newTurnOrder.some(t => t.id === state.TurnOrderTrigger.topOfRoundTokenId)) {
            let topInitiative = -Infinity;
            let topToken = null;
            newTurnOrder.forEach(turn => {
                if (turn.id !== "-1") {
                    const initiative = parseFloat(turn.pr) || 0;
                    if (initiative > topInitiative) {
                        topInitiative = initiative;
                        topToken = turn;
                    }
                }
            });
            if (topToken) {
                state.TurnOrderTrigger.topOfRoundTokenId = topToken.id;
                log(`👑 New top of round set to Token ID: ${topToken.id} (Initiative: ${topInitiative})`);
            }
        }
        
        // Increment round number only when the current token is the one that started the round
        // and it's not the very first turn of the combat.
        if (currentTurnTokenId === state.TurnOrderTrigger.topOfRoundTokenId && prevTurnTokenId !== null) {
            state.TurnOrderTrigger.roundNumber++;
            log(`🔄 Round ${state.TurnOrderTrigger.roundNumber} begins.`);
        }

        log(`▶️ New turn for token: ${currentTurnTokenId} (Round: ${state.TurnOrderTrigger.roundNumber})`);
        const token = getObj('graphic', currentTurnTokenId);
        if (!token) {
            log(`⚠️ Could not find token with ID ${currentTurnTokenId}`);
            return;
        }

        let gmNotes = token.get('gmnotes');
        if (!gmNotes) return;

        if (TriggerControlConfig.DEBUG) {
            log(`[DEBUG] Raw GMNotes for token ${currentTurnTokenId}: ${gmNotes}`);
        }

        // Decode and strip HTML from GM notes
        let decodedNotes = decodeURIComponent(gmNotes);

        // Manually decode common HTML entities that might be in the notes
        decodedNotes = decodedNotes
            .replace(/&gt;/g, '>')
            .replace(/&lt;/g, '<')
            .replace(/&amp;/g, '&');

        gmNotes = decodedNotes.replace(/(<([^>]+)>)/ig, '').trim();

        if (TriggerControlConfig.DEBUG) {
            log(`[DEBUG] Cleaned GMNotes for parsing: ${gmNotes}`);
        }

        const match = gmNotes.match(/\[TOT(?::\s*([^\]]+))?\]\s*(.*)/);
        if (!match) return;
        
        log(`Found TOT trigger for token ${currentTurnTokenId}`);

        const settingsStr = match[1] || '';
        const command = match[2].trim();
        const settings = settingsStr.split(',').map(s => s.trim().toLowerCase());

        if (TriggerControlConfig.DEBUG) {
            log(`[DEBUG] Parsed Settings String: "${settingsStr}"`);
            log(`[DEBUG] Parsed Settings Array: ${JSON.stringify(settings)}`);
        }

        // Parse settings
        let maxTriggers = Infinity;
        let visibility = 'all';
        let playerId = null;
        let minRound = 0;

        settings.forEach(setting => {
            // Make the regex flexible to handle spaces like "round > 2"
            const roundMatch = setting.match(/^round\s*>\s*(\d+)$/);

            if (setting === 'once') {
                maxTriggers = 1;
            } else if (setting === 'gm') {
                visibility = 'gm';
            } else if (setting === 'player') {
                visibility = 'player';
                playerId = token.get('controlledby') ? token.get('controlledby').split(',')[0] : null;
            } else if (setting === 'all') {
                visibility = 'all';
            } else if (roundMatch && roundMatch[1]) {
                // This condition is now checked before the generic number check
                minRound = parseInt(roundMatch[1]);
            } else if (!isNaN(parseInt(setting))) {
                maxTriggers = parseInt(setting);
            }
            if (TriggerControlConfig.DEBUG) {
                log(`[DEBUG] Processed setting "${setting}". Current values: minRound=${minRound}, maxTriggers=${maxTriggers}`);
            }
        });

        // Check round condition
        if (state.TurnOrderTrigger.roundNumber <= minRound) {
            log(`➡️ Token ${currentTurnTokenId} trigger requires round > ${minRound} (current: ${state.TurnOrderTrigger.roundNumber}). Skipping.`);
            return;
        }

        // Check trigger count
        const currentCount = state.TurnOrderTrigger.triggeredCount[currentTurnTokenId] || 0;
        if (currentCount >= maxTriggers) {
            log(`➡️ Token ${currentTurnTokenId} has reached max triggers (${maxTriggers}). Skipping.`);
            return;
        }

        // Increment trigger count
        state.TurnOrderTrigger.triggeredCount[currentTurnTokenId] = currentCount + 1;

        if (command) {
            log(`⚡ Firing TOT command for token ${currentTurnTokenId} (${currentCount + 1}/${maxTriggers}): ${command}`);
            utils.executeCommand(command, { token: currentTurnTokenId }, 'TurnOrderTrigger', visibility, playerId);
        }
    });
});