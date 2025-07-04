// src/trap-commands.js
// Command parsing and API routing system for TrapSystem v2

import TrapUtils from './trap-utils.js';
import { Config, State } from './trap-core.js';
import { triggers } from './trap-triggers.js';
import { PassiveDetection } from './trap-detection.js';
import { macros, macroExport } from './trap-macros.js';

// Create TrapSystem reference for compatibility
const TrapSystem = {
    state: State,
    config: Config,
    utils: TrapUtils
};

export const Commands = {
    /**
     * Main command parser and router
     * @param {object} msg - The Roll20 chat message object
     */
    handleChatMessage(msg) {
        // Process API commands for token ordering (for macro export system)
        if (msg.type === "api" && msg.content.includes("!token-mod") && msg.content.includes("--order")) {
            macroExport.processOrderCommand(msg.content);
        }

        // Handle different message types
        if (msg.type === "advancedroll") {
            return this.handleAdvancedRoll(msg);
        }
        if (msg.type === "rollresult") {
            return this.handleRollResult(msg);
        }
        if (msg.type !== "api") {
            return; // Not an API command
        }

        // Parse command arguments with proper quote handling
        const args = this.parseCommandArgs(msg.content);
        const command = args[0];

        if (command === "!trapsystem") {
            this.handleTrapSystemCommand(msg, args);
        }
    },

    /**
     * Parse command arguments with proper quote handling
     * @param {string} content - The raw command content
     * @returns {Array} - Array of parsed arguments
     */
    parseCommandArgs(content) {
        return (content.match(/[^\s"]+|"([^"]*)"/g) || []).map(arg => 
            (arg.startsWith('"') && arg.endsWith('"')) ? arg.slice(1, -1) : arg
        );
    },

    /**
     * Handle the main !trapsystem command
     * @param {object} msg - The Roll20 chat message object
     * @param {Array} args - Parsed command arguments
     */
    handleTrapSystemCommand(msg, args) {
        TrapUtils.log(`[API Handler] Received !trapsystem command. Action: ${args[1] || 'help'}. Full args: ${JSON.stringify(args)}`, 'debug');
        
        if (!args[1]) {
            this.showHelpMenu("API");
            return;
        }

        const action = args[1];
        const selectedToken = msg.selected && msg.selected.length > 0 ? getObj("graphic", msg.selected[0]._id) : null;

        // Commands that don't require a selected token
        const noTokenCommands = [
            "enable", "disable", "toggle", "status", "help", "allowall", 
            "exportmacros", "resetstates", "resetmacros", "fullreset", 
            "allowmovement", "resetdetection", "interact", "hidedetection", 
            "showdetection", "passivemenu", "setpassive"
        ];

        if (!selectedToken && !noTokenCommands.includes(action.toLowerCase())) {
            TrapUtils.chat('❌ Error: No token selected for this action!');
            TrapUtils.log(`[API Handler] Action '${action}' requires a selected token, but none was found.`, 'warn');
            return;
        }

        // Route to appropriate handler
        switch (action.toLowerCase()) {
            // Trap Setup Commands
            case "setup":
                this.handleSetupTrap(selectedToken, args);
                break;
            case "setupinteraction":
                this.handleSetupInteractionTrap(selectedToken, args);
                break;

            // Trap Control Commands
            case "toggle":
                this.handleToggleTrap(selectedToken, args);
                break;
            case "status":
                this.handleTrapStatus(selectedToken, args);
                break;
            case "trigger":
                this.handleManualTrigger(selectedToken);
                break;
            case "showmenu":
                this.handleShowMenu(selectedToken);
                break;

            // Movement Commands
            case "allowmovement":
                this.handleAllowMovement(args, msg);
                break;
            case "allowall":
                this.handleAllowAll();
                break;

            // System Control Commands
            case "enable":
                this.handleEnableTriggers();
                break;
            case "disable":
                this.handleDisableTriggers();
                break;

            // Interaction Commands
            case "interact":
                this.handleInteract(args, msg);
                break;
            case "allow":
                this.handleAllowAction(args);
                break;
            case "fail":
                this.handleFailAction(args);
                break;
            case "selectcharacter":
                this.handleSelectCharacter(args);
                break;
            case "check":
                this.handleSkillCheck(args, msg);
                break;
            case "customcheck":
                this.handleCustomCheck(args);
                break;
            case "rollcheck":
                this.handleRollCheck(args, msg);
                break;
            case "setdc":
                this.handleSetDC(args);
                break;
            case "displaydc":
                this.handleDisplayDC(args);
                break;

            // Passive Detection Commands
            case "passivemenu":
                this.handlePassiveMenu(msg);
                break;
            case "setpassive":
                this.handleSetPassive(args, msg);
                break;
            case "resetdetection":
                this.handleResetDetection(selectedToken, msg);
                break;
            case "hidedetection":
                this.handleHideDetection(args, msg);
                break;
            case "showdetection":
                this.handleShowDetection(msg);
                break;

            // Advanced Commands
            case "marktriggered":
                this.handleMarkTriggered(msg);
                break;
            case "manualtrigger":
                this.handleManualMacroTrigger(msg);
                break;
            case "ignoretraps":
                this.handleIgnoreTraps(selectedToken);
                break;
            case "rearm":
                this.handleRearmTrap(args);
                break;
            case "resolvemismatch":
                this.handleResolveMismatch(args);
                break;

            // Export/Reset Commands
            case "exportmacros":
                if (!TrapSystem.utils.playerIsGM(msg.playerid)) {
                    TrapSystem.utils.whisper(msg.playerid, "❌ Only GMs can use macro export commands.");
                    return;
                }
                macroExport.exportMacros();
                break;
            case "resetstates":
                if (!TrapSystem.utils.playerIsGM(msg.playerid)) {
                    TrapSystem.utils.whisper(msg.playerid, "❌ Only GMs can use macro export commands.");
                    return;
                }
                macroExport.resetTokenStates();
                break;
            case "resetmacros":
                if (!TrapSystem.utils.playerIsGM(msg.playerid)) {
                    TrapSystem.utils.whisper(msg.playerid, "❌ Only GMs can use macro export commands.");
                    return;
                }
                macroExport.resetMacros();
                break;
            case "fullreset":
                if (!TrapSystem.utils.playerIsGM(msg.playerid)) {
                    TrapSystem.utils.whisper(msg.playerid, "❌ Only GMs can use macro export commands.");
                    return;
                }
                macroExport.fullReset();
                break;

            // Help Command
            case "help":
                this.showHelpMenu("TrapSystem");
                break;

            default:
                TrapUtils.chat(`❌ Unknown command: ${action}\nUse !trapsystem help for command list`);
        }
    },

    // =====================================================================
    // COMMAND HANDLERS
    // =====================================================================

    /**
     * Handle setup trap command
     */
    handleSetupTrap(selectedToken, args) {
        TrapUtils.log(`[API Handler] Attempting to call setupTrap. Token ID: ${selectedToken ? selectedToken.id : 'null'}. Args for func: ${args.slice(2).join(', ')}`, 'debug');
        try {
            triggers.setupTrap(
                selectedToken,
                args[2], // uses
                args[3], // mainMacro
                args[4], // optional2
                args[5], // optional3
                args[6], // movement
                args[7]  // autoTrigger
            );
        } catch (e) {
            TrapUtils.log(`[API Handler] ERROR calling setupTrap: ${e.message} ${e.stack}`, 'error');
            TrapUtils.chat('❌ An internal error occurred while trying to setup the standard trap.');
        }
    },

    /**
     * Handle setup interaction trap command
     */
    handleSetupInteractionTrap(selectedToken, args) {
        TrapUtils.log(`[API Handler] Attempting to call setupInteractionTrap. Token ID: ${selectedToken ? selectedToken.id : 'null'}. Raw args for parsing: ${args.slice(2).join(', ')}`, 'debug');
        try {
            if (args.length < 8) {
                TrapUtils.chat('❌ Error: Missing parameters for interaction trap setup.');
                return;
            }

            const uses = args[2];
            const primaryMacro = args[3];
            const successMacro = args[4];
            const failureMacro = args[5];

            const autoTriggerEnabled = args[args.length - 1];
            const movement = args[args.length - 2];
            const movementTriggerEnabled = args[args.length - 3];
            
            // Parse skill checks from middle arguments
            const checkArgs = args.slice(6, args.length - 3);
            const checks = this.parseSkillChecks(checkArgs);

            const check1Type = checks[0] ? checks[0].type : "None";
            const check1DC = checks[0] ? checks[0].dc : "10";
            const check2Type = checks[1] ? checks[1].type : "None";
            const check2DC = checks[1] ? checks[1].dc : "10";

            TrapUtils.log(`[API Handler] Parsed for setupInteractionTrap - Uses: ${uses}, PrimaryM: ${primaryMacro}, SuccessM: ${successMacro}, FailM: ${failureMacro}, C1Type: '${check1Type}', C1DC: ${check1DC}, C2Type: '${check2Type}', C2DC: ${check2DC}, MoveEnabled: ${movementTriggerEnabled}, AutoTrigger: ${autoTriggerEnabled}`, 'debug');

            triggers.setupInteractionTrap(
                selectedToken, uses,
                primaryMacro, successMacro, failureMacro,
                check1Type, check1DC,
                check2Type, check2DC,
                movementTriggerEnabled,
                movement, autoTriggerEnabled
            );
        } catch (e) {
            TrapUtils.log(`[API Handler] ERROR in setupInteractionTrap case: ${e.message} ${e.stack}`, 'error');
            TrapUtils.chat('❌ An internal error occurred while trying to setup the interaction trap.');
        }
    },

    /**
     * Parse skill checks from command arguments
     */
    parseSkillChecks(checkArgs) {
        const checks = [];
        let currentSkillParts = [];
        
        for (const arg of checkArgs) {
            if (!isNaN(parseInt(arg))) {
                // It's a DC number
                if (currentSkillParts.length > 0) {
                    const skillName = currentSkillParts.join(' ');
                    if (skillName.toLowerCase() !== 'none') {
                        checks.push({ type: skillName, dc: arg });
                    }
                    currentSkillParts = [];
                }
            } else {
                // It's part of skill name
                currentSkillParts.push(arg);
            }
        }
        return checks;
    },

    /**
     * Handle toggle trap command
     */
    handleToggleTrap(selectedToken, args) {
        const tid = args[2] || (selectedToken && selectedToken.id);
        if (!tid) {
            TrapUtils.chat('❌ No token selected or provided to toggle');
            return;
        }
        const tk = getObj("graphic", tid);
        triggers.toggleTrap(tk);
    },

    /**
     * Handle trap status command
     */
    handleTrapStatus(selectedToken, args) {
        const tid = args[2] || (selectedToken && selectedToken.id);
        if (!tid) {
            TrapUtils.chat('❌ No token selected or provided for status');
            return;
        }
        const tk = getObj("graphic", tid);
        triggers.getTrapStatus(tk);
    },

    /**
     * Handle manual trigger command
     */
    handleManualTrigger(selectedToken) {
        if (!selectedToken) {
            TrapUtils.chat('❌ No token selected for trigger');
            return;
        }
        triggers.manualTrigger(selectedToken);
    },

    /**
     * Handle show menu command
     */
    handleShowMenu(selectedToken) {
        if (!selectedToken) {
            TrapUtils.chat('❌ No token selected for showmenu');
            return;
        }
        // Get the interaction system from global TrapSystem
        const interactionSystem = globalThis.TrapSystem?.menu;
        if (interactionSystem && typeof interactionSystem.showInteractionMenu === 'function') {
            interactionSystem.showInteractionMenu(selectedToken);
        } else {
            TrapUtils.chat('❌ Interaction system not available');
        }
    },

    /**
     * Handle allow movement command
     */
    handleAllowMovement(args, msg) {
        const movementTokenId = args[2] && args[2].trim();
        if (movementTokenId === 'selected') {
            if (!msg.selected || msg.selected.length === 0) {
                TrapUtils.chat("❌ Error: No token selected!");
                return;
            }
            triggers.allowMovement(msg.selected[0]._id);
        } else if (movementTokenId) {
            triggers.allowMovement(movementTokenId);
        } else {
            TrapUtils.chat("❌ Error: No token specified!");
        }
    },

    /**
     * Handle allow all movement command
     */
    handleAllowAll() {
        triggers.allowAllMovement();
    },

    /**
     * Handle enable triggers command
     */
    handleEnableTriggers() {
        triggers.enableTriggers();
    },

    /**
     * Handle disable triggers command
     */
    handleDisableTriggers() {
        triggers.disableTriggers();
    },

    /**
     * Handle interact command
     */
    handleInteract(args, msg) {
        if (args.length < 4) {
            TrapUtils.chat("❌ Missing parameters for interact");
            return;
        }
        const intToken = getObj("graphic", args[2]);
        if (!intToken) {
            TrapUtils.chat("❌ Invalid trap token ID!");
            return;
        }
        // Get the interaction system from global TrapSystem
        const interactionSystem = globalThis.TrapSystem?.menu;
        if (interactionSystem && typeof interactionSystem.handleInteraction === 'function') {
            interactionSystem.handleInteraction(intToken, args[3], msg.playerid, args[4]);
        } else {
            TrapUtils.chat('❌ Interaction system not available');
        }
    },

    /**
     * Handle allow action command
     */
    handleAllowAction(args) {
        if (args.length < 4) {
            TrapUtils.chat("❌ Missing parameters for allow command!");
            return;
        }
        const allowToken = getObj("graphic", args[2]);
        if (!allowToken) {
            TrapUtils.chat("❌ Invalid trap token ID!");
            return;
        }
        // Get the interaction system from global TrapSystem
        const interactionSystem = globalThis.TrapSystem?.menu;
        if (interactionSystem && typeof interactionSystem.handleAllowAction === 'function') {
            interactionSystem.handleAllowAction(allowToken, args[3], args[4]);
        } else {
            TrapUtils.chat('❌ Interaction system not available');
        }
    },

    /**
     * Handle fail action command
     */
    handleFailAction(args) {
        if (args.length < 4) {
            TrapUtils.chat("❌ Error: Missing parameters for fail command!");
            return;
        }
        const failToken = getObj("graphic", args[2]);
        if (!failToken) {
            TrapUtils.chat("❌ Error: Invalid trap token ID!");
            return;
        }
        // Get the interaction system from global TrapSystem
        const interactionSystem = globalThis.TrapSystem?.menu;
        if (interactionSystem && typeof interactionSystem.handleFailAction === 'function') {
            interactionSystem.handleFailAction(failToken, args[3], args[4]);
        } else {
            TrapUtils.chat('❌ Interaction system not available');
        }
    },

    /**
     * Handle passive menu command
     */
    handlePassiveMenu(msg) {
        if (!msg.selected || msg.selected.length === 0) {
            TrapUtils.chat("❌ Please select a trap token to configure its passive settings.", msg.playerid);
            return;
        }
        const trapForPassiveMenu = getObj("graphic", msg.selected[0]._id);
        PassiveDetection.showPassiveSetupMenu(trapForPassiveMenu, msg.playerid);
    },

    /**
     * Handle set passive property command
     */
    handleSetPassive(args, msg) {
        if (args.length < 4) {
            TrapUtils.chat("❌ Insufficient arguments for setpassive. Expected: property trapId value(s)", msg.playerid);
            return;
        }
        PassiveDetection.handleSetPassiveProperty(args.slice(2), msg.playerid);
    },

    /**
     * Handle reset detection command
     */
    handleResetDetection(selectedToken, msg) {
        PassiveDetection.handleResetDetection(selectedToken, msg.playerid);
    },

    /**
     * Handle hide detection command
     */
    handleHideDetection(args, msg) {
        const duration = args[2] || 0;
        PassiveDetection.hideAllAuras(duration, msg.playerid);
    },

    /**
     * Handle show detection command
     */
    handleShowDetection(msg) {
        PassiveDetection.showAllAuras(msg.playerid);
    },

    /**
     * Handle mark triggered command
     */
    handleMarkTriggered(msg) {
        const parts = msg.content.split(' ');
        if (parts.length < 5) {
            TrapUtils.chat('❌ marktriggered: Missing tokenId, trapId, or identifier!');
            return;
        }
        const tokenId = parts[2];
        const trapId = parts[3];
        const macroIdentifier = parts.slice(4).join(' ');
        triggers.markTriggered(tokenId, trapId, macroIdentifier);
    },

    /**
     * Handle manual macro trigger command
     */
    handleManualMacroTrigger(msg) {
        const parts = msg.content.split(' ');
        if (parts.length < 4) {
            TrapUtils.chat("❌ Missing parameters for manualtrigger!");
            return;
        }
        const trapId = parts[2];
        const macroIdentifier = parts.slice(3).join(' ');
        triggers.manualMacroTrigger(trapId, macroIdentifier);
    },

    /**
     * Handle ignore traps command
     */
    handleIgnoreTraps(selectedToken) {
        if (!selectedToken) {
            TrapUtils.chat('❌ No token selected for ignoretraps');
            return;
        }
        TrapUtils.toggleIgnoreTraps(selectedToken);
    },

    /**
     * Handle rearm trap command
     */
    handleRearmTrap(args) {
        const tid = args[2];
        if (!tid) {
            TrapUtils.chat('❌ No trap ID provided to rearm.');
            return;
        }
        const tk = getObj("graphic", tid);
        if (!tk || !TrapUtils.isTrap(tk)) {
            TrapUtils.chat('❌ Could not find a valid trap with that ID to rearm.');
            return;
        }
        triggers.toggleTrap(tk);
    },

    /**
     * Handle resolve mismatch command (for roll conflicts)
     */
    handleResolveMismatch(args) {
        const entityId = args[2];
        const trapTokenId = args[3];
        const action = args[4];
        const rollValue = args[5] ? parseInt(args[5], 10) : null;
        const rollType = args[6] || 'normal';
        const isAdvantageRoll = args[7] === '1';
        
        let pendingCheck = State.pendingChecksByChar[entityId] || State.pendingChecks[entityId];
        const trapToken = getObj("graphic", trapTokenId);
        
        if (!pendingCheck || !trapToken) {
            TrapUtils.chat('❌ Could not resolve mismatch: missing pending check or trap token.');
            return;
        }

        if (action === 'accept') {
            const rollData = {
                total: rollValue,
                firstRoll: rollValue,
                secondRoll: null,
                isAdvantageRoll: isAdvantageRoll,
                rollType: rollType,
                characterid: pendingCheck.characterId,
                playerid: pendingCheck.playerid,
                rolledSkillName: pendingCheck.config.checks[0].type
            };
            TrapUtils.chat('✅ GM accepted the roll. Processing result...');
            
            // Get the interaction system from global TrapSystem
            const interactionSystem = globalThis.TrapSystem?.menu;
            if (interactionSystem && typeof interactionSystem.handleRollResult === 'function') {
                interactionSystem.handleRollResult(rollData, pendingCheck.playerid);
            }
        } else if (action === 'reject') {
            let playerid = pendingCheck.playerid;
            let checkIndex = pendingCheck.checkIndex || 0;
            let advantageType = pendingCheck.advantage || 'normal';

            // Get the interaction system from global TrapSystem
            const interactionSystem = globalThis.TrapSystem?.menu;
            if (interactionSystem && typeof interactionSystem.handleRollCheck === 'function') {
                interactionSystem.handleRollCheck(trapToken, checkIndex, advantageType, playerid);
            }
        }
    },

    /**
     * Show the help menu
     */
    showHelpMenu(target = 'API') {
        const skillListForQuery = Object.keys(Config.SKILL_TYPES).join('|');
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
            '{{🔄 **Export/Reset Commands**=',
            '[Export Macros](!trapsystem exportmacros) - Capture current macro states and token positions',
            '[Reset States](!trapsystem resetstates) - Reset tokens/doors to exported positions',  
            '[Reset Macros](!trapsystem resetmacros) - Reset macro actions to exported versions',
            '[Full Reset](!trapsystem fullreset) - Reset both states and macros completely',
            '}}',
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

    /**
     * Handle select character command
     */
    handleSelectCharacter(args) {
        if (args.length < 5) {
            TrapUtils.chat("❌ Missing parameters for selectcharacter!");
            return;
        }
        
        const trapToken = getObj("graphic", args[2]);
        const character = getObj("character", args[3]);
        const playerid = args[4];
        const triggeredTokenId = args[5] || null;

        if (!trapToken || !character) {
            TrapUtils.chat("❌ Invalid token or character ID!");
            return;
        }
        
        if (!State.pendingChecks[playerid]) {
            State.pendingChecks[playerid] = {};
        }
        
        State.pendingChecks[playerid].characterId = character.id;
        State.pendingChecks[playerid].characterName = character.get("name");
        State.pendingChecks[playerid].triggeredTokenId = triggeredTokenId;
        
        if (State.pendingChecksByChar && character.id) {
            State.pendingChecksByChar[character.id] = {
                ...State.pendingChecks[playerid],
                token: trapToken
            };
        }

        TrapUtils.log(`Stored character info - ID:${character.id}, Name:${character.get("name")}, Victim:${triggeredTokenId}`, 'debug');
        
        // Get the interaction system from global TrapSystem
        const interactionSystem = globalThis.TrapSystem?.menu;
        if (interactionSystem && typeof interactionSystem.showGMResponseMenu === 'function') {
            interactionSystem.showGMResponseMenu(trapToken, playerid, triggeredTokenId);
        } else {
            TrapUtils.chat('❌ Interaction system not available');
        }
    },

    /**
     * Handle skill check command
     */
    handleSkillCheck(args, msg) {
        if (args.length < 5) {
            TrapUtils.chat("❌ Missing parameters for check command!");
            return;
        }
        
        const cToken = getObj("graphic", args[2]);
        if (!cToken) {
            TrapUtils.chat("❌ Invalid trap token ID!");
            return;
        }
        
        let playerid = args[4];
        if (playerid === 'null' || !playerid) {
            playerid = msg.playerid;
            TrapUtils.log(`[FIX] 'check' command playerid was invalid, using msg.playerid: ${playerid}`, 'debug');
        }
        
        const triggeredTokenId = args.length > 5 ? args[5] : null;
        
        // Get the interaction system from global TrapSystem
        const interactionSystem = globalThis.TrapSystem?.menu;
        if (interactionSystem && typeof interactionSystem.handleSkillCheck === 'function') {
            interactionSystem.handleSkillCheck(cToken, parseInt(args[3], 10), playerid, false, false, 'gm', triggeredTokenId);
        } else {
            TrapUtils.chat('❌ Interaction system not available');
        }
    },

    /**
     * Handle custom check command
     */
    handleCustomCheck(args) {
        if (args.length < 7) {
            TrapUtils.chat("❌ Missing parameters for customcheck command! Requires at least skill and DC.");
            return;
        }
        
        const cToken = getObj("graphic", args[2]);
        if (!cToken) {
            TrapUtils.chat("❌ Invalid trap token ID for customcheck!");
            return;
        }
        
        const playerid = args[3];
        const triggeredTokenId = args[4] !== 'null' ? args[4] : null;
        const dc = args[args.length - 1];
        const skillType = args.slice(5, args.length - 1).join(' ');

        // Get the interaction system from global TrapSystem
        const interactionSystem = globalThis.TrapSystem?.menu;
        if (interactionSystem && typeof interactionSystem.handleCustomCheck === 'function') {
            interactionSystem.handleCustomCheck(cToken, playerid, triggeredTokenId, skillType, dc);
        } else {
            TrapUtils.chat('❌ Interaction system not available');
        }
    },

    /**
     * Handle roll check command
     */
    handleRollCheck(args, msg) {
        if (args.length < 6) {
            TrapUtils.chat("❌ Missing parameters for rollcheck!");
            return;
        }
        
        const rToken = getObj("graphic", args[2]);
        if (!rToken) {
            TrapUtils.chat("❌ Invalid trap token ID!");
            return;
        }
        
        const checkIndex = args[3];
        const advantage = args[4];
        let playerid = args[5];
        const triggeredTokenId = args.length > 6 ? args[6] : null;

        if (playerid === 'null' || !playerid) {
            playerid = msg.playerid;
            TrapUtils.log(`[FIX] rollcheck playerid was invalid, using msg.playerid: ${playerid}`, 'debug');
        }
        
        // Get the interaction system from global TrapSystem
        const interactionSystem = globalThis.TrapSystem?.menu;
        if (interactionSystem && typeof interactionSystem.handleRollCheck === 'function') {
            interactionSystem.handleRollCheck(rToken, checkIndex, advantage, playerid, 0, triggeredTokenId);
        } else {
            TrapUtils.chat('❌ Interaction system not available');
        }
    },

    /**
     * Handle set DC command
     */
    handleSetDC(args) {
        if (args.length < 5) {
            TrapUtils.chat("❌ Missing parameters for setdc command!");
            return;
        }
        
        const dToken = getObj("graphic", args[2]);
        if (!dToken) {
            TrapUtils.chat("❌ Invalid trap token ID!");
            return;
        }
        
        // Get the interaction system from global TrapSystem
        const interactionSystem = globalThis.TrapSystem?.menu;
        if (interactionSystem && typeof interactionSystem.handleSetDC === 'function') {
            interactionSystem.handleSetDC(dToken, args[3], args[4], args[5], args[6] || null);
        } else {
            TrapUtils.chat('❌ Interaction system not available');
        }
    },

    /**
     * Handle display DC command
     */
    handleDisplayDC(args) {
        if (args.length < 5) {
            TrapUtils.chat("❌ Missing parameters for displaydc!");
            return;
        }
        
        const dToken = getObj("graphic", args[2]);
        if (!dToken) {
            TrapUtils.chat("❌ Invalid trap token ID for displaydc!");
            return;
        }
        
        // Get the interaction system from global TrapSystem
        const interactionSystem = globalThis.TrapSystem?.menu;
        if (interactionSystem && typeof interactionSystem.handleDisplayDC === 'function') {
            interactionSystem.handleDisplayDC(dToken, args[3], args[4]);
        } else {
            TrapUtils.chat('❌ Interaction system not available');
        }
    },
};

export default Commands;