# 📁 Live-SYS-ShopSystem Project Structure

## 🎯 Overview

This document outlines the organized folder structure for the Live-SYS-ShopSystem modular refactoring project. The structure has been designed for optimal development workflow and maintainability.

---

## 📂 Project Directory Structure

```
Live-SYS-ShopSystem/
├── 📁 build/                          # Build system and outputs
│   ├── build.js                       # Main build script
│   ├── package.json                   # Node.js dependencies
│   ├── Live-SYS-ShopSystem-Built.js  # Latest development build
│   ├── Production-Test.js             # Production test build
│   └── *.js                          # Other build outputs
├── 📁 docs/                           # Documentation and notes
│   ├── README.md                      # Main project documentation
│   ├── PROJECT-STRUCTURE.md           # This file
│   ├── PHASE-1-COMPLETION-SUMMARY.md  # Phase 1 completion details
│   ├── PHASE-2-COMPLETION-SUMMARY.md  # Phase 2 completion details
│   ├── PHASE-3-COMPLETION-SUMMARY.md  # Phase 3 completion details
│   └── BUILD-SYSTEM-SUMMARY.md        # Build system documentation
├── 📁 modules/                        # Modular components
│   ├── ShopConfig.js                  # Configuration management
│   ├── CurrencyManager.js             # Currency operations
│   ├── MenuBuilder.js                 # Menu generation
│   ├── BasketManager.js               # Shopping basket logic
│   ├── ReceiptGenerator.js            # Receipt generation
│   ├── StockManager.js                # Inventory management
│   ├── DatabaseManager.js             # Database operations
│   ├── index.js                       # Module coordination
│   └── README.md                      # Module documentation
├── 📁 src/                            # Source files
│   └── Live-SYS-ShopSystem.js         # Original monolithic file
├── 📁 other-systems/                  # Other Roll20 systems
│   ├── Live-CommandMenu.js            # Command menu system
│   ├── Live-CTRL-LightControl.js      # Light control system
│   ├── Live-CTRL-TokenFX.js           # Token effects system
│   ├── Live-CTRL-TriggerControl.js    # Trigger control system
│   └── Live-SYS-TrapSystem.js         # Trap system
├── build.sh                           # Convenience build script
└── Live-SYS-ShopSystem-Built.js      # Production-ready output
```

---

## 📋 Directory Descriptions

### 🔧 `/build/` - Build System
Contains all build-related files and outputs.

**Files:**
- `build.js` - Main Node.js build script
- `package.json` - Node.js project configuration and dependencies
- `*.js` - Various build outputs and test builds

**Purpose:**
- Combines modules into single Roll20-ready script
- Handles development and production builds
- Manages module dependencies and initialization

### 📚 `/docs/` - Documentation
All project documentation, summaries, and notes.

**Files:**
- `README.md` - Main project overview and usage guide
- `PROJECT-STRUCTURE.md` - This file explaining project organization
- `PHASE-*-COMPLETION-SUMMARY.md` - Detailed phase completion summaries
- `BUILD-SYSTEM-SUMMARY.md` - Build system documentation

**Purpose:**
- Centralized documentation storage
- Project history and progress tracking
- Development notes and references

### 🧩 `/modules/` - Modular Components
The heart of the refactored system - all modular components.

**Files:**
- `ShopConfig.js` - Centralized configuration management
- `CurrencyManager.js` - Currency operations and conversions
- `MenuBuilder.js` - Template-based menu generation
- `BasketManager.js` - Shopping basket operations
- `ReceiptGenerator.js` - Transaction receipt generation
- `StockManager.js` - Inventory management
- `DatabaseManager.js` - Database operations and Roll20 integration
- `index.js` - Module coordination and initialization
- `README.md` - Module-specific documentation

**Purpose:**
- Modular architecture components
- Specialized functionality separation
- Reusable and maintainable code modules

### 📄 `/src/` - Source Files
Original source files for reference and development builds.

**Files:**
- `Live-SYS-ShopSystem.js` - Original monolithic file (9,638 lines)

**Purpose:**
- Reference for development builds
- Comparison for testing
- Backup of original functionality

### 🔗 `/other-systems/` - Other Roll20 Systems
Separate Roll20 systems that were in the same directory.

**Files:**
- Various `Live-*.js` files for different Roll20 systems

**Purpose:**
- Clean separation of different systems
- Organized storage of related projects

---

## 🚀 Building the System

### Quick Build Commands

#### From Project Root:
```bash
# Production build (recommended for Roll20)
./build.sh

# Development build (includes original file)
./build.sh --dev

# Custom output filename
./build.sh --output MyCustomShop.js

# Watch mode for development
./build.sh --watch
```

#### From Build Directory:
```bash
cd build

# Production build
node build.js

# Development build
node build.js --dev

# Watch mode
node build.js --watch
```

### Build Outputs

**Production Build:**
- **Output:** `Live-SYS-ShopSystem-Built.js` (in project root)
- **Size:** ~159 KB, 4,382 lines
- **Content:** All modules combined, optimized for Roll20
- **Usage:** Copy directly to Roll20 campaign

**Development Build:**
- **Output:** Same file name
- **Size:** ~665 KB, 14,035 lines  
- **Content:** All modules + original file for reference
- **Usage:** Development and testing

---

## 📖 Module Dependencies

The modules have a specific loading order due to dependencies:

```
ShopConfig.js (foundation)
├── CurrencyManager.js
├── MenuBuilder.js  
├── BasketManager.js
├── ReceiptGenerator.js
├── StockManager.js
└── DatabaseManager.js
```

All modules depend on `ShopConfig.js` for configuration. The build system automatically handles this dependency order.

---

## 🔄 Development Workflow

### Making Changes:
1. Edit individual modules in `/modules/`
2. Run build script to generate updated output
3. Test in Roll20 or using development build
4. Update documentation if needed

### Adding New Modules:
1. Create new module file in `/modules/`
2. Add to `moduleOrder` in `build/build.js`
3. Update `modules/index.js` to include new module
4. Rebuild and test

### Directory Benefits:
- **Clear separation** of concerns
- **Easy navigation** and file management
- **Version control friendly** structure
- **Build system isolation** from source code
- **Documentation centralization**

---

## 🎯 Roll20 Deployment

### Production Deployment:
1. Run `./build.sh` from project root
2. Copy `Live-SYS-ShopSystem-Built.js` to Roll20 campaign
3. Verify module initialization in console
4. All original functionality preserved

### File Sizes:
- **Original:** 9,638 lines
- **Production:** 4,382 lines (54.5% reduction)
- **Functionality:** 100% preserved

---

## 📞 Support & Maintenance

### Folder Structure Benefits:
- **Maintainability:** Easy to find and modify specific functionality
- **Scalability:** Simple to add new modules or features
- **Organization:** Clear separation of build, source, docs, and modules
- **Collaboration:** Easy for multiple developers to work on different modules
- **Version Control:** Clean git history with organized file changes

### Future Development:
- Add new modules to `/modules/`
- Update build system in `/build/`
- Document changes in `/docs/`
- Keep original reference in `/src/`

---

**The organized structure makes the Live-SYS-ShopSystem easy to maintain, extend, and deploy! 🚀**