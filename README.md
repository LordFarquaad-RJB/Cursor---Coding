# TrapSystem v2.0 - Modular Roll20 API Script

A complete rewrite of the TrapSystem from a monolithic 5,687-line file into a clean, modular architecture.

## 📁 Project Structure

```
TrapSystem-v2/
├── README.md                 # This file - project overview and usage
├── package.json              # Node.js dependencies and build scripts
├── package-lock.json         # Locked dependency versions
├── rollup.config.mjs         # Build configuration for bundling
│
├── src/                      # 🔧 SOURCE CODE (Development)
│   ├── index.js              # Main entry point & Roll20 event handlers
│   ├── trap-core.js          # Core configuration & state management
│   ├── trap-utils.js         # Utility functions & helper methods
│   ├── trap-commands.js      # Command parsing & API routing (30+ commands)
│   ├── trap-triggers.js      # Trap control & trigger system
│   ├── trap-interaction.js   # Skill checks & interaction menus
│   ├── trap-detection.js     # Passive detection & perception system
│   ├── trap-detector.js      # Movement detection & collision system
│   ├── trap-macros.js        # Macro execution & export system
│   └── trap-ui.js            # UI helpers & menu generation
│
├── dist/                     # 📦 BUILT FILES (Production)
│   ├── TrapSystem-v2.js      # Final bundle for Roll20 (4,783 lines)
│   └── TrapSystem-v2.js.map  # Source map for debugging
│
├── docs/                     # 📚 DOCUMENTATION
│   ├── MIGRATION_COMPLETE.md # Complete migration summary
│   └── trap_system_analysis.md # Original analysis document
│
├── original-files/           # 🗄️ ORIGINAL FILES (Archive)
│   ├── Live-SYS-TrapSystem.js # Original 5,687-line monolithic file
│   └── [other Roll20 scripts] # Other original API scripts
│
└── archive/                  # 📋 ARCHIVE (Future use)
    └── [old versions]        # Previous versions and backups
```

## 🎯 Why This Organization?

### **Development-First Structure**
The project is organized around the **development workflow** rather than just the final product:

#### **`src/` - The Heart of Development**
- **Modular Architecture**: Each file has a single, clear responsibility
- **Easy Navigation**: Find exactly what you need to modify
- **Parallel Development**: Multiple developers can work on different modules
- **Testing**: Individual modules can be tested in isolation

#### **`dist/` - Production Ready**
- **Single File Output**: Roll20 requires a single script file
- **Optimized Bundle**: Rollup combines and optimizes all modules
- **Source Maps**: Debug back to original source code
- **Version Control**: Track changes to the final output

#### **`docs/` - Knowledge Base**
- **Migration History**: Complete record of the transformation
- **Technical Analysis**: Deep dive into the original system
- **Usage Examples**: How to use and extend the system

#### **`original-files/` - Historical Reference**
- **Comparison**: Compare old vs new implementations
- **Rollback Safety**: Original files preserved for emergency rollback
- **Learning**: Understand the evolution of the codebase

## 🔧 Module Organization Logic

### **Core Foundation**
```
trap-core.js     # Configuration, constants, and state
trap-utils.js    # Shared utilities used everywhere
index.js         # Entry point and Roll20 integration
```

### **Command & Control Layer**
```
trap-commands.js # Command parsing and API routing
trap-triggers.js # Trap control and trigger management
```

### **Detection Systems**
```
trap-detector.js  # Movement-based detection
trap-detection.js # Passive perception system
```

### **User Interface**
```
trap-ui.js         # Menu generation and UI helpers
trap-interaction.js # Skill checks and interaction flows
```

### **Advanced Features**
```
trap-macros.js    # Macro execution and export system
```

## 🚀 Development Workflow

### **Making Changes**
1. **Edit Source**: Modify files in `src/` directory
2. **Build**: Run `npm run build` to create new bundle
3. **Test**: Copy `dist/TrapSystem-v2.js` to Roll20
4. **Deploy**: Use the tested bundle in production

### **Adding New Features**
1. **Identify Module**: Determine which module should contain the feature
2. **Implement**: Add the feature to the appropriate `src/` file
3. **Export**: Add necessary exports to make it available
4. **Integrate**: Update other modules if needed
5. **Build & Test**: Create bundle and test thoroughly

