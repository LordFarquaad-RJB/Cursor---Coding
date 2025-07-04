/**
 * Live-SYS-ShopSystem - Built Version
 * 
 * Generated: 2025-07-04T10:35:40.821Z
 * Version: 1.0.0
 * Build Mode: Production
 * 
 * This file is auto-generated from multiple modules.
 * Do not edit directly - edit the source modules instead.
 * 
 * Source modules included:
 * - ShopConfig.js
 * - CurrencyManager.js
 * - MenuBuilder.js
 * - BasketManager.js
 * - ReceiptGenerator.js
 * - StockManager.js
 * - DatabaseManager.js
 */

// ============================================================================
// MODULES
// ============================================================================


// ============================================================================
// MODULE: ShopConfig.js
// ============================================================================

/**
 * ShopConfig.js
 * 
 * Consolidated configuration module for the Shop System
 * Eliminates duplicate configuration scattered throughout the main file
 * 
 * Replaces:
 * - CONFIG object (Lines 1-400 in main file)
 * - Scattered emoji definitions
 * - Duplicate constants and defaults
 * 
 * Estimated savings: 150-200 lines
 */

const ShopConfig = {
    // System Information
    VERSION: '1.0.0',
    DEBUG: false,
    
    // Logging Configuration (consolidated from multiple locations)
    LOGGING: {
        ENABLED: true,
        LEVEL: "info",
        PREFIX: {
            info: '📜',
            error: '❌',
            success: '✅',
            warning: '⚠️',
            debug: '🔍'
        }
    },
    
    // Handout Configuration
    HANDOUT: {
        DATABASE: "Item-Database",
        SHOP_PREFIX: "Shop-",
    },
    
    // Currency Configuration
    CURRENCY: {
        COPPER_PER_SILVER: 10,
        COPPER_PER_ELECTRUM: 50,
        COPPER_PER_GOLD: 100,
        COPPER_PER_PLATINUM: 1000,
        DEFAULT_FORMAT: "gp",
        SYMBOLS: {
            cp: "cp",
            sp: "sp", 
            ep: "ep",
            gp: "gp",
            pp: "pp"
        }
    },
    
    // Display Configuration
    DISPLAY: {
        ITEMS_PER_PAGE: 10,
        USE_ROLL_TEMPLATES: true,
        DEFAULT_TEMPLATE: "default",
        STOCK_DISPLAY_THRESHOLD: 30
    },
    
    // Pricing Configuration
    PRICING: {
        SELL_PRICE_MODIFIER: 0.5,
        HAGGLE_MAX_ADJUSTMENT: 0.2,
        MIN_PRICE_COPPER: 1
    },
    
    // Haggling Configuration
    HAGGLE: {
        BASE_DC: 15,
        ADVANTAGE_THRESHOLD: 5,
        DEFAULT_STORE_ATTEMPTS: 3,
        SKILLS: ["deception", "persuasion", "intimidation", "Sleight of Hand"]
    },
    
    // Item Configuration
    ITEM: {
        DEFAULT_CATEGORY: "equipment",
        DEFAULT_RARITY: "common",
        CATEGORIES: [
            "weapons", 
            "Armor & Attire", 
            "equipment", 
            "potions", 
            "scrolls", 
            "magic", 
            "Mounts & Vehicles", 
            "Services"
        ],
        RARITIES: ["common", "uncommon", "rare", "very rare", "legendary"]
    },
    
    // Consolidated Emoji Configuration (removed duplicates)
    EMOJI: {
        // Category Emojis
        CATEGORY: {
            weapons: "⚔️",
            "Armor & Attire": "🛡️",
            potions: "🧪",
            scrolls: "📜",
            magic: "✨",
            equipment: "🎒",
            "Mounts & Vehicles": "🐴🛞",
            Services: "🛎️"
        },
        
        // Rarity Emojis
        RARITY: {
            common: "⚪",
            uncommon: "🟢",
            rare: "🔵",
            "very rare": "🟣",
            legendary: "🟠"
        },
        
        // General UI Emojis
        UI: {
            shop: "🏪",
            basket: "🧺",
            money: "💰",
            add: "➕",
            remove: "➖",
            confirm: "✅",
            cancel: "❌",
            help: "❓",
            menu: "📋"
        }
    },
    
    // Rarity Order (for sorting)
    RARITY_ORDER: {
        common: 0,
        uncommon: 1,
        rare: 2,
        "very rare": 3,
        legendary: 4
    },
    
    // Commands Configuration
    COMMANDS: {
        SHOP_PREFIX: "!shop",
        DB_PREFIX: "!itemdb",
        SUBCOMMANDS: {
            SHOP: ["open", "list", "add", "remove", "buy", "sell", "basket", "haggle"],
            DB: ["init", "import", "end", "list", "cancel", "add", "add_param", "add_save"]
        }
    },
    
    // Shop Settings
    SHOP_SETTINGS: {
        SHOP_TYPES: [
            "General Store", "Blacksmith", "Armorer", "Alchemist", 
            "Magic Shop", "Potion Shop", "Scroll Shop", "Tavern",
            "Jeweler", "Clothier", "Adventuring Supplies", "Exotic Goods"
        ],
        
        LOCATIONS: [
            {name: "Merchant District", itemCount: 40, rarityBonus: 10},
            {name: "City Center", itemCount: 30, rarityBonus: 5},
            {name: "Town", itemCount: 20, rarityBonus: 0},
            {name: "Village", itemCount: 15, rarityBonus: -5},
            {name: "Roadside", itemCount: 10, rarityBonus: -10},
            {name: "Traveling Merchant", itemCount: 8, rarityBonus: 0},
            {name: "Outpost", itemCount: 12, rarityBonus: -5},
            {name: "Dungeon Entrance", itemCount: 8, rarityBonus: 15},
            {name: "Festival", itemCount: 25, rarityBonus: 5},
            {name: "Harbor", itemCount: 20, rarityBonus: 10}
        ],
        
        MERCHANT_TYPES: [
            {name: "Honest", dcMod: -2, critSuccess: "Appreciates your fairness", critFailure: "Disappointed but understanding"},
            {name: "Greedy", dcMod: 3, critSuccess: "Reluctantly agrees", critFailure: "Throws you out"},
            {name: "Friendly", dcMod: -1, critSuccess: "Offers a bonus item", critFailure: "Looks sad but accepts"},
            {name: "Shrewd", dcMod: 2, critSuccess: "Impressed by your skills", critFailure: "Raises other prices"},
            {name: "Gullible", dcMod: -3, critSuccess: "Gives incredible discount", critFailure: "Doesn't realize they're losing money"},
            {name: "Suspicious", dcMod: 1, critSuccess: "Finally trusts you", critFailure: "Refuses to deal with you further"},
            {name: "Eccentric", dcMod: 0, critSuccess: "Gives you a strange bonus item", critFailure: "Changes the subject entirely"}
        ],
        
        DEFAULTS: {
            MERCHANT_NAME: "Unknown Merchant",
            SHOP_TYPE: "General Store",
            LOCATION: "Town",
            MERCHANT_TYPE: "Honest",
            BUY_MODIFIER: 1.0,
            SELL_MODIFIER: 0.5,
            DESCRIPTION: "A typical shop in a typical town.",
            WELCOME_MESSAGE: "Welcome to my shop! Take a look around.",
            MERCHANT_DESCRIPTION: "The merchant watches you browse their wares."
        }
    },
    
    // Stock Generation Configuration
    STOCK_GENERATION: {
        RARITY_CHANCES: {
            common: 70,
            uncommon: 20,
            rare: 8,
            "very rare": 1.5,
            legendary: 0.5
        },
        BASE_LEGENDARY_CHANCE: 5,
        DEFAULT_RANDOM_ITEMS: 10,
        DEFAULT_QUANTITY: {
            common: "3d6",
            uncommon: "2d4",
            rare: "1d4",
            "very rare": "1d2",
            legendary: "1d2-1"
        }
    },
    
    // Basket State Configuration
    BASKET_STATE: {
        MERGE_TIMEOUT: 3600000, // 1 hour in milliseconds
        ERROR_MESSAGES: {
            ALREADY_MERGED: "❌ Baskets are already merged.",
            NEED_BOTH_BASKETS: "❌ Need items in both buy and sell baskets to merge.",
            BASKETS_LOCKED: "❌ Cannot modify baskets while merged. Unmerge first.",
            NOT_MERGED: "❌ Baskets are not merged.",
            NO_BASKETS_TO_UNMERGE: "❌ No merged baskets to unmerge."
        }
    },
    
    // Helper Methods
    getCategoryEmoji(category) {
        return this.EMOJI.CATEGORY[category] || this.EMOJI.UI.menu;
    },
    
    getRarityEmoji(rarity) {
        return this.EMOJI.RARITY[rarity] || this.EMOJI.RARITY.common;
    },
    
    getShopTypeDefaults(shopType) {
        return this.SHOP_SETTINGS.DEFAULTS;
    },
    
    getLocationConfig(locationName) {
        return this.SHOP_SETTINGS.LOCATIONS.find(loc => loc.name === locationName) || 
               this.SHOP_SETTINGS.LOCATIONS.find(loc => loc.name === this.SHOP_SETTINGS.DEFAULTS.LOCATION);
    },
    
    getMerchantType(typeName) {
        return this.SHOP_SETTINGS.MERCHANT_TYPES.find(type => type.name === typeName) ||
               this.SHOP_SETTINGS.MERCHANT_TYPES.find(type => type.name === this.SHOP_SETTINGS.DEFAULTS.MERCHANT_TYPE);
    },
    
    validateCategory(category) {
        if (!category) return this.ITEM.DEFAULT_CATEGORY;
        const lowerCaseCategory = category.toLowerCase();
        const foundCategory = this.ITEM.CATEGORIES.find(
            cfgCategory => cfgCategory.toLowerCase() === lowerCaseCategory
        );
        return foundCategory || this.ITEM.DEFAULT_CATEGORY;
    },
    
    validateRarity(rarity) {
        if (!rarity) return this.ITEM.DEFAULT_RARITY;
        const normalized = rarity.toLowerCase().trim();
        
        // Handle special case for "very rare"
        if (normalized === "very" || normalized === "very_rare" || normalized === "very-rare") {
            return "very rare";
        }
        
        return this.ITEM.RARITIES.includes(normalized) ? normalized : this.ITEM.DEFAULT_RARITY;
    },
    
    // Get all valid categories for validation
    getValidCategories() {
        return [...this.ITEM.CATEGORIES, 'all'];
    },
    
    // Get all valid rarities for validation  
    getValidRarities() {
        return [...this.ITEM.RARITIES, 'all'];
    }
};

