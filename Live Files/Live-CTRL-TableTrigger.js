on("ready", () => {
    log("✅ Enhanced Table Trigger Script v2.0.0 Loaded.");
    if (typeof CommandMenu !== 'undefined' && CommandMenu.utils && CommandMenu.utils.addInitStatus) {
        CommandMenu.utils.addInitStatus('TableTrigger', 'success', null, 'success');
    }

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
        log(`🔎 Checking table item: "${itemName}"`);
        let exIdx = itemName.indexOf("!");
        if (exIdx === -1) {
            log("🔎 No '!' found, ignoring.");
            return;
        }
        let command = itemName.slice(exIdx).trim();
        if (command.startsWith("!")) {
            log(`⚡ Re-sending command: ${command}`);
            sendChat("TableTrigger", command);
        } else {
            log(`❌ After extraction, doesn't start with '!': "${command}"`);
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
});
