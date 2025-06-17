/**
 * CommandMenu.js
 * Control panel style menu system for Roll20
 * Add notes about the experimental API test here.
 */

const CommandMenu = {
    // Configuration
    config: {
        LOG_LEVEL: "info",
        GM_ONLY: true,
        MENU_SECTIONS: {
            SHOP: "shop",
            TRAP: "trap",
            TOKEN_FX: "tokenFX",
            TOKEN_MOD: "tokenMod",
            AUDIO: "audio",
            COMBAT: "combat",
            UTILITY: "utility",
            LIGHTING: "lighting",
            SYSTEM: "system"
        },
        KNOWN_SYSTEMS: {
            'TokenMod': { version: 'v0.8.84' },
            'Roll20AM': { version: 'v2.15' },
            'GroupCheck': { version: 'v1.15' },
            'GroupInitiative': { version: 'v0.9.41' },
            'APIHeartBeat': { version: 'v0.5.2' },
            'TokenFX': { version: 'v1.0.0' },
            'TrapSystem': { version: 'v1.0.0' },
            'ShopSystem': { version: 'v1.0.0' },
            'LightingControl': { version: 'v1.1.0' }
        },
        experimentalApiTestCharacterIdentifier: "Roll 2024 Sheet",   // GM should change this to a valid Character Name or ID
        experimentalApiTestAttributeName: "ac",          // GM should set this attribute on the test character
        experimentalApiTestExpectedValue: "99",                         // GM should set this as the attribute's value
    },

    // State tracking
    state: {
        initializationStatus: {},
        errors: [],
        warnings: [],
        startTime: null,
        systemsReady: 0
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

        isGM(msg) {
            // Check if the message has a 'who' field that ends with '(GM)'
            if (msg && msg.who && msg.who.endsWith('(GM)')) {
                CommandMenu.utils.log(`isGM Check: player=${msg.who}, Result=true`, "debug");
                return true;
            }
            return false;
        },

        addInitStatus(module, status, message = null, type = 'info') {
            const systemInfo = CommandMenu.config.KNOWN_SYSTEMS[module] || {};
            CommandMenu.state.initializationStatus[module] = {
                status: status,
                message: message,
                version: systemInfo.version || '',
                type: type
            };

            if (type === 'error' && message) {
                CommandMenu.state.errors.push(`${module}: ${message}`);
            } else if (type === 'warning' && message) {
                CommandMenu.state.warnings.push(`${module}: ${message}`);
            }

            if (status === 'success') {
                CommandMenu.state.systemsReady++;
            }
        }
    },

    // Menu Management
    menu: {
        showStartupMenu() {
            const initTime = (Date.now() - CommandMenu.state.startTime) / 1000;
            let menu = [
                "&{template:default} {{name=System Initialization}}",
                `{{Status=✅ System startup complete in ${initTime.toFixed(2)}s}}`
            ];

            // Group systems by status
            const systems = {
                success: [],
                warning: [],
                error: [],
                pending: []
            };

            Object.entries(CommandMenu.state.initializationStatus).forEach(([module, data]) => {
                const status = {
                    success: '✅',
                    error: '❌',
                    warning: '⚠️',
                    pending: '⏳'
                }[data.type] || '📜';
                const group = systems[data.type] || systems.pending;
                
                const version = data.version ? ` ${data.version}` : '';
                group.push(`${status} ${module}${version}`);
            });

            // Add systems by status
            if (systems.success.length > 0) {
                menu.push(`{{Ready=${systems.success.join('<br>')}}}`);
            }
            if (systems.warning.length > 0) {
                menu.push(`{{Warnings=${systems.warning.join('<br>')}}}`);
            }
            if (systems.error.length > 0) {
                menu.push(`{{Errors=${systems.error.join('<br>')}}}`);
            }
            if (systems.pending.length > 0) {
                menu.push(`{{Pending=${systems.pending.join('<br>')}}}`);
            }

            if (
                systems.success.length === 0 &&
                systems.warning.length === 0 &&
                systems.error.length === 0 &&
                systems.pending.length === 0
            ) {
                menu.push("{{Note=No systems have reported status.}}");
            }

            // Add quick access buttons
            menu.push("{{Quick Access=");
            Object.values(CommandMenu.config.MENU_SECTIONS).forEach(section => {
                menu.push(`[${this.getSectionEmoji(section)} ${section}](!menu ${section})`);
            });
            menu.push("}}");

            sendChat("API", `/w gm ${menu.join(" ")}`, null, {noarchive: true});
        },

        showQuickMenu(msg) {
            if (CommandMenu.config.GM_ONLY && !CommandMenu.utils.isGM(msg)) {
                sendChat("API", "/w gm ⚠️ This menu is only available to the GM.");
                return;
            }

            let menu = [
                "&{template:default} {{name=Quick Access}}",
                "{{Select Section="
            ];

            Object.values(CommandMenu.config.MENU_SECTIONS).forEach(section => {
                menu.push(`[${this.getSectionEmoji(section)} ${section}](!menu ${section})`);
            });

            menu.push("}}");

            sendChat("API", `/w gm ${menu.join(" ")}`, null, {noarchive: true});
        },

        getSectionEmoji(section) {
            const emojis = {
                shop: "🏪",
                trap: "🎯",
                tokenFX: "🎨",
                tokenMod: "🔧",
                audio: "🎵",
                combat: "⚔️",
                utility: "🔧",
                lighting: "💡",
                system: "⚙️"
            };
            return emojis[section] || "📋";
        },

        showMainMenu(msg, section = null) {
            if (CommandMenu.config.GM_ONLY && !CommandMenu.utils.isGM(msg)) {
                sendChat("API", "/w gm ⚠️ This menu is only available to the GM.");
                return;
            }

            let menu = [
                "&{template:default} {{name=Control Panel}}",
                "{{Reminder=⚠️ Select relevant token(s) before using commands!}}"
            ];

            // Add sections based on argument or show all
            if (section) {
                menu.push(this.getSectionContent(section));
            } else {
                Object.values(CommandMenu.config.MENU_SECTIONS).forEach(section => {
                    menu.push(this.getSectionContent(section));
                });
            }

            sendChat("API", `/w gm ${menu.join(" ")}`, null, {noarchive: true});
        },

        getSectionContent(section) {
            switch(section) {
                case CommandMenu.config.MENU_SECTIONS.SHOP:
                    return "{{Shop Controls=[" +
                           "🏪 Create Basic Shop](!shop create ?{Shop Name|New Shop}|?{Merchant Name|Unknown Merchant}|?{Shop Type|General Store|Blacksmith|Armorer|Alchemist|Magic Shop|Potion Shop|Scroll Shop|Tavern|Jeweler|Clothier|Adventuring Supplies|Exotic Goods})" +
                           "[🏬 Advanced Setup](!shop create_advanced ?{Shop Name|New Shop})" +
                           "[🛒 List Shops](!shop list)" +
                           "[📢 Display to Players](!shop display_to_players)" +
                           "[🛍️ Create Sample Shop](!shop sample)" +
                           "[📚 Item DB Init](!itemdb init)" +
                           "[➕ Add Item to DB](!itemdb add)" +
                           "[📋 List All DB Items](!itemdb list all all)" +
                           "[📖 Import Sample Items](!itemdb sample)" +
                           "[❓ Shop Help](!shop help)" +
                           "[❓ Database Help](!itemdb help)" +
                           "}}";
                
                case CommandMenu.config.MENU_SECTIONS.TRAP:
                    return "{{Trap Controls=[" +
                           "🎯 Setup Standard Trap](!trapsystem setup ?{Uses|1} ?{Main Macro - #MacroName, &quot;!Command&quot;, Text} ?{Optional Macro 2|None} ?{Optional Macro 3|None} ?{Movement|Intersection|Center|Grid} ?{Auto Trigger|false|true})" +
                           "[🔍 Setup Interaction Trap](!trapsystem setupinteraction ?{Uses|1} ?{Primary Macro - #MacroName, &quot;!Command&quot;, Text|None} ?{Success Macro|None} ?{Failure Macro|None} ?{First Check Type|Flat Roll|Acrobatics|Animal Handling|Arcana|Athletics|Deception|History|Insight|Intimidation|Investigation|Medicine|Nature|Perception|Performance|Persuasion|Religion|Sleight of Hand|Stealth|Survival|Strength Check|Dexterity Check|Constitution Check|Intelligence Check|Wisdom Check|Charisma Check|Strength Saving Throw|Dexterity Saving Throw|Constitution Saving Throw|Intelligence Saving Throw|Wisdom Saving Throw|Charisma Saving Throw} ?{First Check DC|10} ?{Second Check Type|None|Flat Roll|Acrobatics|Animal Handling|Arcana|Athletics|Deception|History|Insight|Intimidation|Investigation|Medicine|Nature|Perception|Performance|Persuasion|Religion|Sleight of Hand|Stealth|Survival|Strength Check|Dexterity Check|Constitution Check|Intelligence Check|Wisdom Check|Charisma Check|Strength Saving Throw|Dexterity Saving Throw|Constitution Saving Throw|Intelligence Saving Throw|Wisdom Saving Throw|Charisma Saving Throw} ?{Second Check DC|10} ?{Movement Trigger Enabled|true|false} ?{Auto Trigger|false|true})" +
                           "[🛠️ Setup Detection](!trapsystem passivemenu)" +
                           "[🔄 Toggle Trap](!trapsystem toggle)" +
                           "[📊 Trap Status](!trapsystem status)" +
                           "[⚡ Trigger Trap](!trapsystem trigger)" +
                           "[💬 Show Interaction Menu](!trapsystem showmenu)" +
                           "[🚶‍♂️ Allow Movement](!trapsystem allowmovement selected)" +
                           "[🚶‍♀️ Allow All Movement](!trapsystem allowall)" +
                           "[🛡️ Toggle Immunity](!trapsystem ignoretraps)" +
                           "[✅ Enable System](!trapsystem enable)" +
                           "[❌ Disable System](!trapsystem disable)" +
                           "[💾 Export State & Macros](!trapsystem exportmacros)" +
                           "[⏮️ Reset Token States](!trapsystem resetstates)" +
                           "[📝 Reset Macro Actions](!trapsystem resetmacros)" +
                           "[💥 Reset - States & Macros](!trapsystem fullreset)" +
                           "[🧹 Reset Detection](!trapsystem resetdetection)" +
                           "[❓ Help](!trapsystem help)" +
                           "}}";

                case CommandMenu.config.MENU_SECTIONS.TOKEN_FX:
                    return "{{Token Effects (TokenFX)=[" +
                           "📋 List Standard FX](!listStandardFx)" +
                           "[📋 List Custom FX](!listCustomFx)" +
                           "[🔍 Find by Tag](!fx-find-tag ?{Tag to find - no brackets})" +
                           "[❌ Stop ALL FX Loops](!stopAllFx)" +
                           "[🔗 Stop Chains](!stopChains)" +
                           "[🆔 Get IDs](!getSelectedIDs)" +
                           "[💡 TokenFX Help](!tokenfx help)" +
                           "}}";

                case CommandMenu.config.MENU_SECTIONS.TOKEN_MOD:
                    return "{{Token Control (TokenMod)=[" +
                           "👁️ Toggle Name](!token-mod --flip showname)" +
                           "[👥 Toggle Player Name](!token-mod --flip showplayers_name)" +
                           "[📏 Aura1 R](!token-mod --set aura1_radius|?{Radius?|0})" +
                           "[🔴 Aura1](!token-mod --set aura1_color|#ff0000)" +
                           "[🟢 Aura1](!token-mod --set aura1_color|#00ff00)" +
                           "[🔵 Aura1](!token-mod --set aura1_color|#0000ff)" +
                           "[📏 Aura2 R](!token-mod --set aura2_radius|?{Radius?|0})" +
                           "[🔴 Aura2](!token-mod --set aura2_color|#ff0000)" +
                           "[🟢 Aura2](!token-mod --set aura2_color|#00ff00)" +
                           "[🔵 Aura2](!token-mod --set aura2_color|#0000ff)" +
                           "[🔄 Clear Auras](!token-mod --set aura1_radius| aura2_radius|)" +
                           "[🔦 Torch On](!token-mod --on light_hassight --set light_radius|?{Bright Radius|20} light_dimradius|?{Low Light Total|40})" +
                           "[⚫ Light Off](!token-mod --off light_hassight --set light_radius|0 light_dimradius|0)" +
                           "[🔄 Clear Statuses](!token-mod --set statusmarkers|=)" +
                           "[💀 Toggle Dead](!token-mod --set statusmarkers|!dead)" +
                           "[🔄 Set Default Token](!token-mod --set defaulttoken)" +
                           "[🔗 Unlink Character](!token-mod --set represents|)" +
                           "[❓ TokenMod Help](!token-mod --help)" +
                           "}}";

                case CommandMenu.config.MENU_SECTIONS.AUDIO:
                    return "{{Audio Controls=[" +
                           "⚙️ Import Config](!roll20AM --config,import)" +
                           "[📋 Track Menu](!roll20AM --config)" +
                           "[🔑 Edit Access](!roll20AM --edit,access|?{Select Player|All Players,all|Current Player,player|GM Only,gm})" +
                           "[⏹️ Stop AM Audio](!roll20AM --audio,stop)" +
                           "}}";

                case CommandMenu.config.MENU_SECTIONS.COMBAT:
                    return "{{Basic Combat=[" +
                           // Core Initiative
                           "⚔️ Roll Init](!group-init)" + // Roll Initiative: Roll initiative for selected tokens
                           "[🔄 Reroll Init](!group-init --reroll)" + // Reroll Init: Reroll initiative for current turn order
                           "[📊 Sort Init](!group-init --sort)" + // Sort Init: Sort current turn order
                           "[🗑️ Clear Init](!group-init --clear)" + // Clear Init: Remove all from turn order
                           "[📋 Turn Order](!group-init --toggle-turnorder)" + // Turn Order: Toggle turn order window
                           // Core Group Checks
                           "[🎲 Group Check](!group-check)" + // Group Check: Roll a check for all selected tokens
                           "[🎲 Multi-Roll](!group-check --multi ?{Times|2})" + // Multi-Roll: Roll multiple times for each token
                           "[📊 Show Average](!group-check --showaverage)" + // Show Average: Display average of all rolls
                           // Quick Adjustments
                           "[➕ Add Bonus](!group-init --bonus ?{Bonus|0})" + // Add Bonus: Add a bonus to initiative rolls
                           "[📊 Adjust All](!group-init --adjust ?{Adjustment|0} ?{Minimum|-10000})" + // Adjust All: Modify all initiatives by a value
                           // Menu Navigation
                           "[⚔️ Advanced Combat](!menu combat_advanced)" + // Advanced Combat: Open advanced combat menu
                           "[⚙️ Combat Config](!menu combat_config)" + // Combat Config: Open configuration menu
                           "[⚙️ Init Menu](!group-init --help)" + // Init Menu: Open GroupInitiative's native menu
                           "[⚙️ Check Menu](!group-check --help)" + // Check Menu: Open GroupCheck's native menu
                           "}}";

                case "combat_advanced":
                    return "{{Advanced Combat=[" +
                           // Stack Management
                           "💾 Save Order](!group-init --stack copy)" + // Save Order: Save current initiative order
                           "[📥 Load Order](!group-init --stack pop)" + // Load Order: Restore last saved order
                           "[🔄 Rotate Orders](!group-init --stack rotate)" + // Rotate Orders: Cycle through saved orders
                           "[🔄 Reverse Rotate](!group-init --stack reverse-rotate)" + // Reverse Rotate: Cycle backwards
                           "[🔄 Swap Orders](!group-init --stack swap)" + // Swap Orders: Exchange current with saved
                           "[📋 List Saved](!group-init --stack list)" + // List Saved: Show all saved orders
                           "[🗑️ Clear Saved](!group-init --stack clear)" + // Clear Saved: Remove all saved orders
                           // Advanced Stack Operations
                           "[📤 Push Order](!group-init --stack push)" + // Push Order: Save and clear turn order
                           "[📥 Apply Order](!group-init --stack apply)" + // Apply Order: Use saved without removing
                           "[🔄 Merge Orders](!group-init --stack merge)" + // Merge Orders: Combine with saved
                           "[🔄 Apply & Merge](!group-init --stack apply-merge)" + // Apply & Merge: Merge without removing
                           "[🔄 Tail Swap](!group-init --stack tail-swap)" + // Tail Swap: Swap with first saved
                           // Advanced Initiative
                           "[📊 Adjust Current](!group-init --adjust-current ?{Adjustment|0} ?{Minimum|-10000})" + // Adjust Current: Modify current turn
                           "[🎲 Roll Specific](!group-init --ids ?{Token IDs|})" + // Roll Specific: Roll for specific tokens
                           // Advanced Checks
                           "[🎲 Raw Rolls](!group-check --raw ?{Subheader|})" + // Raw Rolls: Show just the dice
                           "[🎲 Custom Button](!group-check --button ?{Button Name|} ?{Command|})" + // Custom Button: Add button to results
                           "[🎲 Send Command](!group-check --send ?{Command|})" + // Send Command: Send with results
                           "[🎲 Input Replace](!group-check --input ?{Inputs|})" + // Input Replace: Replace formula parts
                           // Menu Navigation
                           "[⚔️ Basic Combat](!menu combat)" + // Basic Combat: Return to basic menu
                           "[⚙️ Combat Config](!menu combat_config)" + // Combat Config: Open configuration menu
                           "}}";

                case "combat_config":
                    return "{{Combat Configuration=[" +
                           // Initiative Configuration
                           "🎲 Set Die Size](!group-init-config --set-die-size|?{Die Size|20})" + // Die Size: Change initiative die
                           "[🎲 Set Dice Count](!group-init-config --set-dice-count|?{Dice Count|1})" + // Dice Count: Set number of dice
                           "[🎲 Set Dice Mod](!group-init-config --set-dice-mod|?{Modifier|})" + // Dice Mod: Add modifiers
                           "[📊 Set Decimals](!group-init-config --set-max-decimal|?{Decimals|2})" + // Decimal: Set precision
                           "[⚙️ Toggle Auto Open](!group-init-config --toggle-auto-open-init)" + // Auto Open: Toggle auto-opening
                           "[⚙️ Toggle Replace](!group-init-config --toggle-replace-roll)" + // Replace Roll: Toggle replacing
                           "[⚙️ Toggle Preserve](!group-init-config --toggle-preserve-first)" + // Preserve First: Keep first turn
                           // Check Configuration
                           "[🎲 Import Checks](!group-check-config --import ?{Sheet Type|5E-Shaped|5E-OGL|Pathfinder-Official|Pathfinder-Community|3.5})" + // Import Checks: Import formulas
                           "[🎲 Add Custom Check](!group-check-config --add ?{JSON|})" + // Add Custom Check: Add formula
                           "[🎲 Delete Check](!group-check-config --delete ?{Check Name|})" + // Delete Check: Remove check
                           "[⚙️ Set Roll Option](!group-check-config --set ro ?{Option|roll1|roll2|adv|dis|rollsetting})" + // Set Roll Option: Configure rolls
                           "[⚙️ Set Global Mod](!group-check-config --set globalmod ?{Modifier|0})" + // Set Global Mod: Add modifier
                           "[⚙️ Toggle Dark Mode](!group-check-config --set darkmode)" + // Toggle Dark Mode: Switch theme
                           // Display Options
                           "[👤 Use Token Name](!group-check-config --set usetokenname)" + // Use Token Name: Display token name
                           "[👤 Use Char Name](!group-check-config --set usecharname)" + // Use Char Name: Display char name
                           "[👤 Show Name](!group-check-config --set showname)" + // Show Name: Display names
                           "[👤 Hide Name](!group-check-config --set hidename)" + // Hide Name: Hide names
                           "[🖼️ Show Picture](!group-check-config --set showpicture)" + // Show Picture: Display images
                           "[🖼️ Hide Picture](!group-check-config --set hidepicture)" + // Hide Picture: Hide images
                           "[📝 Show Formula](!group-check-config --set showformula)" + // Show Formula: Display formulas
                           "[📝 Hide Formula](!group-check-config --set hideformula)" + // Hide Formula: Hide formulas
                           // Menu Navigation
                           "[⚔️ Basic Combat](!menu combat)" + // Basic Combat: Return to basic menu
                           "[⚔️ Advanced Combat](!menu combat_advanced)" + // Advanced Combat: Open advanced menu
                           "}}";

                case CommandMenu.config.MENU_SECTIONS.UTILITY:
                    return "{{Utility=[" +
                           "]}}";

                case CommandMenu.config.MENU_SECTIONS.SYSTEM:
                    return "{{System Operations=[" +
                           "⚙️ Main Menu](!menu)" +                  // Returns to the full main menu
                           "[❓ CommandPanel Help](!menu help)" +     // Shows CommandMenu's own help
                           // APIHeartBeat Integration
                           "[💓 API Status Check](!api-heartbeat --check)" +        // Quick check if API is responsive
                           "[📊 API Latency Graph](!api-heartbeat --histogram)" +  // Shows latency graph (GM useful)
                           "[📜 API Run History](!api-heartbeat --history)" +      // Shows sandbox run history (GM useful)
                           "[⚙️ APIHeartBeat Config](!api-heartbeat --help)" +   // Access APIHeartBeat help & config
                           "}}";

                case CommandMenu.config.MENU_SECTIONS.LIGHTING:
                    return "{{Lighting Controls=[" +
                           // Wall Controls
                           "🧱 Wall: Hide](!wall ?{Wall ID} hide)" +
                           "[🧱 Wall: Reveal](!wall ?{Wall ID} reveal)" +
                           // Door Controls
                           "[🚪 Doors (Page): Action](!door all_on_page ?{Action|open|close|lock|unlock|reveal|set_secret_true})" +
                           "[🚪 Doors (Area): Action](!door area ?{Shape|square|circle} ?{Dimension - grids|3} ?{Action|open|close|lock|unlock})" +
                           // Darkness Toggle
                           "[💡 Toggle Darkness (Area)](!lc toggledarkness ?{Shape|square|circle} ?{Dimension - grids|5} --id ?{Switch Name - optional|default_toggle})" +
                           // Help
                           "[❓ LightControl Help](!lc help)" +
                           "}}";

                default:
                    return "";
            }
        },

        showHelpMenu(msg) {
            if (CommandMenu.config.GM_ONLY && !CommandMenu.utils.isGM(msg)) {
                sendChat("API", "/w gm ⚠️ This menu is only available to the GM.");
                return;
            }

            let help = [
                "&{template:default} {{name=Help Menu}}",
                "{{Shop System=",
                "• Create Shop: Make a new shop handout",
                "• List Shops: Show all available shops",
                "• Manage Stock: Add/remove items",
                "• View Stock: See current inventory",
                "• Categories: weapons, armor, potions, scrolls, magic, equipment}}",
                "{{Trap System=",
                "• Setup Standard Trap: Create a normal trap with macros",
                "• Setup Interaction Trap: Create a trap with skill checks",
                "• Toggle arms/disarms the selected trap",
                "• Status shows current trap configuration",
                "• Trigger opens the control panel",
                "• Allow Movement frees a trapped token",
                "• Standard Traps:",
                "  - Up to 3 macros can be set",
                "  - Movement options: Default, Center, or Grid",
                "• Interaction Traps:",
                "  - Success and failure macros",
                "  - Up to 2 skill checks with DCs",
                "  - Supports flat rolls (no modifiers)",
                "  - Players can explain actions",
                "• State Management (New!):",
                "  - Export State & Macros: Saves current token/object states and macro actions.",
                "  - Reset Token/Object States: Restores saved physical states of tokens and objects.",
                "  - Reset Macro Actions: Restores macro actions to their saved versions.",
                "  - Full Reset: Performs both state and macro action resets.",
                "}}",
                "{{Lighting Controls (New!)=[" +
                "• Wall Commands: Hide, reveal, move, or change layer of Dynamic Lighting walls.",
                "• Door Commands: Open, close, lock, unlock, reveal individual doors/windows, all on page, or in an area.",
                "• Toggle Darkness: Turn lights on/off in an area, remembering previous states (uses TokenMod).",
                "• GM Only: Page/Area door commands and Toggle Darkness require GM privileges.",
                "• Select Token: Area commands (doors, darkness) are centered on selected token(s).",
                "• Help: `!lc help` for detailed command syntax.",
                "]}}",
                "{{Token Effects=",
                "• Set Aura adds visible radius",
                "• List commands show available effects",
                "• Stop FX cancels all active effects",
                "• Stop All Audio ends all sounds}}",
                "{{Audio Controls=",
                "• Import: Load audio configuration",
                "• Track Menu: Manage available tracks",
                "• Edit Access: Set player permissions",
                "• Play/Stop: Basic audio controls}}",
                "{{Combat Tools=",
                "• Initiative: Roll for selected tokens",
                "• Reroll: New initiative for current order",
                "• Sort/Clear: Manage turn order",
                "• Config: Advanced settings}}",
                "{{Token Controls=",
                "• Set Aura: Add visible radius",
                "• Token Help: Show all token commands",
                "• List/Stop: Manage visual effects}}",
                "{{Utility=",
                "• Reset State restores saved setup}}",
                "{{Note=Most commands work with selected tokens}}"
            ];

            sendChat("API", `/w gm ${help.join(" ")}`, null, {noarchive: true});
        }
    }
};

