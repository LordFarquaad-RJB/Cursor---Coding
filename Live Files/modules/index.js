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
 * [✓] Phase 1: Core Utilities (CurrencyManager, ShopConfig, MenuBuilder)
 * [✓] Phase 2: Business Logic (BasketManager, ReceiptGenerator, StockManager)
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

// Data Management (Phase 3 - Future)
const DatabaseManager = typeof DatabaseManager !== 'undefined' ? DatabaseManager : null;

// Module registry and initialization
const ShopSystemModules = {
    // Core utilities
    config: null,
    currency: null,
    menu: null,
    
    // Business logic
    basket: null,
    receipt: null,
    stock: null,
    
    // Data management
    database: null,
    
    // Initialization status
    initialized: false,
    
    /**
     * Initialize all available modules
     * @returns {Object} Initialization results
     */
    init() {
        const results = {
            success: true,
            initialized: [],
            failed: [],
            warnings: []
        };
        
        try {
            // Phase 1: Core Utilities
            if (ShopConfig) {
                this.config = ShopConfig;
                results.initialized.push('ShopConfig');
            } else {
                results.failed.push('ShopConfig');
                results.success = false;
            }
            
            if (CurrencyManager) {
                this.currency = CurrencyManager.init(this.config);
                results.initialized.push('CurrencyManager');
            } else {
                results.failed.push('CurrencyManager');
                results.success = false;
            }
            
            if (MenuBuilder) {
                this.menu = MenuBuilder.init(this.config);
                results.initialized.push('MenuBuilder');
            } else {
                results.failed.push('MenuBuilder');
                results.success = false;
            }
            
            // Phase 2: Business Logic
            if (BasketManager) {
                this.basket = BasketManager.init(this.config);
                results.initialized.push('BasketManager');
            } else {
                results.failed.push('BasketManager');
                results.success = false;
            }
            
            if (ReceiptGenerator) {
                this.receipt = ReceiptGenerator.init(this.config);
                results.initialized.push('ReceiptGenerator');
            } else {
                results.failed.push('ReceiptGenerator');
                results.success = false;
            }
            
            if (StockManager) {
                this.stock = StockManager.init(this.config);
                results.initialized.push('StockManager');
            } else {
                results.failed.push('StockManager');
                results.success = false;
            }
            
            // Phase 3: Data Management (Future)
            if (DatabaseManager) {
                this.database = DatabaseManager.init(this.config);
                results.initialized.push('DatabaseManager');
            } else {
                results.warnings.push('DatabaseManager not available (Phase 3)');
            }
            
            this.initialized = results.success;
            
            if (results.success) {
                log("🎉 All ShopSystem modules initialized successfully!");
                log(`✅ Initialized: ${results.initialized.join(', ')}`);
            } else {
                log("⚠️ ShopSystem module initialization completed with errors");
                log(`✅ Initialized: ${results.initialized.join(', ')}`);
                log(`❌ Failed: ${results.failed.join(', ')}`);
            }
            
            if (results.warnings.length > 0) {
                log(`⚠️ Warnings: ${results.warnings.join(', ')}`);
            }
            
        } catch (error) {
            results.success = false;
            results.failed.push(`Initialization error: ${error.message}`);
            log(`❌ Fatal error during module initialization: ${error.message}`);
        }
        
        return results;
    },
    
    /**
     * Get module status summary
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            initialized: this.initialized,
            availableModules: {
                config: !!this.config,
                currency: !!this.currency,
                menu: !!this.menu,
                basket: !!this.basket,
                receipt: !!this.receipt,
                stock: !!this.stock,
                database: !!this.database
            },
            moduleCount: Object.values(this).filter(module => 
                module && typeof module === 'object' && typeof module.init === 'function'
            ).length
        };
    },
    
    /**
     * Verify all required modules are available
     * @returns {boolean} Whether all required modules are available
     */
    verifyModules() {
        const required = ['config', 'currency', 'menu', 'basket', 'receipt', 'stock'];
        const missing = required.filter(module => !this[module]);
        
        if (missing.length > 0) {
            log(`❌ Missing required modules: ${missing.join(', ')}`);
            return false;
        }
        
        return true;
    },
    
    /**
     * Reinitialize modules after updates
     * @returns {Object} Reinitialization results
     */
    reinit() {
        log("🔄 Reinitializing ShopSystem modules...");
        this.initialized = false;
        return this.init();
    }
};

// Auto-initialize if in Roll20 environment
if (typeof state !== 'undefined' && typeof log !== 'undefined') {
    // Wait for all modules to be loaded
    setTimeout(() => {
        ShopSystemModules.init();
    }, 100);
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = ShopSystemModules;
} else if (typeof exports !== 'undefined') {
    // CommonJS environment
    exports.ShopSystemModules = ShopSystemModules;
} else {
    // Roll20/Browser environment
    this.ShopSystemModules = ShopSystemModules;
}