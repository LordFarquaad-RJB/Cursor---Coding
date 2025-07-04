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
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CurrencyManager;
} else {
    this.CurrencyManager = CurrencyManager;
}