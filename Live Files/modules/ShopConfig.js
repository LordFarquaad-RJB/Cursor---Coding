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
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShopConfig;
} else {
    this.ShopConfig = ShopConfig;
}