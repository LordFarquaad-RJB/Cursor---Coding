// =================================================================================
// Enhanced TriggerControl Script v2.1.0
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
//    Settings:
//    - once: Command only fires once per combat (resets when turn order is cleared)
//
//    Examples:
//    - [TOT: once] #StartOfTurnMacro
//    - [TOT] !token-mod --set statusmarkers|=blue
//    - [TOT] &{template:default} {{name=Turn Effect}} {{text=Your turn begins!}}
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
// =================================================================================

on("ready", () => {
    log("✅ Enhanced TriggerControl Script v2.1.0 Loaded.");
    if (typeof CommandMenu !== 'undefined' && CommandMenu.utils && CommandMenu.utils.addInitStatus) {
        CommandMenu.utils.addInitStatus('TriggerControl', 'success', null, 'success');
    }

    // Initialize state for Turn Order Trigger
    if (!state.TurnOrderTrigger) {
        state.TurnOrderTrigger = {
            triggeredOnce: {} // Key: token ID, Value: boolean
        };
        log("⚙️ Turn Order Trigger state initialized.");
    }

    const utils = {
        /**
         * Executes a command string, which can be a macro, an API command, or plain text.
         * Handles placeholder replacement for token IDs.
         * @param {string} commandString - The command to execute (e.g., "#MyMacro", "!token-mod...", "Hello world").
         * @param {object} tagToIdMap - A map of placeholder tags to token IDs (e.g., { token: '...' }).
         * @param {string} sender - The "who" to display in the chat for the command.
         */
        executeCommand(commandString, tagToIdMap = {}, sender = 'TriggerControl') {
            try {
                let macroText;
                commandString = (commandString || '').trim();

                if (!commandString) return;

                if (commandString.startsWith('#')) {
                    const macroName = commandString.substring(1);
                    const macro = findObjs({ _type: "macro", name: macroName })[0];
                    if (!macro) {
                        log(`❌ Macro not found: ${macroName}`);
                        sendChat(sender, `/w gm Error: Macro named '${macroName}' not found.`);
                        return;
                    }
                    macroText = macro.get("action");
                } else {
                    macroText = commandString;
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

                if (chatMessage.trim()) {
                    sendChat(sender, chatMessage);
                }

                apiCommands.forEach(apiCmd => {
                    let finalCmd = apiCmd.trim();
                    if (finalCmd.startsWith('$')) {
                        finalCmd = '!' + finalCmd.substring(1);
                    }
                    sendChat(sender, finalCmd);
                });

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
        log(`🔎 Handling table item as command: "${itemName}"`);
        utils.executeCommand(itemName, {}, 'TableTrigger');
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
        let items = findObjs({ type: 'tableitem', rollabletableid: tableId }),
            weightedList = [];
        
        if (items.length > 0) {
            _.each(items, function(item) {
                let weight = item.get('weight');
                _(weight).times(function() {
                    weightedList.push(item.id);
                });
            });
        
            let chosenItem = getObj('tableitem', weightedList[randomInteger(weightedList.length) - 1]);
            let resultText = handleMacro(chosenItem.get('name'));
            
            sendChat(msgFrom, resultText);
            handleItemName(resultText); // Check for ! commands in the result
        } else {
            sendChat(msgFrom, 'No items on this table.');
        }
    }

    // Function to find and roll a table by name
    function findTable(msgFrom, tableName) {
        let tables = findObjs({ type: 'rollabletable', name: tableName }, { caseInsensitive: true });
        
        if (tables.length < 1) {
            sendChat(msgFrom, 'No such table exists.');
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
        // Log everything for debugging
        log(`🔎 Chat message: ${JSON.stringify(msg, null, 2)}`);

        // Handle API commands
        if (msg.type === 'api' && !msg.rolltemplate) {
            let params = msg.content.substring(1).split(' '),
                command = params[0].toLowerCase();
            
            if (command === 'rtm') {
                let tableName = params[1] ? params[1].toLowerCase() : '',
                    msgFrom = getFrom(params, msg.playerid);
                findTable(msgFrom, tableName);
            }
            return;
        }

        // Handle table rolls
        if (msg.type === "rollresult" && msg.content) {
            parseRollresult(msg.content);
            return;
        }

        if ((msg.type === "general" || msg.type === "whisper") && msg.inlinerolls) {
            parseInlinerolls(msg.inlinerolls);
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

        // Initialize state if it's not already
        if (!state.TurnOrderTrigger) {
            state.TurnOrderTrigger = {
                triggeredOnce: {}
            };
            log("⚙️ Turn Order Trigger state initialized.");
        }

        const newTurnOrderStr = obj.get('turnorder');
        if (newTurnOrderStr === "" || newTurnOrderStr === "[]") {
            log('↪️ Turn order cleared. Resetting "once" triggers.');
            state.TurnOrderTrigger.triggeredOnce = {};
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
        if (currentTurnTokenId === prevTurnTokenId) {
            return;
        }
        
        if (currentTurnTokenId === "-1") return; // Ignore custom items

        log(`▶️ New turn for token: ${currentTurnTokenId}`);
        const token = getObj('graphic', currentTurnTokenId);
        if (!token) {
            log(`⚠️ Could not find token with ID ${currentTurnTokenId}`);
            return;
        }

        let gmNotes = token.get('gmnotes');
        if (!gmNotes) return;

        // Decode and strip HTML from GM notes
        gmNotes = unescape(gmNotes).replace(/(<([^>]+)>)/ig, '').trim();

        const match = gmNotes.match(/\[TOT(?::\s*([^\]]+))?\]\s*(.*)/);
        if (!match) return;
        
        log(`Found TOT trigger for token ${currentTurnTokenId}`);

        const settingsStr = match[1] || '';
        const command = match[2].trim();
        const settings = settingsStr.split(',').map(s => s.trim().toLowerCase());

        if (settings.includes('once')) {
            if (state.TurnOrderTrigger.triggeredOnce[currentTurnTokenId]) {
                log(`➡️ Token ${currentTurnTokenId} has "once" trigger and has already fired. Skipping.`);
                return;
            }
            state.TurnOrderTrigger.triggeredOnce[currentTurnTokenId] = true;
        }

        if (command) {
            log(`⚡ Firing TOT command for token ${currentTurnTokenId}: ${command}`);
            utils.executeCommand(command, { token: currentTurnTokenId }, 'TurnOrderTrigger');
        }
    });
});