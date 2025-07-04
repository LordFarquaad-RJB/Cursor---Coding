/**
 * DatabaseManager.js
 * 
 * Database operations and item management module for the Shop System
 * Consolidates all database functionality, item CRUD operations, and data persistence
 * 
 * Replaces:
 * - Database initialization and management (Lines 1070-1400)
 * - Item CRUD operations (Lines 1900-2500)
 * - Character currency operations (Lines 2100-2250)
 * - Database command handling (Lines 1400-1900)
 * - Roll20 object interactions (findObjs, createObj, getObj calls)
 * 
 * Estimated savings: 400-500 lines
 */

const DatabaseManager = {
    // Reference to ShopConfig for configuration
    config: null,
    
    // Initialize with config reference
    init(shopConfig) {
        this.config = shopConfig;
        return this;
    },
    
    // ===================================================================
    // DATABASE INITIALIZATION AND CORE OPERATIONS
    // ===================================================================
    
    /**
     * Initialize the item database
     * @returns {Object} Database handout object
     */
    initialize() {
        let handout = this.findDatabaseHandout();
        
        if (!handout) {
            handout = this.createDatabaseHandout();
            this.log(`Created new ${this.config?.HANDOUT?.DATABASE || 'Item-Database'} handout.`, "success");
        } else {
            this.log(`Found existing ${this.config?.HANDOUT?.DATABASE || 'Item-Database'} handout.`, "info");
        }
        
        return handout;
    },
    
    /**
     * Find the database handout
     * @returns {Object|null} Database handout or null if not found
     */
    findDatabaseHandout() {
        const databaseName = this.config?.HANDOUT?.DATABASE || 'Item-Database';
        return findObjs({ _type: "handout", name: databaseName })[0] || null;
    },
    
    /**
     * Create new database handout with initial structure
     * @returns {Object} Created handout object
     */
    createDatabaseHandout() {
        const databaseName = this.config?.HANDOUT?.DATABASE || 'Item-Database';
        const handout = createObj("handout", { name: databaseName });
        
        // Initialize with empty database structure
        const initialData = {
            type: "item_database",
            version: this.config?.VERSION || '1.0.0',
            items: {}
        };
        
        // Initialize categories and rarities from config
        const rarities = this.config?.ITEM?.RARITIES || ['common', 'uncommon', 'rare', 'very rare', 'legendary'];
        const categories = this.config?.ITEM?.CATEGORIES || ['weapons', 'equipment', 'potions'];
        
        rarities.forEach(rarity => {
            initialData.items[rarity] = {};
            categories.forEach(category => {
                initialData.items[rarity][category] = [];
            });
        });
        
        handout.set("gmnotes", JSON.stringify(initialData, null, 2));
        return handout;
    },
    
    /**
     * Process and validate item data
     * @param {Object} item - Raw item data
     * @returns {Object} Processed item data
     */
    processItem(item) {
        // Ensure required fields
        if (!item.id) {
            item.id = item.name ? 
                item.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') : 
                `item_${Date.now()}`;
        }
        
        // Ensure price is valid
        if (!item.price || Object.keys(item.price).length === 0) {
            item.price = { gp: 0 };
        }
        
        // Ensure rarity is valid
        const validRarities = this.config?.ITEM?.RARITIES || ['common'];
        if (!item.rarity || !validRarities.includes(item.rarity)) {
            item.rarity = this.config?.ITEM?.DEFAULT_RARITY || 'common';
        }
        
        // Ensure category is valid (case-insensitive check)
        const validCategories = this.config?.ITEM?.CATEGORIES || ['equipment'];
        if (!item.category) {
            item.category = this.config?.ITEM?.DEFAULT_CATEGORY || 'equipment';
        } else {
            const lowerCaseItemCategory = item.category.toLowerCase();
            const foundCategory = validCategories.find(
                cfgCategory => cfgCategory.toLowerCase() === lowerCaseItemCategory
            );
            if (foundCategory) {
                item.category = foundCategory; // Assign canonical name
            } else {
                item.category = this.config?.ITEM?.DEFAULT_CATEGORY || 'equipment';
            }
        }
        
        return item;
    },
    
    // ===================================================================
    // ITEM CRUD OPERATIONS
    // ===================================================================
    
    /**
     * List items by category and rarity
     * @param {string} category - Category filter ('all' for all categories)
     * @param {string} rarity - Rarity filter ('all' for all rarities)
     * @returns {Promise<Array>} Promise resolving to array of items
     */
    listItems(category, rarity) {
        const handout = this.findDatabaseHandout();
        
        if (!handout) {
            this.log("Item database not found! Initialize it first.", "error");
            return Promise.resolve([]);
        }
        
        return new Promise((resolve, reject) => {
            handout.get("gmnotes", (notes) => {
                try {
                    const cleanNotes = this.cleanHandoutNotes(notes);
                    const data = JSON.parse(cleanNotes);
                    
                    if (!data || !data.items) {
                        this.log("Invalid database format!", "error");
                        resolve([]);
                        return;
                    }
                    
                    // Normalize inputs
                    const effectiveCategory = (category && category.toLowerCase() !== 'all') ? category.toLowerCase() : 'all';
                    const effectiveRarity = (rarity && rarity.toLowerCase() !== 'all') ? rarity.toLowerCase() : 'all';
                    
                    this.log(`listItems lookup: category='${effectiveCategory}', rarity='${effectiveRarity}'`, 'debug');
                    
                    let items = [];
                    
                    if (effectiveCategory === "all" && effectiveRarity === "all") {
                        // Get all items
                        Object.keys(data.items).forEach(rar => {
                            if (data.items[rar]) {
                                Object.keys(data.items[rar]).forEach(cat => {
                                    if (data.items[rar][cat]) {
                                        items = items.concat(data.items[rar][cat]);
                                    }
                                });
                            }
                        });
                    } else if (effectiveCategory === "all") {
                        // Filter by rarity only
                        if (data.items[effectiveRarity]) {
                            Object.keys(data.items[effectiveRarity]).forEach(cat => {
                                if (data.items[effectiveRarity][cat]) {
                                    items = items.concat(data.items[effectiveRarity][cat]);
                                }
                            });
                        }
                    } else if (effectiveRarity === "all") {
                        // Filter by category only
                        const validCategories = this.config?.ITEM?.CATEGORIES || [];
                        const canonicalCategory = validCategories.find(c => c.toLowerCase() === effectiveCategory);
                        
                        if (canonicalCategory) {
                            Object.keys(data.items).forEach(rar => {
                                if (data.items[rar] && data.items[rar][canonicalCategory]) {
                                    items = items.concat(data.items[rar][canonicalCategory]);
                                }
                            });
                        } else if (effectiveCategory !== "all") {
                            this.log(`Unknown category requested: ${category}`, "warn");
                        }
                    } else {
                        // Filter by specific category and rarity
                        const validCategories = this.config?.ITEM?.CATEGORIES || [];
                        const canonicalCategory = validCategories.find(c => c.toLowerCase() === effectiveCategory);
                        
                        if (canonicalCategory) {
                            if (data.items[effectiveRarity] && data.items[effectiveRarity][canonicalCategory]) {
                                items = data.items[effectiveRarity][canonicalCategory] || [];
                            }
                        } else if (effectiveCategory !== "all") {
                            this.log(`Unknown category requested: ${category}`, "warn");
                        }
                    }
                    
                    // Ensure items is always an array
                    if (!Array.isArray(items)) {
                        items = [];
                    }
                    
                    this.log(`Found ${items.length} items matching criteria`, 'info');
                    resolve(items);
                    
                } catch (error) {
                    this.log(`Error parsing database: ${error.message}`, "error");
                    reject(new Error(`Error parsing database: ${error.message}`));
                }
            });
        });
    },
    
    /**
     * Batch import multiple items
     * @param {Array} items - Array of items to import
     * @returns {Promise<Object>} Promise resolving to import results
     */
    batchImport(items) {
        const handout = this.findDatabaseHandout();
        
        if (!handout) {
            this.log("Item-Database handout not found!", "error");
            return Promise.reject(new Error("Database not initialized"));
        }
        
        return new Promise((resolve, reject) => {
            handout.get("gmnotes", (notes) => {
                try {
                    const cleanNotes = this.cleanHandoutNotes(notes) || '{"items":{}}';
                    let data;
                    
                    try {
                        data = JSON.parse(cleanNotes);
                    } catch (parseError) {
                        data = { items: {} };
                    }
                    
                    if (!data.items) {
                        data.items = {};
                    }
                    
                    const results = {
                        success: 0,
                        failed: 0,
                        skipped: 0,
                        errors: []
                    };
                    
                    // Process each item
                    for (let item of items) {
                        try {
                            item = this.processItem(item);
                            
                            if (!item.rarity || !item.category) {
                                results.failed++;
                                results.errors.push(`Missing rarity or category for item: ${item.name || 'Unknown'}`);
                                continue;
                            }
                            
                            // Ensure category exists for rarity
                            if (!data.items[item.rarity]) {
                                data.items[item.rarity] = {};
                            }
                            if (!data.items[item.rarity][item.category]) {
                                data.items[item.rarity][item.category] = [];
                            }
                            
                            // Check for duplicates
                            const isDuplicate = data.items[item.rarity][item.category].some(
                                existingItem => existingItem.id === item.id
                            );
                            
                            if (isDuplicate) {
                                results.skipped++;
                                continue;
                            }
                            
                            // Add item
                            data.items[item.rarity][item.category].push(item);
                            results.success++;
                            
                        } catch (itemError) {
                            results.failed++;
                            results.errors.push(`Error processing item ${item.name || 'Unknown'}: ${itemError.message}`);
                        }
                    }
                    
                    // Save updated database
                    handout.get("gmnotes", (currentNotes) => {
                        const currentData = JSON.parse(this.cleanHandoutNotes(currentNotes));
                        const updatedData = { ...currentData, items: data.items };
                        handout.set("gmnotes", JSON.stringify(updatedData, null, 2));
                        resolve(results);
                    });
                    
                } catch (error) {
                    this.log(`Error in batch import: ${error.message}`, "error");
                    reject(error);
                }
            });
        });
    },
    
    /**
     * Remove item from database and all shops
     * @param {string} itemId - Item ID to remove
     * @returns {Promise<Object>} Promise resolving to removal results
     */
    removeItem(itemId) {
        return new Promise((resolve, reject) => {
            const dbHandout = this.findDatabaseHandout();
            if (!dbHandout) {
                reject(new Error("Item database not found!"));
                return;
            }
            
            let removedItemName = null;
            
            // Step 1: Remove from database
            dbHandout.get("gmnotes", (notes) => {
                try {
                    const cleanNotes = this.cleanHandoutNotes(notes);
                    let data = JSON.parse(cleanNotes);
                    let itemFound = false;
                    let removedItem = null;
                    
                    // Search through all rarities and categories
                    Object.keys(data.items).forEach(rarity => {
                        Object.keys(data.items[rarity]).forEach(category => {
                            if (Array.isArray(data.items[rarity][category])) {
                                const index = data.items[rarity][category].findIndex(item => item.id === itemId);
                                if (index !== -1) {
                                    removedItem = data.items[rarity][category][index];
                                    data.items[rarity][category].splice(index, 1);
                                    itemFound = true;
                                }
                            }
                        });
                    });
                    
                    if (itemFound) {
                        removedItemName = removedItem.name;
                        dbHandout.set("gmnotes", JSON.stringify(data, null, 2));
                        this.log(`Removed ${removedItemName} from the database.`, "info");
                        
                        // Step 2: Remove from all shops
                        this.removeItemFromShops(itemId, removedItemName).then((shopsUpdated) => {
                            resolve({
                                success: true,
                                itemName: removedItemName,
                                shopsUpdated: shopsUpdated
                            });
                        }).catch(reject);
                        
                    } else {
                        reject(new Error("Item not found in database"));
                    }
                    
                } catch (error) {
                    this.log(`Error removing item from database: ${error.message}`, "error");
                    reject(error);
                }
            });
        });
    },
    
    /**
     * Update existing item in database
     * @param {Object} item - Updated item data
     * @returns {Promise<boolean>} Promise resolving to success status
     */
    updateItem(item) {
        return new Promise((resolve, reject) => {
            const dbHandout = this.findDatabaseHandout();
            if (!dbHandout) {
                reject(new Error("Item database not found!"));
                return;
            }
            
            dbHandout.get("gmnotes", (notes) => {
                try {
                    const cleanNotes = this.cleanHandoutNotes(notes);
                    let data = JSON.parse(cleanNotes);
                    let itemFound = false;
                    
                    // Search through all rarities and categories
                    Object.keys(data.items).forEach(rarity => {
                        Object.keys(data.items[rarity]).forEach(category => {
                            if (Array.isArray(data.items[rarity][category])) {
                                const index = data.items[rarity][category].findIndex(i => i.id === item.id);
                                if (index !== -1) {
                                    data.items[rarity][category][index] = item;
                                    itemFound = true;
                                }
                            }
                        });
                    });
                    
                    if (itemFound) {
                        dbHandout.set("gmnotes", JSON.stringify(data, null, 2));
                        this.log(`Updated ${item.name} in the database.`, "info");
                        resolve(true);
                    } else {
                        reject(new Error("Item not found in database"));
                    }
                    
                } catch (error) {
                    this.log(`Error updating item in database: ${error.message}`, "error");
                    reject(error);
                }
            });
        });
    },
    
    // ===================================================================
    // SHOP DATA OPERATIONS
    // ===================================================================
    
    /**
     * Remove item from all shop inventories
     * @param {string} itemId - Item ID to remove
     * @param {string} itemName - Item name for logging
     * @returns {Promise<number>} Promise resolving to number of shops updated
     */
    removeItemFromShops(itemId, itemName) {
        return new Promise((resolve) => {
            const shopPrefix = this.config?.HANDOUT?.SHOP_PREFIX || 'Shop:';
            
            // Find all handouts
            const allHandouts = findObjs({ _type: "handout" });
            this.log(`Found ${allHandouts.length} total handouts.`, 'debug');
            
            // Filter for shop handouts
            const shopHandouts = allHandouts.filter(h => {
                const name = h.get('name');
                return name && name.startsWith(shopPrefix);
            });
            
            this.log(`Found ${shopHandouts.length} shop handouts.`, 'debug');
            
            if (shopHandouts.length === 0) {
                resolve(0);
                return;
            }
            
            const shopUpdatePromises = shopHandouts.map(shopHandout => {
                return new Promise((resolveShop) => {
                    shopHandout.get("gmnotes", (shopNotes) => {
                        try {
                            const cleanShopNotes = this.cleanHandoutNotes(shopNotes);
                            if (!cleanShopNotes) {
                                resolveShop(false);
                                return;
                            }
                            
                            const shopData = JSON.parse(cleanShopNotes);
                            
                            // Validate shop structure
                            if (!shopData || shopData.type !== 'shop' || !shopData.inventory) {
                                resolveShop(false);
                                return;
                            }
                            
                            let shopModified = false;
                            
                            // Remove item from all categories
                            for (const category in shopData.inventory) {
                                if (Array.isArray(shopData.inventory[category])) {
                                    const initialLength = shopData.inventory[category].length;
                                    shopData.inventory[category] = shopData.inventory[category].filter(item => item.id !== itemId);
                                    
                                    if (shopData.inventory[category].length < initialLength) {
                                        shopModified = true;
                                    }
                                }
                            }
                            
                            if (shopModified) {
                                shopHandout.set("gmnotes", JSON.stringify(shopData, null, 2));
                                this.log(`Removed ${itemName} from shop: ${shopHandout.get('name')}`, 'debug');
                                resolveShop(true);
                            } else {
                                resolveShop(false);
                            }
                            
                        } catch (shopError) {
                            this.log(`Error processing shop ${shopHandout.get('name')}: ${shopError.message}`, "error");
                            resolveShop(false);
                        }
                    });
                });
            });
            
            Promise.all(shopUpdatePromises).then(results => {
                const shopsUpdated = results.filter(updated => updated).length;
                resolve(shopsUpdated);
            });
        });
    },
    
    // ===================================================================
    // CHARACTER OPERATIONS
    // ===================================================================
    
    /**
     * Set character currency with multi-sheet support
     * @param {string} characterId - Character ID
     * @param {Object} newCurrency - New currency values
     * @returns {boolean} Success status
     */
    setCharacterCurrency(characterId, newCurrency) {
        const char = getObj('character', characterId);
        if (!char) {
            this.log(`Character not found for ID: ${characterId}`, 'error');
            return false;
        }
        
        const charName = char.get('name');
        this.log(`Setting currency for ${charName}: ${JSON.stringify(newCurrency)}`, 'debug');
        
        let attributeUpdated = false;
        
        // Helper to set attribute value
        const setAttribute = (attrName, value) => {
            let attr = findObjs({ _type: 'attribute', _characterid: characterId, name: attrName })[0];
            if (attr) {
                attr.set('current', value);
                this.log(`Updated attribute ${attrName} to ${value}`, 'debug');
                attributeUpdated = true;
                return true;
            } else {
                this.log(`Attribute ${attrName} not found`, 'debug');
                return false;
            }
        };
        
        // Try Standard D&D 5e Sheet Attributes
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
            this.log(`Updated standard attributes for ${charName}`, 'debug');
            return true;
        }
        
        // Try Beacon Sheet Attributes
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
            this.log(`Updated Beacon attributes for ${charName}`, 'debug');
            return true;
        }
        
        // Try Beacon Store Attribute (fallback)
        const storeAttr = findObjs({
            _type: 'attribute',
            _characterid: characterId,
            name: 'store'
        })[0];
        
        if (storeAttr) {
            this.log(`Attempting fallback update via Beacon 'store' attribute for ${charName}`, 'debug');
            try {
                let storeData = storeAttr.get('current');
                
                if (typeof storeData === 'string') {
                    if (storeData.trim() === '') {
                        throw new Error("Store attribute is empty");
                    }
                    storeData = JSON.parse(storeData || '{}');
                }
                
                if (typeof storeData === 'object' && storeData !== null) {
                    let storeUpdated = false;
                    
                    const updateCurrencyInStore = (obj) => {
                        if (!obj) return;
                        if (Array.isArray(obj)) {
                            obj.forEach(item => updateCurrencyInStore(item));
                        } else if (typeof obj === 'object') {
                            if (obj.name && obj.type === "Currency") {
                                const coinName = obj.name.toLowerCase();
                                const newValue = newCurrency[coinName.substring(0, 2)] || 0;
                                if (obj.value !== newValue) {
                                    obj.value = newValue;
                                    storeUpdated = true;
                                    this.log(`Updated ${obj.name} in store to ${newValue}`, 'debug');
                                }
                            }
                            Object.values(obj).forEach(value => {
                                if (typeof value === 'object') {
                                    updateCurrencyInStore(value);
                                }
                            });
                        }
                    };
                    
                    updateCurrencyInStore(storeData);
                    
                    if (storeUpdated) {
                        storeAttr.set('current', JSON.stringify(storeData));
                        this.log(`Updated currency within Beacon 'store' attribute for ${charName}`, 'debug');
                        return true;
                    }
                }
            } catch (e) {
                this.log(`Error updating Beacon 'store' attribute for ${charName}: ${e.message}`, 'warn');
            }
        }
        
        this.log(`Could not find any known currency attributes to update for ${charName}`, 'error');
        return false;
    },
    
    /**
     * Get character currency with multi-sheet support
     * @param {string} characterId - Character ID
     * @returns {Object} Currency object
     */
    getCharacterCurrency(characterId) {
        const char = getObj('character', characterId);
        if (!char) {
            this.log(`Character not found for ID: ${characterId}`, 'error');
            return { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
        }
        
        const currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
        
        // Try standard attributes first
        const standardAttrs = ['cp', 'sp', 'ep', 'gp', 'pp'];
        let foundStandard = false;
        
        standardAttrs.forEach(coin => {
            const attr = findObjs({ _type: 'attribute', _characterid: characterId, name: coin })[0];
            if (attr) {
                foundStandard = true;
                currency[coin] = parseInt(attr.get('current')) || 0;
            }
        });
        
        if (foundStandard) {
            return currency;
        }
        
        // Try Beacon attributes
        const beaconAttrs = {
            cp: 'money_cp',
            sp: 'money_sp',
            ep: 'money_ep',
            gp: 'money_gp',
            pp: 'money_pp'
        };
        
        let foundBeacon = false;
        Object.entries(beaconAttrs).forEach(([coin, attrName]) => {
            const attr = findObjs({ _type: 'attribute', _characterid: characterId, name: attrName })[0];
            if (attr) {
                foundBeacon = true;
                currency[coin] = parseInt(attr.get('current')) || 0;
            }
        });
        
        if (foundBeacon) {
            return currency;
        }
        
        this.log(`No currency attributes found for character ${char.get('name')}`, 'warn');
        return currency;
    },
    
    // ===================================================================
    // UTILITY METHODS
    // ===================================================================
    
    /**
     * Clean handout notes (remove HTML entities)
     * @param {string} notes - Raw handout notes
     * @returns {string} Cleaned notes
     */
    cleanHandoutNotes(notes) {
        if (!notes) return '';
        
        // Decode HTML entities
        return notes
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&');
    },
    
    /**
     * Parse item text for batch import
     * @param {string} text - Raw item text
     * @returns {Array} Parsed items array
     */
    parseItemText(text) {
        const items = [];
        const lines = text.split('\n');
        let currentItem = null;
        
        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            
            // Check if this line starts a new item (no dash prefix)
            if (!line.startsWith('-') && !line.startsWith('•')) {
                // Save previous item if exists
                if (currentItem && currentItem.name) {
                    items.push(currentItem);
                }
                
                // Start new item
                currentItem = {
                    name: line,
                    price: { gp: 0 }
                };
            } else if (currentItem) {
                // Parse property line
                const cleanLine = line.replace(/^[-•]\s*/, '');
                const colonIndex = cleanLine.indexOf(':');
                
                if (colonIndex > 0) {
                    const key = cleanLine.substring(0, colonIndex).trim().toLowerCase();
                    const value = cleanLine.substring(colonIndex + 1).trim();
                    
                    this.parseItemProperty(currentItem, key, value);
                }
            }
        }
        
        // Don't forget the last item
        if (currentItem && currentItem.name) {
            items.push(currentItem);
        }
        
        return items;
    },
    
    /**
     * Parse individual item property
     * @param {Object} item - Item being parsed
     * @param {string} key - Property key
     * @param {string} value - Property value
     */
    parseItemProperty(item, key, value) {
        switch (key) {
            case 'price':
                const priceMatch = value.match(/(\d+(?:\.\d+)?)\s*(gp|sp|cp|ep|pp)/i);
                if (priceMatch) {
                    const amount = parseFloat(priceMatch[1]);
                    const currency = priceMatch[2].toLowerCase();
                    item.price = { [currency]: amount };
                }
                break;
                
            case 'weight':
                item.weight = parseFloat(value) || 0;
                break;
                
            case 'properties':
                item.properties = value.split(',').map(p => p.trim());
                break;
                
            case 'attunement':
                item.attunement = value.toLowerCase().includes('yes');
                break;
                
            case 'consumable':
                item.consumable = value.toLowerCase().includes('yes');
                break;
                
            default:
                item[key] = value;
        }
    },
    
    /**
     * Get all shop handouts
     * @returns {Array} Array of shop handout objects
     */
    getShopHandouts() {
        const shopPrefix = this.config?.HANDOUT?.SHOP_PREFIX || 'Shop:';
        const allHandouts = findObjs({ _type: "handout" });
        
        return allHandouts.filter(h => {
            const name = h.get('name');
            return name && name.startsWith(shopPrefix);
        });
    },
    
    /**
     * Create or update shop handout
     * @param {Object} shopData - Shop data to save
     * @param {string} shopName - Shop name
     * @returns {Object} Shop handout object
     */
    saveShopData(shopData, shopName) {
        const shopPrefix = this.config?.HANDOUT?.SHOP_PREFIX || 'Shop:';
        const handoutName = `${shopPrefix} ${shopName}`;
        
        let handout = findObjs({
            _type: "handout",
            name: handoutName
        })[0];
        
        if (!handout) {
            handout = createObj("handout", {
                name: handoutName,
                archived: false
            });
        }
        
        handout.set("gmnotes", JSON.stringify(shopData, null, 2));
        return handout;
    },
    
    /**
     * Load shop data from handout
     * @param {string} shopName - Shop name
     * @returns {Object|null} Shop data or null if not found
     */
    loadShopData(shopName) {
        const shopPrefix = this.config?.HANDOUT?.SHOP_PREFIX || 'Shop:';
        const handoutName = `${shopPrefix} ${shopName}`;
        
        const handout = findObjs({
            _type: "handout",
            name: handoutName
        })[0];
        
        if (!handout) {
            return null;
        }
        
        try {
            const notes = handout.get("gmnotes");
            const cleanNotes = this.cleanHandoutNotes(notes);
            return JSON.parse(cleanNotes);
        } catch (error) {
            this.log(`Error loading shop data for ${shopName}: ${error.message}`, 'error');
            return null;
        }
    },
    
    /**
     * Validate database structure
     * @returns {Object} Validation results
     */
    validateDatabase() {
        const handout = this.findDatabaseHandout();
        if (!handout) {
            return { valid: false, error: "Database handout not found" };
        }
        
        try {
            const notes = handout.get("gmnotes");
            const cleanNotes = this.cleanHandoutNotes(notes);
            const data = JSON.parse(cleanNotes);
            
            if (!data.items) {
                return { valid: false, error: "Missing items structure" };
            }
            
            let totalItems = 0;
            const categories = new Set();
            const rarities = new Set();
            
            Object.keys(data.items).forEach(rarity => {
                rarities.add(rarity);
                if (data.items[rarity]) {
                    Object.keys(data.items[rarity]).forEach(category => {
                        categories.add(category);
                        if (Array.isArray(data.items[rarity][category])) {
                            totalItems += data.items[rarity][category].length;
                        }
                    });
                }
            });
            
            return {
                valid: true,
                totalItems,
                categories: Array.from(categories),
                rarities: Array.from(rarities),
                version: data.version || 'Unknown'
            };
            
        } catch (error) {
            return { valid: false, error: `Parse error: ${error.message}` };
        }
    },
    
    // Helper methods
    log(message, type = 'info') {
        const prefix = this.config?.LOGGING?.PREFIX?.[type] || '📜';
        log(`${prefix} DatabaseManager: ${message}`);
    }
};

// Export for Roll20 environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatabaseManager;
} else {
    this.DatabaseManager = DatabaseManager;
}