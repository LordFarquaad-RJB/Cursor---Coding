/**
 * ShopSystem Modules Index
 * 
 * This index file exports all the modular components of the Shop System
 * for use in the main Live-SYS-ShopSystem.js file.
 * 
 * Usage:
 * - Include this at the top of Live-SYS-ShopSystem.js
 * - Replace existing inline functionality with module calls
 * 
 * Refactoring Progress:
 * [✓] Foundation setup
 * [ ] Phase 1: Core Utilities (CurrencyManager, ShopConfig, MenuBuilder)
 * [ ] Phase 2: Business Logic (BasketManager, ReceiptGenerator, StockManager)
 * [ ] Phase 3: Data Management (DatabaseManager)
 * [ ] Phase 4: Integration & Optimization
 */

// Core Utilities (Phase 1)
const ShopConfig = typeof ShopConfig !== 'undefined' ? ShopConfig : null;
const CurrencyManager = typeof CurrencyManager !== 'undefined' ? CurrencyManager : null;
const MenuBuilder = typeof MenuBuilder !== 'undefined' ? MenuBuilder : null;

// Business Logic (Phase 2)
const BasketManager = typeof BasketManager !== 'undefined' ? BasketManager : null;
const ReceiptGenerator = typeof ReceiptGenerator !== 'undefined' ? ReceiptGenerator : null;
const StockManager = typeof StockManager !== 'undefined' ? StockManager : null;

// Data Management (Phase 3)
const DatabaseManager = typeof DatabaseManager !== 'undefined' ? DatabaseManager : null;

/**
 * Main ShopSystem Modules Object
 * Provides organized access to all refactored functionality
 */
const ShopSystemModules = {
    // Phase 1: Core Utilities
    config: ShopConfig,
    currency: CurrencyManager,
    menu: MenuBuilder,
    
    // Phase 2: Business Logic
    basket: BasketManager,
    receipt: ReceiptGenerator,
    stock: StockManager,
    
    // Phase 3: Data Management
    database: DatabaseManager,
    
    // Utility methods
    isModuleLoaded(moduleName) {
        return this[moduleName] !== null && this[moduleName] !== undefined;
    },
    
    getLoadedModules() {
        const loaded = [];
        Object.keys(this).forEach(key => {
            if (typeof this[key] === 'object' && this[key] !== null && key !== 'isModuleLoaded' && key !== 'getLoadedModules') {
                loaded.push(key);
            }
        });
        return loaded;
    },
    
    logModuleStatus() {
        const loaded = this.getLoadedModules();
        const total = ['config', 'currency', 'menu', 'basket', 'receipt', 'stock', 'database'];
        log(`📦 ShopSystem Modules: ${loaded.length}/${total.length} loaded`);
        log(`✅ Loaded: ${loaded.join(', ')}`);
        
        const missing = total.filter(m => !loaded.includes(m));
        if (missing.length > 0) {
            log(`⏳ Pending: ${missing.join(', ')}`);
        }
    }
};

// Export for use in main ShopSystem
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShopSystemModules;
} else {
    // Roll20 environment - attach to global scope
    this.ShopSystemModules = ShopSystemModules;
}