// Export for Roll20 environment


// ============================================================================
// MODULE: CurrencyManager.js
// ============================================================================

/**
 * CurrencyManager.js
 * 
 * Unified currency management module for the Shop System
 * Consolidates all currency operations and character sheet compatibility
 * 
 * Replaces:
 * - toCopper() function (Lines 500-520)
 * - fromCopper() function (Lines 520-580) 
 * - formatCurrency() function (Lines 580-600)
 * - getCharacterCurrency() function (Lines 850-1000)
 * - setCharacterCurrency() function (Lines 2100-2250)
 * 
 * Estimated savings: 200-300 lines
 */

const CurrencyManager = {
    // Reference to ShopConfig for currency constants
    config: null,
    
    // Initialize with config reference
    init(shopConfig) {
        this.config = shopConfig;
        return this;
    },
    
    /**
     * Convert any currency object to copper pieces
     * @param {Object|number} currency - Currency object or number
     * @returns {number} Total value in copper pieces
     */
    toCopper(currency) {
        if (typeof currency === 'number') {
            return currency;
        }
        
        if (!currency) return 0;
        
        const config = this.config?.CURRENCY || {
            COPPER_PER_SILVER: 10,
            COPPER_PER_ELECTRUM: 50,
            COPPER_PER_GOLD: 100,
            COPPER_PER_PLATINUM: 1000
        };
        
        let copper = 0;
        if (currency.cp) copper += currency.cp;
        if (currency.sp) copper += currency.sp * config.COPPER_PER_SILVER;
        if (currency.ep) copper += currency.ep * config.COPPER_PER_ELECTRUM;
        if (currency.gp) copper += currency.gp * config.COPPER_PER_GOLD;
        if (currency.pp) copper += currency.pp * config.COPPER_PER_PLATINUM;
        
        return copper;
    },
    
    /**
     * Convert copper pieces to currency object
     * @param {number} copper - Total copper pieces
     * @returns {Object} Currency object with appropriate denominations
     */
    fromCopper(copper) {
        if (!copper) return { cp: 0 };
        if (copper < 0) return { cp: 0 };
        
        const config = this.config?.CURRENCY || {
            COPPER_PER_SILVER: 10,
            COPPER_PER_ELECTRUM: 50,
            COPPER_PER_GOLD: 100,
            COPPER_PER_PLATINUM: 1000
        };
        
        // Use platinum format only if value is 1000 gp or more
        const goldThreshold = 1000 * config.COPPER_PER_GOLD;
        
        if (copper >= goldThreshold) {
            const currency = {
                pp: Math.floor(copper / config.COPPER_PER_PLATINUM)
            };
            
            copper %= config.COPPER_PER_PLATINUM;
            
            if (copper >= config.COPPER_PER_GOLD) {
                currency.gp = Math.floor(copper / config.COPPER_PER_GOLD);
                copper %= config.COPPER_PER_GOLD;
            }
            
            if (copper >= config.COPPER_PER_SILVER) {
                currency.sp = Math.floor(copper / config.COPPER_PER_SILVER);
                copper %= config.COPPER_PER_SILVER;
            }
            
            if (copper > 0) {
                currency.cp = copper;
            }
            
            return currency;
        }
        // For medium value items, use gold-based format
        else if (copper >= 100) {
            const currency = {
                gp: Math.floor(copper / config.COPPER_PER_GOLD)
            };
            
            copper %= config.COPPER_PER_GOLD;
            
            if (copper >= config.COPPER_PER_SILVER) {
                currency.sp = Math.floor(copper / config.COPPER_PER_SILVER);
                copper %= config.COPPER_PER_SILVER;
            }
            
            if (copper > 0) {
                currency.cp = copper;
            }
            
            return currency;
        }
        // For low value items
        else {
            const currency = {};
            
            if (copper >= config.COPPER_PER_SILVER) {
                currency.sp = Math.floor(copper / config.COPPER_PER_SILVER);
                copper %= config.COPPER_PER_SILVER;
            }
            
            if (copper > 0 || Object.keys(currency).length === 0) {
                currency.cp = copper;
            }
            
            return currency;
        }
    },
    
    /**
     * Format currency object as display string
     * @param {Object} currency - Currency object
     * @returns {string} Formatted currency string
     */
    formatCurrency(currency) {
        if (!currency) return "0 gp";
        
        let copperValue = this.toCopper(currency);
        if (copperValue === 0) return "0 gp";
        
        const formatted = this.fromCopper(copperValue);
        const parts = [];
        const symbols = this.config?.CURRENCY?.SYMBOLS || {
            pp: "pp", gp: "gp", ep: "ep", sp: "sp", cp: "cp"
        };
        
        if (formatted.pp) parts.push(`${formatted.pp}${symbols.pp}`);
        if (formatted.gp) parts.push(`${formatted.gp}${symbols.gp}`);
        if (formatted.ep) parts.push(`${formatted.ep}${symbols.ep}`);
        if (formatted.sp) parts.push(`${formatted.sp}${symbols.sp}`);
        if (formatted.cp) parts.push(`${formatted.cp}${symbols.cp}`);
        
        return parts.join(" ");
    },
    
    /**
     * Get character's current currency from character sheet
     * Handles multiple sheet types (Standard D&D 5e, Beacon, etc.)
     * @param {string} characterId - Character ID
     * @returns {Object} Currency object
     */
    getCharacterCurrency(characterId) {
        const currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
        const char = getObj('character', characterId);
        if (!char) {
            this.log(`Character not found for ID: ${characterId}`, 'error');
            return currency;
        }

        const charName = char.get('name');
        this.log(`💰 Getting currency for ${charName} (ID: ${characterId})`, 'debug');

        // Check for Standard D&D 5e Sheet Attributes First
        const standardAttrs = ['pp', 'gp', 'ep', 'sp', 'cp'];
        let foundStandard = false;
        standardAttrs.forEach(coin => {
            const attrVal = getAttrByName(characterId, coin);
            if (attrVal !== undefined && attrVal !== null && attrVal !== "") {
                currency[coin] = parseInt(attrVal) || 0;
                if (currency[coin] > 0) foundStandard = true;
                this.log(` -> Found standard attribute ${coin}: ${currency[coin]}`, 'debug');
            }
        });

        if (foundStandard) {
            this.log(` -> Using standard attributes for ${charName}.`, 'debug');
            return currency;
        }

        // Check for Beacon Sheet Attributes (money_*)
        const beaconAttrs = {
            pp: 'money_pp',
            gp: 'money_gp',
            ep: 'money_ep',
            sp: 'money_sp',
            cp: 'money_cp'
        };
        let foundBeacon = false;
        Object.entries(beaconAttrs).forEach(([coin, attrName]) => {
            const attrVal = getAttrByName(characterId, attrName);
            if (attrVal !== undefined && attrVal !== null && attrVal !== "") {
                currency[coin] = parseInt(attrVal) || 0;
                if (currency[coin] > 0) foundBeacon = true;
                this.log(` -> Found Beacon attribute ${attrName}: ${currency[coin]}`, 'debug');
            }
        });

        if (foundBeacon) {
            this.log(` -> Using Beacon attributes for ${charName}.`, 'debug');
            return currency;
        }

        // Check for Beacon Sheet Store Attribute (Fallback)
        const storeAttr = findObjs({
            _type: 'attribute',
            _characterid: characterId,
            name: 'store'
        })[0];

        if (storeAttr) {
            this.log(` -> Found Beacon 'store' attribute for ${charName}. Attempting parse...`, 'debug');
            try {
                let storeData = storeAttr.get('current');
                if (typeof storeData === 'string') {
                    if (storeData.trim() === '') {
                        this.log(` -> Beacon 'store' attribute is empty for ${charName}.`, 'debug');
                        throw new Error("Store attribute is empty");
                    }
                    storeData = JSON.parse(storeData);
                }

                if (typeof storeData === 'object' && storeData !== null) {
                    const storeCurrencies = {};
                    
                    const searchForCurrency = (obj) => {
                        if (!obj) return;
                        if (Array.isArray(obj)) {
                            obj.forEach(item => searchForCurrency(item));
                        } else if (typeof obj === 'object') {
                            if (obj.name && obj.type === "Currency" && typeof obj.value === 'number') {
                                const coinName = obj.name.toLowerCase();
                                if (coinName === 'platinum') storeCurrencies.pp = obj.value;
                                else if (coinName === 'gold') storeCurrencies.gp = obj.value;
                                else if (coinName === 'electrum') storeCurrencies.ep = obj.value;
                                else if (coinName === 'silver') storeCurrencies.sp = obj.value;
                                else if (coinName === 'copper') storeCurrencies.cp = obj.value;
                            }
                            Object.values(obj).forEach(value => searchForCurrency(value));
                        }
                    };
                    searchForCurrency(storeData);

                    let foundInStore = false;
                    if (storeCurrencies.pp !== undefined) { currency.pp = storeCurrencies.pp; foundInStore = true; }
                    if (storeCurrencies.gp !== undefined) { currency.gp = storeCurrencies.gp; foundInStore = true; }
                    if (storeCurrencies.ep !== undefined) { currency.ep = storeCurrencies.ep; foundInStore = true; }
                    if (storeCurrencies.sp !== undefined) { currency.sp = storeCurrencies.sp; foundInStore = true; }
                    if (storeCurrencies.cp !== undefined) { currency.cp = storeCurrencies.cp; foundInStore = true; }

                    if (foundInStore) {
                        this.log(` -> Using Beacon 'store' attribute for ${charName}.`, 'debug');
                        return currency;
                    } else {
                        this.log(` -> No currency found within Beacon 'store' attribute for ${charName}.`, 'debug');
                    }
                }
            } catch (e) {
                this.log(` -> Error parsing Beacon 'store' attribute for ${charName}: ${e.message}`, 'warn');
            }
        }

        this.log(` -> No standard or Beacon currency attributes found for ${charName}. Returning zeroed currency.`, 'warn');
        return { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
    },
    
    /**
     * Set character's currency on character sheet
     * Handles multiple sheet types (Standard D&D 5e, Beacon, etc.)
     * @param {string} characterId - Character ID
     * @param {Object} newCurrency - New currency values
     * @returns {boolean} Success status
     */
    setCharacterCurrency(characterId, newCurrency) {
        const char = getObj('character', characterId);
        if (!char) {
            this.log(`Character not found for ID: ${characterId} when trying to set currency`, 'error');
            return false;
        }

        const charName = char.get('name');
        this.log(`💰 Setting currency for ${charName} (ID: ${characterId}) to: ` +
                 `${newCurrency.pp || 0}pp, ${newCurrency.gp || 0}gp, ${newCurrency.ep || 0}ep, ${newCurrency.sp || 0}sp, ${newCurrency.cp || 0}cp`, 'debug');

        let attributeUpdated = false;

        // Helper to set attribute value
        const setAttribute = (attrName, value) => {
            let attr = findObjs({ _type: 'attribute', _characterid: characterId, name: attrName })[0];
            if (attr) {
                attr.set('current', value);
                this.log(` -> Updated attribute ${attrName} to ${value}`, 'debug');
                attributeUpdated = true;
                return true;
            } else {
                this.log(` -> Attribute ${attrName} not found, could not update.`, 'debug');
                return false;
            }
        };

        // Attempt to update Standard D&D 5e Sheet Attributes
        const standardAttrs = ['pp', 'gp', 'ep', 'sp', 'cp'];
        let foundStandard = false;
        standardAttrs.forEach(coin => {
            const attrExists = findObjs({ _type: 'attribute', _characterid: characterId, name: coin })[0];
            if (attrExists) {
                foundStandard = true;
                setAttribute(coin, newCurrency[coin] || 0);
            }
        });

        if (foundStandard && attributeUpdated) {
            this.log(` -> Updated standard attributes for ${charName}.`, 'debug');
            return true;
        } else if (foundStandard && !attributeUpdated) {
            this.log(` -> Found standard attributes for ${charName}, but failed to update them.`, 'warn');
        }

        // Attempt to update Beacon Sheet Attributes (money_*)
        const beaconAttrs = {
            pp: 'money_pp',
            gp: 'money_gp',
            ep: 'money_ep',
            sp: 'money_sp',
            cp: 'money_cp'
        };
        let foundBeacon = false;
        attributeUpdated = false;
        Object.entries(beaconAttrs).forEach(([coin, attrName]) => {
            const attrExists = findObjs({ _type: 'attribute', _characterid: characterId, name: attrName })[0];
            if (attrExists) {
                foundBeacon = true;
                setAttribute(attrName, newCurrency[coin] || 0);
            }
        });

        if (foundBeacon && attributeUpdated) {
            this.log(` -> Updated Beacon attributes for ${charName}.`, 'debug');
            return true;
        } else if (foundBeacon && !attributeUpdated) {
            this.log(` -> Found Beacon attributes for ${charName}, but failed to update them.`, 'warn');
        }

        // Fallback: Could not find any known currency attributes
        if (!foundStandard && !foundBeacon) {
            this.log(` -> Could not find any known currency attributes to update for ${charName}.`, 'error');
        } else if (!attributeUpdated) {
            this.log(` -> Found currency attributes but failed to update them for ${charName}.`, 'error');
        }

        return attributeUpdated;
    },
    
    /**
     * Calculate total value of items array
     * @param {Array} items - Array of items with price and quantity
     * @returns {Object} Total currency object
     */
    calculateTotal(items) {
        let totalCopper = 0;
        
        items.forEach(item => {
            const itemPrice = this.toCopper(item.price);
            const quantity = item.quantity || 1;
            totalCopper += itemPrice * quantity;
        });
        
        return this.fromCopper(totalCopper);
    },
    
    /**
     * Apply price modifier to currency amount
     * @param {Object} price - Original price
     * @param {number} modifier - Modifier (e.g., 0.5 for half price, 1.2 for 20% markup)
     * @returns {Object} Modified price
     */
    applyModifier(price, modifier) {
        const copperValue = this.toCopper(price);
        const modifiedCopper = Math.max(1, Math.round(copperValue * modifier));
        return this.fromCopper(modifiedCopper);
    },
    
    /**
     * Check if player can afford a purchase
     * @param {Object} playerCurrency - Player's current currency
     * @param {Object} cost - Cost of purchase
     * @returns {boolean} Whether player can afford it
     */
    canAfford(playerCurrency, cost) {
        const playerCopper = this.toCopper(playerCurrency);
        const costCopper = this.toCopper(cost);
        return playerCopper >= costCopper;
    },
    
    /**
     * Subtract cost from player currency
     * @param {Object} playerCurrency - Player's current currency
     * @param {Object} cost - Cost to subtract
     * @returns {Object} Remaining currency
     */
    subtractCost(playerCurrency, cost) {
        const playerCopper = this.toCopper(playerCurrency);
        const costCopper = this.toCopper(cost);
        const remainingCopper = Math.max(0, playerCopper - costCopper);
        return this.fromCopper(remainingCopper);
    },
    
    /**
     * Add currency to existing amount
     * @param {Object} existing - Existing currency
     * @param {Object} addition - Currency to add
     * @returns {Object} Combined currency
     */
    addCurrency(existing, addition) {
        const existingCopper = this.toCopper(existing);
        const additionCopper = this.toCopper(addition);
        return this.fromCopper(existingCopper + additionCopper);
    },
    
    // Logging helper (uses ShopConfig if available)
    log(message, type = 'info') {
        const prefix = this.config?.LOGGING?.PREFIX?.[type] || '📜';
        log(`${prefix} CurrencyManager: ${message}`);
    }
};

// Export for Roll20 environment


// ============================================================================
// MODULE: MenuBuilder.js
// ============================================================================

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


// ============================================================================
// MODULE INITIALIZATION
// ============================================================================

// Initialize ShopSystemModules object
if (typeof ShopSystemModules === 'undefined') {
    var ShopSystemModules = {};
}

// Initialize modules in dependency order
ShopSystemModules.config = ShopConfig;
ShopSystemModules.currency = CurrencyManager.init(ShopConfig);
ShopSystemModules.menu = MenuBuilder.init(ShopConfig);





// Log module status
log('📦 ShopSystem Modules Loaded:');
log('  ✅ ShopConfig');
log('  ✅ CurrencyManager');
log('  ✅ MenuBuilder');

// Helper function to check if modules are available
function checkModules() {
    const required = ["ShopConfig","CurrencyManager","MenuBuilder"];
    const missing = required.filter(name => !ShopSystemModules[name.toLowerCase()]);
    
    if (missing.length > 0) {
        log('❌ Missing required modules: ' + missing.join(', '));
        return false;
    }
    
    log('✅ All required modules loaded successfully');
    return true;
}

// Validate module loading
checkModules();

// ============================================================================
// MAIN SHOPSYSTEM CODE BEGINS HERE
// ============================================================================