### **File Size Guide**
Current module sizes (development perspective):
- **trap-commands.js** (872 lines) - Command system hub
- **trap-detection.js** (968 lines) - Complex passive detection
- **trap-detector.js** (485 lines) - Movement collision detection
- **trap-interaction.js** (643 lines) - Skill check workflows
- **trap-macros.js** (524 lines) - Macro execution & export
- **trap-utils.js** (609 lines) - Utility functions
- **trap-triggers.js** (359 lines) - Trap control
- **index.js** (216 lines) - Event handlers
- **trap-ui.js** (136 lines) - UI helpers
- **trap-core.js** (103 lines) - Configuration

## 📊 Migration Success

### **Before vs After**
- **Original**: 5,687 lines in 1 monolithic file
- **New**: 4,783 lines in 10 modular files
- **Reduction**: 904 lines (15.9% smaller)
- **Maintainability**: ∞% better (immeasurable improvement)

### **Key Improvements**
- **Modular Design**: Each concern separated into its own module
- **Code Deduplication**: Eliminated massive redundancy
- **Better Testing**: Individual modules can be tested
- **Easier Debugging**: Clear separation of functionality
- **Future-Proof**: Easy to add new features

## 🎮 For Roll20 Users

### **Installation**
1. Copy the contents of `dist/TrapSystem-v2.js`
2. Paste into Roll20 API Scripts section
3. Save and restart sandbox

### **Usage**
The system provides 30+ commands starting with `!trapsystem`. Use `!trapsystem help` for a complete interactive guide.

## 🔄 Build System

### **Why Rollup?**
- **ES6 Modules**: Modern JavaScript module system
- **Tree Shaking**: Eliminates unused code
- **Single File Output**: Perfect for Roll20's requirements
- **Source Maps**: Debug back to original source
- **Fast Builds**: Optimized for development workflow

### **Build Configuration**
The `rollup.config.mjs` creates an IIFE (Immediately Invoked Function Expression) bundle that works perfectly in Roll20's sandboxed environment.

## 🎯 Design Principles

### **1. Single Responsibility**
Each module has one clear purpose and does it well.

### **2. Dependency Direction**
- **Core** ← **Utils** ← **Everything else**
- **Commands** orchestrates other modules
- **No circular dependencies**

### **3. Roll20 Compatibility**
- **Single file deployment**
- **No external dependencies**
- **Sandbox-safe code**

### **4. Developer Experience**
- **Clear file names**
- **Logical organization**
- **Easy to navigate**
- **Self-documenting structure**

---

**This organization prioritizes maintainability, scalability, and developer productivity while maintaining Roll20 compatibility.**
=======
# Roll20 MOD Scripts

This repository contains several Roll20 API scripts used to manage effects, lighting, shops and traps. Each script is located in the `Live Files` folder.

## Installation
1. Open your Roll20 campaign's **API Scripts** page.
2. Copy the contents of any script file from this repository and paste it into the editor.
3. Save the script to restart the sandbox. Repeat for each script you wish to use.

## Scripts

### LightControl
Controls dynamic lighting walls, doors and toggling darkness. The help section lists commands such as:
```
!wall -Mxyz123 moveLeft 70 2
!door all_on_page lock
!lc toggledarkness circle 3 --id room_torch
```
These examples come from the built-in help menu.

### TokenFX
Spawns complex visual effects with timing and targeting options. Example usage from the documentation:
```
!spawnComplexFx FX[beam] ID[A] ID[B] TR[infinite] TI[0.4]
!spawnComplexFx FX[beam] CLR[fire] ID[source] TARGET[destination]
!delay 2 {command}
```
See the detailed comments for more options. Additional examples and commands are available in the script's help menu.

### TriggerControl
Automates actions from rollable tables and at the start of a token's turn. The header explains the format:
```
[TOT: once,gm] &{template:default} {{name=Secret Effect}} {{text=Hidden message}}
```
Available commands include `!tt-reset`, `!tt-debug` and `!rtm` as documented in the comment block.

### CommandMenu
Provides an in-game control panel. Use `!menu` followed by a section name or `help` to open different menus:
```
!menu traps
!menu help
```
Handling of the `!menu` command is shown around the chat handler.

### ShopSystem
A D&D 5e shop manager with item databases and haggling. The shop help menu lists quick commands:
```
!shop browse [category]
!shop basket view
!shop help
```
These lines appear in the shop help output.

### TrapSystem
Manages traps, detection auras and interaction menus. Its help menu provides setup and control commands such as:
```
!trapsystem setup
!trapsystem toggle
!trapsystem trigger
!trapsystem status
!trapsystem enable / !trapsystem disable
```
See the extensive help block for full details.

---
Each script includes additional options and configuration settings within the code comments.