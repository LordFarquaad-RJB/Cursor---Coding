/**
 * MenuBuilder.js
 * 
 * Template-based menu generation system for the Shop System
 * Consolidates all repetitive menu generation patterns
 * 
 * Replaces:
 * - 15+ similar menu generation functions (Lines 3000-4000)
 * - Repeated menu template patterns
 * - Duplicate button generation logic
 * - Similar navigation patterns
 * 
 * Estimated savings: 200-300 lines
 */

const MenuBuilder = {
    // Reference to ShopConfig for emojis and constants
    config: null,
    
    // Initialize with config reference
    init(shopConfig) {
        this.config = shopConfig;
        return this;
    },
    
    /**
     * Create a basic menu structure
     * @param {string} title - Menu title
     * @param {Object} sections - Menu sections object
     * @param {Object} options - Additional options
     * @returns {string} Complete menu string
     */
    createMenu(title, sections = {}, options = {}) {
        const menu = [];
        
        // Start with template
        menu.push("&{template:default}");
        
        // Add title
        if (title) {
            const titleEmoji = options.titleEmoji || this.getUIEmoji('menu');
            menu.push(`{{name=${titleEmoji} ${title}}}`);
        }
        
        // Add sections
        Object.entries(sections).forEach(([sectionTitle, content]) => {
            if (content && content.trim()) {
                menu.push(`{{${sectionTitle}=${content}}}`);
            }
        });
        
        return menu.join(" ");
    },
    
    /**
     * Create a menu section with buttons
     * @param {Array} buttons - Array of button objects or strings
     * @param {Object} options - Formatting options
     * @returns {string} Formatted section content
     */
    createButtonSection(buttons, options = {}) {
        if (!buttons || buttons.length === 0) return "";
        
        const formattedButtons = buttons.map(button => {
            if (typeof button === 'string') {
                return button;
            }
            
            return this.createButton(button.text, button.command, button.options);
        });
        
        const separator = options.separator || ' ';
        const lineBreak = options.lineBreak || '<br>';
        
        if (options.columns && options.columns > 1) {
            // Arrange in columns
            const rows = [];
            for (let i = 0; i < formattedButtons.length; i += options.columns) {
                const row = formattedButtons.slice(i, i + options.columns);
                rows.push(row.join(separator));
            }
            return rows.join(lineBreak);
        }
        
        return formattedButtons.join(separator);
    },
    
    /**
     * Create a button with command
     * @param {string} text - Button text
     * @param {string} command - Button command
     * @param {Object} options - Button options
     * @returns {string} Formatted button
     */
    createButton(text, command, options = {}) {
        if (!text || !command) return "";
        
        const emoji = options.emoji || "";
        const fullText = emoji ? `${emoji} ${text}` : text;
        
        return `[${fullText}](${command})`;
    },
    
    /**
     * Create navigation section with common back/help buttons
     * @param {Array} navButtons - Custom navigation buttons
     * @param {Object} options - Navigation options
     * @returns {string} Navigation section content
     */
    createNavigation(navButtons = [], options = {}) {
        const defaultButtons = [];
        
        if (options.showBack && options.backCommand) {
            defaultButtons.push({
                text: options.backText || "Back",
                command: options.backCommand,
                options: { emoji: "🔙" }
            });
        }
        
        if (options.showHelp && options.helpCommand) {
            defaultButtons.push({
                text: options.helpText || "Help", 
                command: options.helpCommand,
                options: { emoji: this.getUIEmoji('help') }
            });
        }
        
        const allButtons = [...navButtons, ...defaultButtons];
        return this.createButtonSection(allButtons, { separator: ' ' });
    },
    
    /**
     * Create a shop menu with standard sections
     * @param {Object} shop - Shop data
     * @param {boolean} isGM - Whether viewing as GM
     * @param {Object} options - Menu options
     * @returns {string} Complete shop menu
     */
    buildShopMenu(shop, isGM = false, options = {}) {
        const sections = {};
        
        // Basic shop info
        if (shop.merchant_name) {
            sections.Merchant = shop.merchant_name;
        }
        
        if (shop.description) {
            sections.Description = shop.description;
        }
        
        if (shop.welcome_message && !isGM) {
            sections.Welcome = shop.welcome_message;
        }
        
        if (shop.special_event?.type && shop.special_event.type !== "None") {
            sections["Special Event"] = `${shop.special_event.type}: ${shop.special_event.details}`;
        }
        
        // Categories section
        const categoryButtons = this.buildCategoryButtons(options.categories || []);
        if (categoryButtons) {
            sections.Categories = categoryButtons;
        }
        
        // Actions section
        const actionButtons = this.buildShopActionButtons(isGM, options.shopName);
        if (actionButtons) {
            sections.Actions = actionButtons;
        }
        
        // Navigation
        const navigation = this.createNavigation([], {
            showHelp: true,
            helpCommand: "!shop help",
            showBack: options.showBackToList,
            backCommand: "!shop list",
            backText: "Shop List"
        });
        
        if (navigation) {
            sections.Navigation = navigation;
        }
        
        const title = isGM ? `${shop.name} (GM View)` : shop.name;
        const titleEmoji = this.config?.getCategoryEmoji('shop') || '🏪';
        
        return this.createMenu(title, sections, { titleEmoji });
    },
    
    /**
     * Build category browsing buttons
     * @param {Array} categories - Available categories
     * @returns {string} Category button section
     */
    buildCategoryButtons(categories = []) {
        if (categories.length === 0) {
            // Use default categories
            categories = this.config?.ITEM?.CATEGORIES || ['weapons', 'equipment', 'potions'];
        }
        
        const buttons = [];
        
        // Add "All Items" button first
        buttons.push({
            text: "All Items",
            command: "!shop browse all",
            options: { emoji: "📦" }
        });
        
        // Add category buttons
        categories.forEach(category => {
            const emoji = this.getCategoryEmoji(category);
            buttons.push({
                text: category,
                command: `!shop browse ${category}`,
                options: { emoji }
            });
        });
        
        return this.createButtonSection(buttons, { columns: 2, lineBreak: '\n' });
    },
    
    /**
     * Build shop action buttons
     * @param {boolean} isGM - Whether viewing as GM
     * @param {string} shopName - Shop name for commands
     * @returns {string} Action button section
     */
    buildShopActionButtons(isGM, shopName = "") {
        const buttons = [];
        
        if (isGM) {
            // GM actions
            buttons.push(
                { text: "Manage Stock", command: `!shop stock`, options: { emoji: "📦" } },
                { text: "Edit Shop", command: `!shop edit ${shopName}`, options: { emoji: "⚙️" } },
                { text: "Generate Stock", command: `!shop stock random`, options: { emoji: "🎲" } }
            );
        } else {
            // Player actions
            buttons.push(
                { text: "View Basket", command: "!shop basket view", options: { emoji: this.getUIEmoji('basket') } },
                { text: "Sell Items", command: "!shop sell", options: { emoji: "💰" } }
            );
        }
        
        return this.createButtonSection(buttons, { separator: ' ' });
    },
    
    /**
     * Build help menu with sections
     * @param {string} system - System name (shop, database, etc.)
     * @param {Object} helpSections - Help content sections
     * @param {boolean} isGM - Whether viewing as GM
     * @returns {string} Complete help menu
     */
    buildHelpMenu(system, helpSections = {}, isGM = false) {
        const sections = {};
        
        // Add system-specific sections
        Object.entries(helpSections).forEach(([title, content]) => {
            sections[title] = content;
        });
        
        // Add navigation
        const navButtons = [];
        
        if (system === 'shop') {
            navButtons.push({
                text: "Back to Shop",
                command: "!shop",
                options: { emoji: "🔙" }
            });
        } else if (system === 'database') {
            navButtons.push({
                text: "Database Commands",
                command: "!itemdb",
                options: { emoji: "🔙" }
            });
        }
        
        const navigation = this.createButtonSection(navButtons);
        if (navigation) {
            sections.Navigation = navigation;
        }
        
        const title = `${system.charAt(0).toUpperCase() + system.slice(1)} Help${isGM ? ' (GM)' : ''}`;
        
        return this.createMenu(title, sections, { titleEmoji: this.getUIEmoji('help') });
    },
    
    /**
     * Create item list display
     * @param {Array} items - Items to display
     * @param {Object} options - Display options
     * @returns {string} Formatted item list
     */
    buildItemList(items, options = {}) {
        if (!items || items.length === 0) {
            return "No items found.";
        }
        
        const maxItems = options.maxItems || 10;
        const displayItems = items.slice(0, maxItems);
        const showPrices = options.showPrices !== false;
        const showQuantity = options.showQuantity || false;
        const showRarity = options.showRarity || false;
        
        const itemLines = displayItems.map((item, index) => {
            let line = `${index + 1}. `;
            
            // Add rarity emoji if configured
            if (showRarity && item.rarity) {
                const rarityEmoji = this.getRarityEmoji(item.rarity);
                line += `${rarityEmoji} `;
            }
            
            // Add item name
            line += item.name;
            
            // Add quantity if available
            if (showQuantity && item.quantity) {
                line += ` (x${item.quantity})`;
            }
            
            // Add price if configured
            if (showPrices && item.price) {
                // Note: This would use CurrencyManager.formatCurrency in full implementation
                line += ` - ${this.formatPrice(item.price)}`;
            }
            
            // Add action buttons if specified
            if (options.addToBasket) {
                line += ` [Add](!shop basket add ${item.id})`;
            }
            
            return line;
        });
        
        let result = itemLines.join('\n');
        
        if (items.length > maxItems) {
            result += `\n... and ${items.length - maxItems} more items`;
        }
        
        return result;
    },
    
    /**
     * Create confirmation dialog
     * @param {string} title - Dialog title
     * @param {string} message - Confirmation message
     * @param {string} confirmCommand - Command for confirm button
     * @param {string} cancelCommand - Command for cancel button
     * @param {Object} options - Dialog options
     * @returns {string} Confirmation dialog menu
     */
    buildConfirmationDialog(title, message, confirmCommand, cancelCommand, options = {}) {
        const sections = {
            Message: message
        };
        
        const buttons = [
            {
                text: options.confirmText || "Confirm",
                command: confirmCommand,
                options: { emoji: this.getUIEmoji('confirm') }
            },
            {
                text: options.cancelText || "Cancel", 
                command: cancelCommand,
                options: { emoji: this.getUIEmoji('cancel') }
            }
        ];
        
        sections.Actions = this.createButtonSection(buttons, { separator: ' | ' });
        
        return this.createMenu(title, sections, { titleEmoji: options.titleEmoji });
    },
    
    // Helper methods for emojis (with fallbacks if config not available)
    getCategoryEmoji(category) {
        return this.config?.getCategoryEmoji?.(category) || "📦";
    },
    
    getRarityEmoji(rarity) {
        return this.config?.getRarityEmoji?.(rarity) || "⚪";
    },
    
    getUIEmoji(type) {
        return this.config?.EMOJI?.UI?.[type] || "📋";
    },
    
    // Simple price formatting (would delegate to CurrencyManager in full implementation)
    formatPrice(price) {
        if (typeof price === 'object' && price.gp) {
            return `${price.gp}gp`;
        }
        return price.toString();
    },
    
    // Utility method to send menu to chat
    sendMenu(menuString, playerId = null, systemName = "ShopSystem") {
        if (playerId) {
            const player = getObj('player', playerId);
            if (player) {
                sendChat(systemName, `/w "${player.get('_displayname')}" ${menuString}`);
            } else {
                sendChat(systemName, `/w gm ${menuString}`);
            }
        } else {
            sendChat(systemName, `/w gm ${menuString}`);
        }
    },
    
    // Logging helper
    log(message, type = 'info') {
        const prefix = this.config?.LOGGING?.PREFIX?.[type] || '📜';
        log(`${prefix} MenuBuilder: ${message}`);
    }
};

// Export for Roll20 environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MenuBuilder;
} else {
    this.MenuBuilder = MenuBuilder;
}