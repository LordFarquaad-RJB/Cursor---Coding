/**
 * BasketManager.js
 * 
 * Unified basket management module for the Shop System
 * Consolidates all shopping basket operations for both buying and selling
 * 
 * Replaces:
 * - Buy basket functions (Lines 7500-8000+)
 * - Sell basket functions (Lines 7500-8000+)
 * - Basket state management and merging logic
 * - Basket checkout and transaction handling
 * - Character association with baskets
 * 
 * Estimated savings: 300-400 lines
 */

const BasketManager = {
    // Reference to ShopConfig for configuration
    config: null,
    
    // Initialize with config reference
    init(shopConfig) {
        this.config = shopConfig;
        this.initializeBasketState();
        return this;
    },
    
    /**
     * Initialize basket state structure
     */
    initializeBasketState() {
        if (!state.ShopSystem) {
            state.ShopSystem = {};
        }
        
        if (!state.ShopSystem.playerBaskets) {
            state.ShopSystem.playerBaskets = {};
        }
        
        if (!state.ShopSystem.sellBaskets) {
            state.ShopSystem.sellBaskets = {};
        }
        
        if (!state.ShopSystem.sellBasketCharacter) {
            state.ShopSystem.sellBasketCharacter = {};
        }
        
        if (!state.ShopSystem.basketMergeState) {
            state.ShopSystem.basketMergeState = {};
        }
    },
    
    // ===================================================================
    // BUY BASKET OPERATIONS
    // ===================================================================
    
    /**
     * Add item to buy basket
     * @param {string} playerId - Player ID
     * @param {string} itemId - Item ID to add
     * @param {number} quantity - Quantity to add
     */
    addToBuyBasket(playerId, itemId, quantity = 1) {
        // Check if baskets are merged
        if (this.isMerged(playerId)) {
            this.sendMessage(this.config?.BASKET_STATE?.ERROR_MESSAGES?.BASKETS_LOCKED || "❌ Cannot modify baskets while merged.", playerId);
            return;
        }
        
        if (!ShopSystem.state.activeShop) {
            this.sendMessage("❌ No active shop selected", playerId);
            return;
        }
        
        const shop = ShopSystem.state.activeShop;
        
        // Find the item in shop inventory
        let foundItem = null;
        let itemCategory = '';
        
        for (const [category, items] of Object.entries(shop.inventory || {})) {
            if (Array.isArray(items)) {
                const item = items.find(i => i.id === itemId);
                if (item) {
                    foundItem = item;
                    itemCategory = category;
                    break;
                }
            }
        }
        
        if (!foundItem) {
            this.sendMessage("❌ Item not found in shop", playerId);
            return;
        }
        
        // Check availability
        if (foundItem.quantity < quantity) {
            this.sendMessage(`❌ Not enough in stock. Available: ${foundItem.quantity}`, playerId);
            return;
        }
        
        // Initialize player basket if needed
        if (!state.ShopSystem.playerBaskets[playerId]) {
            state.ShopSystem.playerBaskets[playerId] = [];
        }
        
        // Check if item already in basket
        const existingItemIndex = state.ShopSystem.playerBaskets[playerId].findIndex(item => item.id === itemId);
        
        if (existingItemIndex !== -1) {
            // Update existing item
            const existingItem = state.ShopSystem.playerBaskets[playerId][existingItemIndex];
            const newQuantity = existingItem.quantity + quantity;
            
            if (newQuantity > foundItem.quantity) {
                this.sendMessage(`❌ Cannot add more than available. Total would be ${newQuantity}, but only ${foundItem.quantity} available.`, playerId);
                return;
            }
            
            existingItem.quantity = newQuantity;
        } else {
            // Add new item to basket
            state.ShopSystem.playerBaskets[playerId].push({
                id: foundItem.id,
                name: foundItem.name,
                price: foundItem.price,
                quantity: quantity,
                category: itemCategory,
                rarity: foundItem.rarity || 'common'
            });
        }
        
        this.sendMessage(`✅ Added ${quantity} ${foundItem.name} to your basket`, playerId);
        this.saveBasketState();
    },
    
    /**
     * Remove item from buy basket
     * @param {string} playerId - Player ID  
     * @param {number} index - Index of item to remove
     */
    removeFromBuyBasket(playerId, index) {
        // Check if baskets are merged
        if (this.isMerged(playerId)) {
            this.sendMessage(this.config?.BASKET_STATE?.ERROR_MESSAGES?.BASKETS_LOCKED || "❌ Cannot modify baskets while merged.", playerId);
            return;
        }
        
        if (!state.ShopSystem.playerBaskets[playerId] || 
            index >= state.ShopSystem.playerBaskets[playerId].length || 
            index < 0) {
            this.sendMessage('❌ Item not found in your basket!', playerId);
            return;
        }
        
        const removedItem = state.ShopSystem.playerBaskets[playerId][index];
        state.ShopSystem.playerBaskets[playerId].splice(index, 1);
        
        this.sendMessage(`✅ Removed ${removedItem.name} from your basket`, playerId);
        this.saveBasketState();
        this.viewBuyBasket(playerId);
    },
    
    /**
     * View buy basket contents
     * @param {string} playerId - Player ID
     */
    viewBuyBasket(playerId) {
        if (!state.ShopSystem.playerBaskets[playerId] || 
            state.ShopSystem.playerBaskets[playerId].length === 0) {
            this.sendMessage('🧺 Your basket is empty!', playerId);
            return;
        }
        
        const basket = state.ShopSystem.playerBaskets[playerId];
        const totalPrice = this.calculateBasketTotal(basket);
        
        // Create basket content display
        const itemsList = basket.map((item, index) => {
            const qtyStr = item.quantity > 1 ? ` (x${item.quantity})` : '';
            const itemTotal = ShopSystemModules.currency.toCopper(item.price) * item.quantity;
            const formattedTotal = ShopSystemModules.currency.formatCurrency(ShopSystemModules.currency.fromCopper(itemTotal));
            
            return `• ${item.name}${qtyStr} - ${ShopSystemModules.currency.formatCurrency(item.price)} each = ${formattedTotal}\n` +
                   `   [❌ Remove](!shop basket remove ${index})`;
        }).join('\n');
        
        // Check if merging is possible
        const canMerge = this.canMergeBaskets(playerId);
        
        let menu = ShopSystemModules.menu.createMenu("🧺 Shopping Basket", {
            "Items": itemsList,
            "Total Cost": `💰${ShopSystemModules.currency.formatCurrency(totalPrice)}`,
            "Actions": this.buildBuyBasketActions(playerId, canMerge)
        });
        
        this.sendMessage(menu, playerId);
    },
    
    /**
     * Clear buy basket
     * @param {string} playerId - Player ID
     */
    clearBuyBasket(playerId) {
        if (!state.ShopSystem.playerBaskets[playerId] || 
            state.ShopSystem.playerBaskets[playerId].length === 0) {
            this.sendMessage('❌ Your basket is already empty!', playerId);
            return;
        }
        
        state.ShopSystem.playerBaskets[playerId] = [];
        this.clearHaggleResults(playerId);
        this.saveBasketState();
        
        this.sendMessage('✅ Your basket has been cleared', playerId);
    },
    
    // ===================================================================
    // SELL BASKET OPERATIONS
    // ===================================================================
    
    /**
     * Add item to sell basket
     * @param {string} playerId - Player ID
     * @param {string} itemPath - Item path/ID
     * @param {number} quantity - Quantity to add
     */
    addToSellBasket(playerId, itemPath, quantity = 1) {
        // Check if baskets are merged
        if (this.isMerged(playerId)) {
            this.sendMessage(this.config?.BASKET_STATE?.ERROR_MESSAGES?.BASKETS_LOCKED || "❌ Cannot modify baskets while merged.", playerId);
            return;
        }
        
        if (!ShopSystem.state.activeShop) {
            this.sendMessage('❌ No active shop!', playerId);
            return;
        }
        
        // Initialize sell basket if needed
        if (!state.ShopSystem.sellBaskets[playerId]) {
            state.ShopSystem.sellBaskets[playerId] = [];
        }
        
        // Get character ID from state
        const characterId = state.ShopSystem.sellBasketCharacter?.[playerId];
        
        if (!characterId) {
            this.sendMessage('❌ Character not identified for sell basket. Please use "!shop sell from [character]" first.', playerId);
            return;
        }
        
        const character = getObj('character', characterId);
        if (!character) {
            this.sendMessage('❌ Character not found', playerId);
            return;
        }
        
        // Extract inventory and process item
        this.processInventoryForSell(characterId, playerId, itemPath, quantity);
    },
    
    /**
     * Process character inventory for selling
     * @param {string} characterId - Character ID
     * @param {string} playerId - Player ID
     * @param {string} itemPath - Item path
     * @param {number} quantity - Quantity to sell
     */
    async processInventoryForSell(characterId, playerId, itemPath, quantity) {
        try {
            // This would integrate with the existing inventory extraction logic
            const result = await ShopSystem.shop.SELL_LOG_ExtractInventory(characterId, playerId);
            const { items } = result;
            
            const foundItem = items.find(item => item.id === itemPath);
            
            if (!foundItem) {
                this.sendMessage('❌ Item not found in inventory!', playerId);
                return;
            }
            
            const availableQty = foundItem.quantity || 1;
            quantity = Math.min(quantity, availableQty);
            
            if (quantity <= 0) {
                this.sendMessage('❌ Invalid quantity', playerId);
                return;
            }
            
            // Check if item already in basket
            const existingItemIndex = state.ShopSystem.sellBaskets[playerId].findIndex(item => item.id === itemPath);
            
            // Calculate sell price
            const shop = ShopSystem.state.activeShop;
            const sellModifier = shop.price_modifiers?.sell || this.config?.PRICING?.SELL_PRICE_MODIFIER || 0.5;
            
            let sellPrice = { gp: 0 };
            if (foundItem.price) {
                const itemCopper = ShopSystemModules.currency.toCopper(foundItem.price);
                const sellCopper = Math.floor(itemCopper * sellModifier);
                sellPrice = ShopSystemModules.currency.fromCopper(sellCopper);
            }
            
            if (existingItemIndex !== -1) {
                // Update existing item
                const currentQty = state.ShopSystem.sellBaskets[playerId][existingItemIndex].quantity;
                const newQty = currentQty + quantity;
                
                if (newQty > availableQty) {
                    this.sendMessage(`❌ Cannot add more than available in inventory (${availableQty})`, playerId);
                    return;
                }
                
                state.ShopSystem.sellBaskets[playerId][existingItemIndex].quantity = newQty;
            } else {
                // Add new item to basket
                state.ShopSystem.sellBaskets[playerId].push({
                    id: foundItem.id,
                    name: foundItem.name,
                    type: foundItem.type || "Item",
                    description: foundItem.description || "",
                    quantity: quantity,
                    price: sellPrice,
                    baseValue: foundItem.price,
                    data: foundItem.data,
                    category: foundItem.category,
                    rarity: foundItem.rarity || 'common',
                    characterId: characterId
                });
            }
            
            // Track character association
            state.ShopSystem.sellBasketCharacter[playerId] = characterId;
            
            this.sendMessage(`✅ Added ${quantity} ${foundItem.name} to your sell basket`, playerId);
            this.viewSellBasket(playerId);
            
        } catch (error) {
            this.log(`Error adding to sell basket: ${error.message}`, 'error');
            this.sendMessage(`❌ Error adding to sell basket: ${error.message}`, playerId);
        }
    },
    
    /**
     * Remove item from sell basket
     * @param {string} playerId - Player ID
     * @param {number} index - Index of item to remove
     */
    removeFromSellBasket(playerId, index) {
        // Check if baskets are merged
        if (this.isMerged(playerId)) {
            this.sendMessage(this.config?.BASKET_STATE?.ERROR_MESSAGES?.BASKETS_LOCKED || "❌ Cannot modify baskets while merged.", playerId);
            return;
        }
        
        if (!state.ShopSystem.sellBaskets[playerId] || 
            index >= state.ShopSystem.sellBaskets[playerId].length || 
            index < 0) {
            this.sendMessage('❌ Item not found in your sell basket!', playerId);
            return;
        }
        
        const removedItem = state.ShopSystem.sellBaskets[playerId][index];
        state.ShopSystem.sellBaskets[playerId].splice(index, 1);
        
        this.sendMessage(`✅ Removed ${removedItem.name} from your sell basket`, playerId);
        this.viewSellBasket(playerId);
    },
    
    /**
     * View sell basket contents
     * @param {string} playerId - Player ID
     */
    viewSellBasket(playerId) {
        if (!state.ShopSystem.sellBaskets[playerId] || 
            state.ShopSystem.sellBaskets[playerId].length === 0) {
            this.sendMessage('📭 Your sell basket is empty!', playerId);
            return;
        }
        
        const basket = state.ShopSystem.sellBaskets[playerId];
        const totalPrice = this.calculateBasketTotal(basket);
        
        // Create basket content display
        const itemsList = basket.map((item, index) => {
            const qtyStr = item.quantity > 1 ? ` (x${item.quantity})` : '';
            return `• ${item.name}${qtyStr} - ${ShopSystemModules.currency.formatCurrency(item.price)} each\n` +
                   `   [❌ Remove](!shop sell remove ${index})`;
        }).join('\n');
        
        // Get character info
        let characterSection = "";
        if (state.ShopSystem.sellBasketCharacter?.[playerId]) {
            const characterId = state.ShopSystem.sellBasketCharacter[playerId];
            const character = getObj('character', characterId);
            if (character) {
                characterSection = character.get('name');
            }
        }
        
        const canMerge = this.canMergeBaskets(playerId);
        
        const sections = {
            "Items": itemsList,
            "Total Value": `💰${ShopSystemModules.currency.formatCurrency(totalPrice)}`,
            "Actions": this.buildSellBasketActions(playerId, canMerge)
        };
        
        if (characterSection) {
            sections["Character"] = characterSection;
        }
        
        const menu = ShopSystemModules.menu.createMenu("🧺 Items to Sell", sections);
        this.sendMessage(menu, playerId);
    },
    
    /**
     * Clear sell basket
     * @param {string} playerId - Player ID
     */
    clearSellBasket(playerId) {
        if (!state.ShopSystem.sellBaskets[playerId] || 
            state.ShopSystem.sellBaskets[playerId].length === 0) {
            this.sendMessage('❌ Your sell basket is already empty!', playerId);
            return;
        }
        
        state.ShopSystem.sellBaskets[playerId] = [];
        this.clearHaggleResults(playerId);
        
        // Clear character tracking
        if (state.ShopSystem.sellBasketCharacter?.[playerId]) {
            delete state.ShopSystem.sellBasketCharacter[playerId];
        }
        
        this.sendMessage('✅ Your sell basket has been cleared', playerId);
    },
    
    // ===================================================================
    // BASKET MERGING OPERATIONS
    // ===================================================================
    
    /**
     * Check if baskets can be merged
     * @param {string} playerId - Player ID
     * @returns {boolean} Whether baskets can be merged
     */
    canMergeBaskets(playerId) {
        const hasBuyItems = state.ShopSystem.playerBaskets[playerId] && state.ShopSystem.playerBaskets[playerId].length > 0;
        const hasSellItems = state.ShopSystem.sellBaskets?.[playerId] && state.ShopSystem.sellBaskets[playerId].length > 0;
        const isNotMerged = !this.isMerged(playerId);
        
        return hasBuyItems && hasSellItems && isNotMerged;
    },
    
    /**
     * Check if baskets are currently merged
     * @param {string} playerId - Player ID
     * @returns {boolean} Whether baskets are merged
     */
    isMerged(playerId) {
        return state.ShopSystem.basketMergeState?.[playerId]?.merged || false;
    },
    
    /**
     * Merge buy and sell baskets
     * @param {string} playerId - Player ID
     */
    mergeBaskets(playerId) {
        if (!this.canMergeBaskets(playerId)) {
            this.sendMessage(this.config?.BASKET_STATE?.ERROR_MESSAGES?.NEED_BOTH_BASKETS || "❌ Need items in both buy and sell baskets to merge.", playerId);
            return;
        }
        
        if (this.isMerged(playerId)) {
            this.sendMessage(this.config?.BASKET_STATE?.ERROR_MESSAGES?.ALREADY_MERGED || "❌ Baskets are already merged.", playerId);
            return;
        }
        
        // Set merge state
        if (!state.ShopSystem.basketMergeState) {
            state.ShopSystem.basketMergeState = {};
        }
        
        state.ShopSystem.basketMergeState[playerId] = {
            merged: true,
            timestamp: Date.now()
        };
        
        this.sendMessage('✅ Baskets merged! You can now checkout both together or haggle for the combined transaction.', playerId);
        this.viewMergedBaskets(playerId);
    },
    
    /**
     * Unmerge baskets
     * @param {string} playerId - Player ID
     */
    unmergeBaskets(playerId) {
        if (!this.isMerged(playerId)) {
            this.sendMessage(this.config?.BASKET_STATE?.ERROR_MESSAGES?.NOT_MERGED || "❌ Baskets are not merged.", playerId);
            return;
        }
        
        delete state.ShopSystem.basketMergeState[playerId];
        
        this.sendMessage('✅ Baskets unmerged! You can now modify them separately.', playerId);
    },
    
    /**
     * View merged baskets
     * @param {string} playerId - Player ID
     */
    viewMergedBaskets(playerId) {
        if (!this.isMerged(playerId)) {
            this.sendMessage(this.config?.BASKET_STATE?.ERROR_MESSAGES?.NOT_MERGED || "❌ Baskets are not merged.", playerId);
            return;
        }
        
        const buyBasket = state.ShopSystem.playerBaskets[playerId] || [];
        const sellBasket = state.ShopSystem.sellBaskets[playerId] || [];
        
        const buyTotal = this.calculateBasketTotal(buyBasket);
        const sellTotal = this.calculateBasketTotal(sellBasket);
        
        const buyTotalCopper = ShopSystemModules.currency.toCopper(buyTotal);
        const sellTotalCopper = ShopSystemModules.currency.toCopper(sellTotal);
        const netCopper = sellTotalCopper - buyTotalCopper;
        
        const netAmount = ShopSystemModules.currency.fromCopper(Math.abs(netCopper));
        const transactionType = netCopper >= 0 ? "You receive" : "You pay";
        
        const sections = {
            "Buying": this.formatBasketItems(buyBasket),
            "Buy Total": `💰${ShopSystemModules.currency.formatCurrency(buyTotal)}`,
            "Selling": this.formatBasketItems(sellBasket),
            "Sell Total": `💰${ShopSystemModules.currency.formatCurrency(sellTotal)}`,
            "Net Transaction": `${transactionType}: 💰${ShopSystemModules.currency.formatCurrency(netAmount)}`,
            "Actions": this.buildMergedBasketActions(playerId)
        };
        
        const menu = ShopSystemModules.menu.createMenu("🔄 Merged Transaction", sections);
        this.sendMessage(menu, playerId);
    },
    
    // ===================================================================
    // UTILITY METHODS
    // ===================================================================
    
    /**
     * Calculate total price of basket items
     * @param {Array} basket - Basket items
     * @returns {Object} Total price object
     */
    calculateBasketTotal(basket) {
        let totalCopper = 0;
        
        basket.forEach(item => {
            const itemPrice = ShopSystemModules.currency.toCopper(item.price);
            totalCopper += itemPrice * item.quantity;
        });
        
        return ShopSystemModules.currency.fromCopper(totalCopper);
    },
    
    /**
     * Format basket items for display
     * @param {Array} basket - Basket items
     * @returns {string} Formatted item list
     */
    formatBasketItems(basket) {
        if (!basket || basket.length === 0) {
            return "No items";
        }
        
        return basket.map(item => {
            const qtyStr = item.quantity > 1 ? ` (x${item.quantity})` : '';
            return `• ${item.name}${qtyStr} - ${ShopSystemModules.currency.formatCurrency(item.price)} each`;
        }).join('\n');
    },
    
    /**
     * Build action buttons for buy basket
     * @param {string} playerId - Player ID
     * @param {boolean} canMerge - Whether merging is possible
     * @returns {string} Action buttons
     */
    buildBuyBasketActions(playerId, canMerge) {
        const actions = [
            "[💰 Checkout](!shop basket checkout)",
            "[🗑️ Clear Basket](!shop basket clear)",
            "[🔊 Haggle](!shop basket haggle_buy)"
        ];
        
        if (canMerge) {
            actions.push("[🔄 Merge with Sell Basket](!shop basket merge)");
        }
        
        actions.push("[🏪 Back to Shop](!shop)");
        
        return actions.join(" ");
    },
    
    /**
     * Build action buttons for sell basket
     * @param {string} playerId - Player ID
     * @param {boolean} canMerge - Whether merging is possible
     * @returns {string} Action buttons
     */
    buildSellBasketActions(playerId, canMerge) {
        const actions = [
            "[💰 Complete Sale](!shop sell checkout)",
            "[🗑️ Clear Basket](!shop sell clear)",
            "[🔊 Haggle](!shop basket haggle_sell)"
        ];
        
        if (canMerge) {
            actions.push("[🔄 Merge with Buy Basket](!shop basket merge)");
        }
        
        actions.push("[🏪 Back to Shop](!shop)");
        
        return actions.join(" ");
    },
    
    /**
     * Build action buttons for merged baskets
     * @param {string} playerId - Player ID
     * @returns {string} Action buttons
     */
    buildMergedBasketActions(playerId) {
        return [
            "[💰 Complete Transaction](!shop basket complete)",
            "[🔊 Haggle Combined](!shop basket haggle_combined)",
            "[🔄 Unmerge Baskets](!shop basket unmerge)",
            "[🏪 Back to Shop](!shop)"
        ].join(" ");
    },
    
    /**
     * Clear haggle results for player
     * @param {string} playerId - Player ID
     */
    clearHaggleResults(playerId) {
        if (state.ShopSystem.haggleResults?.[playerId]) {
            delete state.ShopSystem.haggleResults[playerId];
            this.log(`Cleared haggle results for player ${playerId}`, 'debug');
        }
    },
    
    /**
     * Save basket state
     */
    saveBasketState() {
        // This would integrate with the existing state saving mechanism
        // For now, state is automatically persisted by Roll20
    },
    
    /**
     * Unlock baskets (remove merge state)
     * @param {string} playerId - Player ID
     */
    unlockBaskets(playerId) {
        if (state.ShopSystem.basketMergeState?.[playerId]) {
            delete state.ShopSystem.basketMergeState[playerId];
        }
    },
    
    /**
     * Get basket summary for receipts/confirmations
     * @param {string} playerId - Player ID
     * @returns {Object} Basket summary
     */
    getBasketSummary(playerId) {
        const buyBasket = state.ShopSystem.playerBaskets[playerId] || [];
        const sellBasket = state.ShopSystem.sellBaskets[playerId] || [];
        
        return {
            buyBasket,
            sellBasket,
            buyTotal: this.calculateBasketTotal(buyBasket),
            sellTotal: this.calculateBasketTotal(sellBasket),
            isMerged: this.isMerged(playerId),
            characterId: state.ShopSystem.sellBasketCharacter?.[playerId]
        };
    },
    
    // Helper methods
    sendMessage(message, playerId) {
        if (playerId) {
            ShopSystem.utils.chat(message, playerId);
        } else {
            ShopSystem.utils.chat(message);
        }
    },
    
    log(message, type = 'info') {
        const prefix = this.config?.LOGGING?.PREFIX?.[type] || '📜';
        log(`${prefix} BasketManager: ${message}`);
    }
};

// Export for Roll20 environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BasketManager;
} else {
    this.BasketManager = BasketManager;
}