// Initialize on ready
on("ready", async function() {
    CommandMenu.state.startTime = Date.now();
    
    // Add status for core systems
    CommandMenu.utils.addInitStatus('CommandMenu', 'success', null, 'success');
    
    // Process TokenFX errors and warnings from startup
    if (typeof TokenFX !== 'undefined' && TokenFX.state && TokenFX.state.errors && TokenFX.state.errors.length > 0) { // Check if TokenFX and its state exist
        CommandMenu.utils.addInitStatus('TokenFX', 'warning', 'Some custom FX may have failed to load. Check API console.', 'warning');
    } else if (typeof TokenFX !== 'undefined') {
        CommandMenu.utils.addInitStatus('TokenFX', 'success', null, 'success');
    } else {
        CommandMenu.utils.addInitStatus('TokenFX', 'pending', 'TokenFX not detected or not yet initialized.', 'pending');
    }

    // [NEW] Check for Experimental Sandbox features using a specific character attribute value
    let newApiFeaturesConfirmed = false;
    const charIdentifier = CommandMenu.config.experimentalApiTestCharacterIdentifier;
    const attrName = CommandMenu.config.experimentalApiTestAttributeName;
    const expectedValue = CommandMenu.config.experimentalApiTestExpectedValue;
    let character = null;

    if (charIdentifier && attrName && expectedValue) {
        // Try to get character by ID first
        character = getObj("character", charIdentifier);
        // If not found by ID, try by name
        if (!character) {
            const charactersFound = findObjs({ _type: "character", name: charIdentifier });
            if (charactersFound.length > 0) {
                character = charactersFound[0];
                if (charactersFound.length > 1) {
                    CommandMenu.utils.log(`Multiple characters found with name "${charIdentifier}". Using the first one found (ID: ${character.id}) for API test.`, 'warning');
                }
            }
        }

        if (character) {
            if (typeof getSheetItem === 'function') {
                try {
                    // Await the result of getSheetItem as it's asynchronous
                    const retrievedValue = await getSheetItem(character.id, attrName);
                    CommandMenu.utils.log(`API Test: Character "${character.get('name')}" (${character.id}), Attribute "${attrName}", Retrieved Value: "${retrievedValue}", Expected: "${expectedValue}"`, 'debug');
                    if (retrievedValue !== null && typeof retrievedValue !== 'undefined' && String(retrievedValue) === String(expectedValue)) {
                        newApiFeaturesConfirmed = true;
                    } else {
                        CommandMenu.utils.log(`API Test: Value mismatch or attribute not found. Retrieved: "${retrievedValue}", Expected: "${expectedValue}"`, 'warning');
                    }
                } catch (e) {
                    CommandMenu.utils.log(`API Test: Error calling getSheetItem for character ${character.id}, attribute ${attrName}: ${e.message}`, 'error');
                }
            } else {
                CommandMenu.utils.log('API Test: getSheetItem function is not defined.', 'warning');
            }
        } else {
            CommandMenu.utils.log(`API Test: Character "${charIdentifier}" not found. Skipping experimental API feature check.`, 'warning');
        }
    } else {
        CommandMenu.utils.log('API Test: Configuration for experimental API check is incomplete. Skipping check.', 'warning');
    }

    if (newApiFeaturesConfirmed) {
        CommandMenu.utils.addInitStatus('SandboxFeatures', 'success', `Newer API features confirmed via Character '${charIdentifier}' attribute '${attrName}'.`, 'success');
    } else {
        CommandMenu.utils.addInitStatus(
            'SandboxFeatures', 
            'warning', 
            `Failed to confirm newer API features using Character '${charIdentifier}' attribute '${attrName}'. Expected value: '${expectedValue}'. Ensure character & attribute are set correctly and sandbox is up-to-date.`, 
            'warning'
        );
    }
    
    // Show startup menu after a short delay to allow other systems to initialize
    setTimeout(() => {
        CommandMenu.menu.showStartupMenu();
    }, 2000);
});

// Handle chat messages
on("chat:message", function(msg) {
    if (msg.type !== "api") return;
    
    let args = msg.content.split(" ");
    let command = args[0];

    if (command === "!menu") {
        // Log for debugging
        CommandMenu.utils.log(`Command received: ${msg.content}`, "info");
        CommandMenu.utils.log(`Parsed arguments: ${JSON.stringify(args)}`, "info");
        CommandMenu.utils.log(`Chat message: ${JSON.stringify(msg)}`, "debug");
        
        if (args[1] === "help") {
            CommandMenu.menu.showHelpMenu(msg);
        } else if (args[1] === "quick") {
            CommandMenu.menu.showQuickMenu(msg);
        } else if (args[1] && Object.values(CommandMenu.config.MENU_SECTIONS).includes(args[1])) {
            CommandMenu.menu.showMainMenu(msg, args[1]);
        } else {
            CommandMenu.menu.showMainMenu(msg);
        }
    }
});