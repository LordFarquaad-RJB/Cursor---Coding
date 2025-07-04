/**
 * StockManager.js
 * 
 * Stock and inventory management module for the Shop System
 * Consolidates all stock operations, inventory management, and stock generation
 * 
 * Replaces:
 * - Stock management functions (Lines 4000-5000)
 * - Random stock generation
 * - Inventory display and formatting
 * - Stock manipulation operations
 * - Restock functionality
 * 
 * Estimated savings: 200-300 lines
 */

const StockManager = {
    // Reference to ShopConfig for configuration
    config: null,
    
    // Initialize with config reference
    init(shopConfig) {
        this.config = shopConfig;
        return this;
    },
    
    /**
     * Add item to shop stock
     * @param {Object} shop - Shop object to modify
     * @param {Function} databaseListItems - Database function to list items
     * @param {string} itemId - Item ID to add
     * @param {number} quantity - Quantity to add
     * @param {Object} customPrice - Custom price override
     * @returns {Promise} Promise resolving to operation result
     */
    async addItemToStock(shop, databaseListItems, itemId, quantity = 1, customPrice = null) {
        if (!shop) {
            return { success: false, error: "No shop provided" };
        }
        
        try {
            if (!shop.id) {
                throw new Error("Shop is not properly configured");
            }
            
            // Get item from database
            const items = await databaseListItems('all', 'all');
            const item = items.find(i => i.id === itemId);
            
            if (!item) {
                throw new Error(`Item ${itemId} not found in database`);
            }
            
            // Ensure shop inventory structure
            if (!shop.inventory) shop.inventory = {};
            if (!shop.inventory[item.category]) {
                shop.inventory[item.category] = [];
            }
            
            // Check if item already exists in shop
            const existingItemIndex = shop.inventory[item.category].findIndex(i => i.id === itemId);
            
            if (existingItemIndex !== -1) {
                // Update existing item
                const existingItem = shop.inventory[item.category][existingItemIndex];
                if (customPrice) {
                    existingItem.price = customPrice;
                    this.log(`Updated price of ${item.name} to ${this.formatCurrency(customPrice)}`, "info");
                }
                existingItem.quantity += quantity;
                existingItem.maxStock = (existingItem.maxStock || 0) + quantity;
                this.log(`Updated quantity of ${item.name} to ${existingItem.quantity}`, "info");
            } else {
                // Add new item to inventory
                shop.inventory[item.category].push({
                    id: item.id,
                    name: item.name,
                    quantity: quantity,
                    maxStock: quantity,
                    price: customPrice || item.price,
                    category: item.category,
                    rarity: item.rarity || 'common',
                    description: item.description || ""
                });
                
                const logPrice = customPrice ? this.formatCurrency(customPrice) : 'default';
                this.log(`Added ${quantity} ${item.name} (Price: ${logPrice}, MaxStock: ${quantity}) to shop inventory`, "info");
            }
            
            // Track last modified item
            this.trackLastModifiedItem(shop.id, itemId);
            
            // Save shop data
            const shopHandout = getObj("handout", shop.id);
            if (shopHandout) {
                shopHandout.set("gmnotes", JSON.stringify(shop, null, 2));
                return { success: true, item: item, quantity: quantity, priceUsed: customPrice || item.price };
            } else {
                throw new Error("Could not save shop data");
            }
            
        } catch (error) {
            this.log(`Error adding item to stock: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Remove item from shop stock
     * @param {Object} shop - Shop object to modify
     * @param {string} itemId - Item ID to remove
     * @param {number} quantity - Quantity to remove (0 = remove all)
     * @returns {boolean} Success status
     */
    removeItemFromStock(shop, itemId, quantity = 0) {
        if (!shop) {
            this.log("No shop provided", "error");
            return false;
        }
        
        let item = null;
        let itemCategory = '';
        let itemIndex = -1;
        
        // Find the item
        for (const category in shop.inventory) {
            if (Array.isArray(shop.inventory[category])) {
                const index = shop.inventory[category].findIndex(i => i.id === itemId);
                if (index !== -1) {
                    item = shop.inventory[category][index];
                    itemCategory = category;
                    itemIndex = index;
                    break;
                }
            }
        }
        
        if (!item) {
            this.log(`Item ${itemId} not found in shop inventory`, "error");
            return false;
        }
        
        if (quantity === 0 || quantity >= item.quantity) {
            // Remove item entirely
            shop.inventory[itemCategory].splice(itemIndex, 1);
            this.log(`Removed ${item.name} completely from shop inventory`, "info");
        } else {
            // Reduce quantity
            item.quantity -= quantity;
            this.log(`Reduced ${item.name} quantity by ${quantity} (now ${item.quantity})`, "info");
        }
        
        // Save shop data
        const shopHandout = getObj("handout", shop.id);
        if (shopHandout) {
            shopHandout.set("gmnotes", JSON.stringify(shop, null, 2));
            return true;
        }
        
        return false;
    },
    
    /**
     * Set item maximum stock
     * @param {Object} shop - Shop object to modify
     * @param {string} itemId - Item ID
     * @param {number} newMaxStock - New maximum stock value
     * @returns {boolean} Success status
     */
    setItemMaxStock(shop, itemId, newMaxStock) {
        if (!shop) {
            this.log("No shop provided", "error");
            return false;
        }
        
        let item = null;
        let itemCategory = '';
        let itemIndex = -1;
        
        // Find the item
        for (const category in shop.inventory) {
            if (Array.isArray(shop.inventory[category])) {
                const index = shop.inventory[category].findIndex(i => i.id === itemId);
                if (index !== -1) {
                    item = shop.inventory[category][index];
                    itemCategory = category;
                    itemIndex = index;
                    break;
                }
            }
        }
        
        if (!item) {
            this.log(`Item ${itemId} not found in shop inventory`, "error");
            return false;
        }
        
        if (newMaxStock === 0) {
            // Remove item entirely
            shop.inventory[itemCategory].splice(itemIndex, 1);
            this.log(`Removed ${item.name} from stock (max stock set to 0)`, "info");
        } else {
            item.maxStock = newMaxStock;
            // Ensure current quantity doesn't exceed new max
            if (item.quantity > newMaxStock) {
                item.quantity = newMaxStock;
            }
            this.log(`Updated max stock of ${item.name} to ${newMaxStock}`, "info");
        }
        
        // Save shop data
        const shopHandout = getObj("handout", shop.id);
        if (shopHandout) {
            shopHandout.set("gmnotes", JSON.stringify(shop, null, 2));
            return true;
        }
        
        return false;
    },
    
    /**
     * Set item current quantity
     * @param {Object} shop - Shop object to modify
     * @param {string} itemId - Item ID
     * @param {number} newQuantity - New quantity
     * @returns {boolean} Success status
     */
    setItemQuantity(shop, itemId, newQuantity) {
        if (!shop) {
            this.log("No shop provided", "error");
            return false;
        }
        
        let item = null;
        
        // Find the item
        for (const category in shop.inventory) {
            if (Array.isArray(shop.inventory[category])) {
                const foundItem = shop.inventory[category].find(i => i.id === itemId);
                if (foundItem) {
                    item = foundItem;
                    break;
                }
            }
        }
        
        if (!item) {
            this.log(`Item ${itemId} not found in shop inventory`, "error");
            return false;
        }
        
        const maxStock = item.maxStock || newQuantity;
        const cappedQuantity = Math.min(newQuantity, maxStock);
        
        item.quantity = cappedQuantity;
        this.log(`Updated quantity of ${item.name} to ${cappedQuantity}`, "info");
        
        // Save shop data
        const shopHandout = getObj("handout", shop.id);
        if (shopHandout) {
            shopHandout.set("gmnotes", JSON.stringify(shop, null, 2));
            return true;
        }
        
        return false;
    },
    
    /**
     * Set item price
     * @param {Object} shop - Shop object to modify
     * @param {string} itemId - Item ID
     * @param {Object} newPrice - New price object
     * @returns {boolean} Success status
     */
    setItemPrice(shop, itemId, newPrice) {
        if (!shop) {
            this.log("No shop provided", "error");
            return false;
        }
        
        let item = null;
        
        // Find the item
        for (const category in shop.inventory) {
            if (Array.isArray(shop.inventory[category])) {
                const foundItem = shop.inventory[category].find(i => i.id === itemId);
                if (foundItem) {
                    item = foundItem;
                    break;
                }
            }
        }
        
        if (!item) {
            this.log(`Item ${itemId} not found in shop inventory`, "error");
            return false;
        }
        
        item.price = newPrice;
        this.log(`Updated price of ${item.name} to ${this.formatCurrency(newPrice)}`, "info");
        
        // Save shop data
        const shopHandout = getObj("handout", shop.id);
        if (shopHandout) {
            shopHandout.set("gmnotes", JSON.stringify(shop, null, 2));
            return true;
        }
        
        return false;
    },
    
    /**
     * Generate random stock for shop
     * @param {Function} databaseListItems - Database function to list items
     * @param {Object} options - Generation options
     * @returns {Promise} Promise resolving to generated items
     */
    async generateRandomStock(databaseListItems, options = {}) {
        const {
            numItems = this.config?.STOCK_GENERATION?.DEFAULT_RANDOM_ITEMS || 10,
            categories = this.config?.ITEM?.CATEGORIES || ['weapons', 'equipment', 'potions'],
            rarities = this.config?.ITEM?.RARITIES || ['common', 'uncommon', 'rare'],
            useWeights = true
        } = options;
        
        try {
            // Get all items from database
            const allItems = await databaseListItems('all', 'all');
            
            if (!allItems || allItems.length === 0) {
                throw new Error("No items found in database");
            }
            
            const generatedItems = [];
            const rarityChances = this.config?.STOCK_GENERATION?.RARITY_CHANCES || {
                common: 70,
                uncommon: 20,
                rare: 8,
                "very rare": 1.5,
                legendary: 0.5
            };
            
            for (let i = 0; i < numItems; i++) {
                // Select rarity based on weights
                const selectedRarity = this.selectWeightedRarity(rarityChances);
                
                // Select category
                const selectedCategory = categories[Math.floor(Math.random() * categories.length)];
                
                // Find items matching criteria
                const availableItems = allItems.filter(item => 
                    item.rarity === selectedRarity && 
                    item.category === selectedCategory
                );
                
                if (availableItems.length > 0) {
                    const selectedItem = availableItems[Math.floor(Math.random() * availableItems.length)];
                    const quantity = this.generateQuantityForRarity(selectedRarity);
                    
                    generatedItems.push({
                        ...selectedItem,
                        quantity: quantity,
                        maxStock: quantity
                    });
                }
            }
            
            // Combine duplicates
            const combinedItems = this.combineDuplicateItems(generatedItems);
            
            this.log(`Generated ${combinedItems.length} unique items for stock`, "info");
            return combinedItems;
            
        } catch (error) {
            this.log(`Error generating random stock: ${error.message}`, 'error');
            return [];
        }
    },
    
    /**
     * Restock shop to maximum levels
     * @param {Object} shop - Shop object to restock
     * @param {Object} options - Restock options
     * @returns {number} Number of items restocked
     */
    restockShop(shop, options = {}) {
        if (!shop) {
            this.log("No shop provided", "error");
            return 0;
        }
        
        let itemsRestocked = 0;
        
        if (!shop.inventory) {
            this.log("Shop has no inventory to restock", "warn");
            return 0;
        }
        
        // Process each category
        for (const category in shop.inventory) {
            if (Array.isArray(shop.inventory[category])) {
                shop.inventory[category].forEach(item => {
                    if (item.maxStock && item.quantity < item.maxStock) {
                        const oldQuantity = item.quantity;
                        item.quantity = item.maxStock;
                        itemsRestocked++;
                        this.log(`Restocked ${item.name}: ${oldQuantity} → ${item.quantity}`, "debug");
                    }
                });
            }
        }
        
        if (itemsRestocked > 0) {
            // Save shop data
            const shopHandout = getObj("handout", shop.id);
            if (shopHandout) {
                shopHandout.set("gmnotes", JSON.stringify(shop, null, 2));
            }
            
            this.log(`Restocked ${itemsRestocked} items in ${shop.name}`, "info");
        } else {
            this.log("No items needed restocking", "info");
        }
        
        return itemsRestocked;
    },
    
    /**
     * Clear all stock from shop
     * @param {Object} shop - Shop object to clear
     * @returns {number} Number of items cleared
     */
    clearAllStock(shop) {
        if (!shop) {
            this.log("No shop provided", "error");
            return 0;
        }
        
        let itemsCleared = 0;
        
        if (shop.inventory) {
            for (const category in shop.inventory) {
                if (Array.isArray(shop.inventory[category])) {
                    itemsCleared += shop.inventory[category].length;
                    shop.inventory[category] = [];
                }
            }
        }
        
        // Save shop data
        const shopHandout = getObj("handout", shop.id);
        if (shopHandout) {
            shopHandout.set("gmnotes", JSON.stringify(shop, null, 2));
        }
        
        this.log(`Cleared ${itemsCleared} items from ${shop.name}`, "info");
        return itemsCleared;
    },
    
    /**
     * Format inventory for display
     * @param {Object} shop - Shop object
     * @returns {string} Formatted inventory display
     */
    formatInventory(shop) {
        if (!shop || !shop.inventory || Object.values(shop.inventory).every(arr => !arr || arr.length === 0)) {
            return "No items in stock.";
        }
        
        const stockLines = [];
        const categoryEmojis = this.config?.EMOJI?.CATEGORY || {};
        const rarityEmojis = this.config?.EMOJI?.RARITY || {};
        const qtyColor = '#FF8C00';
        const newItemColor = '#28a745';
        
        // Get highlighted items
        const lastModifiedId = this.getLastModifiedItem(shop.id);
        const idsToHighlight = this.getHighlightBatch(shop.id) || [];
        
        Object.entries(shop.inventory).forEach(([category, items]) => {
            if (items && items.length > 0) {
                const categoryEmoji = categoryEmojis[category] || "📦";
                stockLines.push(`<span style="color:#3399FF;font-weight:bold;">${categoryEmoji} ${category.charAt(0).toUpperCase() + category.slice(1)}:</span>`);
                
                items.forEach(item => {
                    const rarityEmoji = rarityEmojis[item.rarity] || '⚪';
                    const isHighlighted = idsToHighlight.includes(item.id) || item.id === lastModifiedId;
                    
                    let nameAndPriceSection;
                    
                    if (item.quantity === 0) {
                        const maxStockDisplay = item.maxStock !== undefined ? item.maxStock : '?';
                        const outOfStockStr = `<span style="color:${qtyColor};font-weight:bold;">(🔴/${maxStockDisplay}) Out of Stock</span>`;
                        nameAndPriceSection = `${rarityEmoji} ${outOfStockStr} - ${item.name} - <span style="color:inherit;">💰${this.formatCurrency(item.price)}</span>`;
                    } else {
                        const qtyDisplay = `<span style="color:${qtyColor};font-weight:bold;">(${item.quantity}/${item.maxStock ?? item.quantity})</span>`;
                        nameAndPriceSection = `${rarityEmoji} ${qtyDisplay} ${item.name} - <span style="color:inherit;">💰${this.formatCurrency(item.price)}</span>`;
                    }
                    
                    if (isHighlighted) {
                        nameAndPriceSection = `🔄 <span style="color:${newItemColor};">${nameAndPriceSection}</span>`;
                    }
                    
                    stockLines.push(`• ${nameAndPriceSection}`);
                    stockLines.push(`[📝 Edit](!shop stock qty ${item.id}) [❌ Remove](!shop stock removeitem ${item.id})`);
                });
            }
        });
        
        // Clear highlight tracking
        this.clearHighlightTracking(shop.id);
        
        return stockLines.length > 0 ? stockLines.join('\n') : 'No items in stock.';
    },
    
    /**
     * Get shop categories with item counts
     * @param {Object} shop - Shop object
     * @returns {Array} Categories with counts
     */
    getShopCategories(shop) {
        if (!shop || !shop.inventory) {
            return [];
        }
        
        const categories = [];
        const categoryEmojis = this.config?.EMOJI?.CATEGORY || {};
        
        for (const [category, items] of Object.entries(shop.inventory)) {
            if (items && items.length > 0) {
                const emoji = categoryEmojis[category] || "📦";
                const totalItems = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
                
                categories.push({
                    name: category,
                    emoji: emoji,
                    itemCount: items.length,
                    totalQuantity: totalItems
                });
            }
        }
        
        return categories.sort((a, b) => {
            const orderA = this.config?.ITEM?.CATEGORIES?.indexOf(a.name) ?? 999;
            const orderB = this.config?.ITEM?.CATEGORIES?.indexOf(b.name) ?? 999;
            return orderA - orderB;
        });
    },
    
    // ===================================================================
    // UTILITY METHODS
    // ===================================================================
    
    /**
     * Select rarity based on weighted chances
     * @param {Object} rarityChances - Rarity weights
     * @returns {string} Selected rarity
     */
    selectWeightedRarity(rarityChances) {
        const totalWeight = Object.values(rarityChances).reduce((sum, weight) => sum + weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const [rarity, weight] of Object.entries(rarityChances)) {
            random -= weight;
            if (random <= 0) {
                return rarity;
            }
        }
        
        return 'common'; // Fallback
    },
    
    /**
     * Generate quantity for rarity
     * @param {string} rarity - Item rarity
     * @returns {number} Generated quantity
     */
    generateQuantityForRarity(rarity) {
        const quantityConfig = this.config?.STOCK_GENERATION?.DEFAULT_QUANTITY || {
            common: "3d6",
            uncommon: "2d4",
            rare: "1d4",
            "very rare": "1d2",
            legendary: "1d2-1"
        };
        
        const diceNotation = quantityConfig[rarity] || "1d4";
        return this.rollDice(diceNotation);
    },
    
    /**
     * Roll dice notation
     * @param {string} notation - Dice notation (e.g., "3d6", "1d2-1")
     * @returns {number} Roll result
     */
    rollDice(notation) {
        if (!isNaN(notation)) {
            return parseInt(notation);
        }
        
        const match = notation.match(/^(\d+)d(\d+)(?:-(\d+))?$/);
        if (!match) {
            this.log(`Invalid dice notation: ${notation}. Defaulting to 1.`, 'warn');
            return 1;
        }
        
        const [_, numDiceStr, numSidesStr, subtractStr] = match;
        const numDice = parseInt(numDiceStr);
        const numSides = parseInt(numSidesStr);
        const subtractValue = subtractStr ? parseInt(subtractStr) : 0;
        
        if (numDice <= 0 || numSides <= 0) {
            this.log(`Invalid dice parameters in notation: ${notation}. Defaulting to 1.`, 'warn');
            return 1;
        }
        
        let total = 0;
        for (let i = 0; i < numDice; i++) {
            total += Math.floor(Math.random() * numSides) + 1;
        }
        
        return Math.max(0, total - subtractValue);
    },
    
    /**
     * Combine duplicate items in generated stock
     * @param {Array} items - Generated items
     * @returns {Array} Combined items
     */
    combineDuplicateItems(items) {
        const combined = [];
        
        items.forEach(item => {
            const existing = combined.find(i => i.id === item.id);
            if (existing) {
                existing.quantity += item.quantity;
                existing.maxStock = (existing.maxStock || 0) + (item.maxStock || item.quantity);
            } else {
                combined.push({ ...item });
            }
        });
        
        return combined;
    },
    
    /**
     * Track last modified item for highlighting (with safe state access)
     * @param {string} shopId - Shop ID
     * @param {string} itemId - Item ID
     */
    trackLastModifiedItem(shopId, itemId) {
        // Safely check if state system exists
        if (typeof state !== 'undefined' && state.ShopSystem) {
            if (!state.ShopSystem.lastModifiedStockItem) {
                state.ShopSystem.lastModifiedStockItem = {};
            }
            state.ShopSystem.lastModifiedStockItem[shopId] = itemId;
            this.log(`Tracked last modified item for shop ${shopId}: ${itemId}`, 'debug');
        } else {
            this.log('State system not available for tracking modified items', 'debug');
        }
    },
    
    /**
     * Get last modified item for highlighting (with safe state access)
     * @param {string} shopId - Shop ID
     * @returns {string|null} Item ID or null
     */
    getLastModifiedItem(shopId) {
        if (typeof state !== 'undefined' && state.ShopSystem && state.ShopSystem.lastModifiedStockItem) {
            return state.ShopSystem.lastModifiedStockItem[shopId] || null;
        }
        return null;
    },
    
    /**
     * Get batch of items to highlight (with safe state access)
     * @param {string} shopId - Shop ID
     * @returns {Array} Array of item IDs
     */
    getHighlightBatch(shopId) {
        if (typeof state !== 'undefined' && state.ShopSystem && state.ShopSystem.justAddedStockIds) {
            return state.ShopSystem.justAddedStockIds[shopId] || [];
        }
        return [];
    },
    
    /**
     * Clear highlight tracking after display (with safe state access)
     * @param {string} shopId - Shop ID
     */
    clearHighlightTracking(shopId) {
        if (typeof state !== 'undefined' && state.ShopSystem) {
            if (state.ShopSystem.justAddedStockIds && state.ShopSystem.justAddedStockIds[shopId]) {
                delete state.ShopSystem.justAddedStockIds[shopId];
                this.log(`Cleared batch highlight IDs for shop ${shopId}`, 'debug');
            }
            
            if (state.ShopSystem.lastModifiedStockItem && state.ShopSystem.lastModifiedStockItem[shopId]) {
                delete state.ShopSystem.lastModifiedStockItem[shopId];
                this.log(`Cleared single highlight ID for shop ${shopId}`, 'debug');
            }
        }
    },
    
    /**
     * Validate shop inventory structure
     * @param {Object} shop - Shop object
     * @returns {boolean} Whether inventory is valid
     */
    validateInventory(shop) {
        if (!shop || !shop.inventory) {
            return false;
        }
        
        for (const [category, items] of Object.entries(shop.inventory)) {
            if (!Array.isArray(items)) {
                this.log(`Invalid inventory structure: category ${category} is not an array`, 'warn');
                return false;
            }
            
            for (const item of items) {
                if (!item.id || !item.name || !item.price) {
                    this.log(`Invalid item in inventory: missing required fields`, 'warn');
                    return false;
                }
            }
        }
        
        return true;
    },
    
    // Helper methods
    log(message, type = 'info') {
        const prefix = this.config?.LOGGING?.PREFIX?.[type] || '📜';
        log(`${prefix} StockManager: ${message}`);
    },
    
    /**
     * Format currency using the currency manager or fallback
     * @param {Object} currency - Currency object
     * @returns {string} Formatted currency string
     */
    formatCurrency(currency) {
        // Try to use the global currency manager if available
        if (typeof ShopSystemModules !== 'undefined' && ShopSystemModules.currency) {
            return ShopSystemModules.currency.formatCurrency(currency);
        }
        
        // Fallback formatting
        if (!currency) return "0 gp";
        if (currency.gp) return `${currency.gp}gp`;
        if (currency.sp) return `${currency.sp}sp`;
        if (currency.cp) return `${currency.cp}cp`;
        return "0 gp";
    }
};

// Export for Roll20 environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StockManager;
} else {
    this.StockManager = StockManager;
}