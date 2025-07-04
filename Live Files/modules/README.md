# ShopSystem Modular Refactoring

This directory contains the modular components for refactoring the Live-SYS-ShopSystem.js file.

## Project Status

### ✅ Phase 1: Core Utilities - FOUNDATION COMPLETE
- [x] **index.js** - Module system foundation and loader
- [x] **ShopConfig.js** - Consolidated configuration (Saves: ~150-200 lines)
- [x] **CurrencyManager.js** - Unified currency operations (Saves: ~200-300 lines)  
- [x] **MenuBuilder.js** - Template-based menu system (Saves: ~200-300 lines)

**Phase 1 Total Estimated Savings: 550-800 lines**

### ⏳ Phase 2: Business Logic - PENDING
- [ ] **BasketManager.js** - Unified basket operations (Target: ~300-400 lines saved)
- [ ] **ReceiptGenerator.js** - Consolidated receipt creation (Target: ~150-200 lines saved)
- [ ] **StockManager.js** - Stock and inventory operations (Target: ~200-300 lines saved)

### ⏳ Phase 3: Data Management - PENDING  
- [ ] **DatabaseManager.js** - Database operations (Target: ~200-300 lines saved)

### ⏳ Phase 4: Integration & Optimization - PENDING
- [ ] Main file integration
- [ ] Testing and validation
- [ ] Final cleanup

## Module Overview

### Core Utilities (Phase 1)

#### index.js
Central module loader and registry. Provides:
- Module availability checking
- Loading status tracking
- Unified access to all modules

#### ShopConfig.js
Consolidates all configuration scattered throughout the main file:
- Currency settings and multipliers
- Display settings and emoji mappings
- Shop types, locations, and merchant configurations
- Item categories and rarity settings
- Validation helpers for categories/rarities

**Replaces**: CONFIG object (Lines 1-400) and scattered configurations

#### CurrencyManager.js  
Unified currency management system:
- Currency conversion (`toCopper`, `fromCopper`)
- Currency formatting and display
- Character sheet integration (Standard D&D 5e, Beacon)
- Price calculations and modifications
- Affordability checking and currency arithmetic

**Replaces**: Currency utility functions (Lines 500-650, 2100-2250)

#### MenuBuilder.js
Template-based menu generation system:
- Standardized menu templates
- Button and section creation
- Navigation helpers
- Shop-specific menu builders
- Item list formatting

**Replaces**: 15+ menu generation functions (Lines 3000-4000)

## Integration Instructions

### Step 1: Include Modules in Main File
Add to the top of `Live-SYS-ShopSystem.js`:

```javascript
// Load ShopSystem Modules
// Note: In Roll20, these would need to be included as separate script tabs
// or concatenated into the main file

// Module Loading (adjust path as needed)
const ShopSystemModules = ShopSystemModules || {};

// Initialize modules
if (typeof ShopConfig !== 'undefined') {
    ShopSystemModules.config = ShopConfig;
}
if (typeof CurrencyManager !== 'undefined') {
    ShopSystemModules.currency = CurrencyManager.init(ShopConfig);
}
if (typeof MenuBuilder !== 'undefined') {
    ShopSystemModules.menu = MenuBuilder.init(ShopConfig);
}
```

### Step 2: Replace Original CONFIG Object
Replace the large CONFIG object (Lines 1-400) with:

```javascript
// Use modular configuration
const CONFIG = ShopSystemModules.config || {
    // Fallback minimal config if module not loaded
    version: '1.0.0',
    debug: false
    // ... minimal fallbacks
};
```

### Step 3: Replace Currency Functions
Replace currency utility functions with module calls:

```javascript
// Replace toCopper calls
// OLD: ShopSystem.utils.toCopper(currency)
// NEW: ShopSystemModules.currency.toCopper(currency)

// Replace fromCopper calls  
// OLD: ShopSystem.utils.fromCopper(copper)
// NEW: ShopSystemModules.currency.fromCopper(copper)

// Replace formatCurrency calls
// OLD: ShopSystem.utils.formatCurrency(currency)
// NEW: ShopSystemModules.currency.formatCurrency(currency)
```

### Step 4: Replace Menu Generation
Replace menu generation functions with module calls:

```javascript
// Replace menu creation patterns
// OLD: 
// const menu = ["&{template:default}", "{{name=Title}}", "{{Section=Content}}"].join(" ");
// ShopSystem.utils.chat(menu, playerID);

// NEW:
// const menu = ShopSystemModules.menu.createMenu("Title", { Section: "Content" });
// ShopSystemModules.menu.sendMenu(menu, playerID);
```

## Testing Checklist

### Module Functionality Tests
- [ ] ShopConfig provides all required configuration values
- [ ] CurrencyManager handles all currency conversions correctly
- [ ] MenuBuilder generates proper Roll20 menu templates
- [ ] All modules initialize without errors

### Integration Tests  
- [ ] Main ShopSystem loads with modules included
- [ ] Currency operations work with character sheets
- [ ] Menus display correctly in Roll20 chat
- [ ] Shop creation and management functions properly
- [ ] Basket operations maintain functionality

### Regression Tests
- [ ] All existing shop commands work
- [ ] Database operations remain functional  
- [ ] Player interactions unchanged
- [ ] GM functions maintain capabilities

## File Structure

```
Live Files/
├── Live-SYS-ShopSystem.js (main file - 9,638 lines → target: 6,100-6,800 lines)
└── modules/
    ├── README.md (this file)
    ├── index.js (module loader)
    ├── ShopConfig.js (configuration)
    ├── CurrencyManager.js (currency operations)
    ├── MenuBuilder.js (menu templates)
    ├── BasketManager.js (pending)
    ├── ReceiptGenerator.js (pending)
    ├── StockManager.js (pending)
    └── DatabaseManager.js (pending)
```

## Implementation Notes

### Roll20 Specific Considerations
- Roll20 API doesn't support ES6 modules or require()
- Modules must be included as separate script tabs or concatenated
- Global scope pollution should be minimized
- Error handling must be robust for partial module loading

### Backward Compatibility
- All modules include fallback behaviors
- Main file can function with missing modules (reduced functionality)
- Gradual migration approach supported

### Performance Considerations  
- Module initialization is lightweight
- Lazy loading where appropriate
- Memory usage optimized vs. original code

## Next Steps

1. **Complete Phase 2 Modules**:
   - Create BasketManager.js for basket operations
   - Create ReceiptGenerator.js for receipt generation
   - Create StockManager.js for inventory management

2. **Begin Integration**:
   - Start replacing original functions with module calls
   - Test individual module integrations
   - Maintain functional compatibility

3. **Phase 3 & 4**:
   - Create DatabaseManager.js
   - Complete main file refactoring
   - Comprehensive testing and optimization

## Estimated Impact

**Total Project Completion**: 
- **Lines Saved**: 2,800-3,500 (29-36% reduction)
- **Final Size**: 6,100-6,800 lines (from 9,638)
- **Development Time**: 48-64 hours estimated
- **Maintainability**: Significantly improved
- **Performance**: Enhanced through reduced redundancy

## Questions or Issues

If you encounter issues during implementation:
1. Check module loading in index.js
2. Verify configuration values in ShopConfig.js
3. Test individual modules before integration
4. Maintain original functions until modules are fully tested