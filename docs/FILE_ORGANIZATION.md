# File Organization Reference

## 📂 Directory Structure

```
TrapSystem-v2/
├── 📄 README.md                    # Project overview and usage guide
├── 📄 package.json                 # Node.js project configuration
├── 📄 package-lock.json            # Locked dependency versions
├── 📄 rollup.config.mjs            # Build system configuration
│
├── 📁 src/                         # 🔧 SOURCE CODE (Edit these files)
│   ├── 📄 index.js                 # Entry point & Roll20 event handlers
│   ├── 📄 trap-core.js             # Configuration & state management
│   ├── 📄 trap-utils.js            # Utility functions & helpers
│   ├── 📄 trap-commands.js         # Command parsing & routing (30+ commands)
│   ├── 📄 trap-triggers.js         # Trap control & trigger system
│   ├── 📄 trap-interaction.js      # Skill checks & interaction menus
│   ├── 📄 trap-detection.js        # Passive detection & perception
│   ├── 📄 trap-detector.js         # Movement detection & collision
│   ├── 📄 trap-macros.js           # Macro execution & export system
│   └── 📄 trap-ui.js               # UI helpers & menu generation
│
├── 📁 dist/                        # 📦 PRODUCTION FILES (Copy to Roll20)
│   ├── 📄 TrapSystem-v2.js         # Final bundle (4,783 lines)
│   └── 📄 TrapSystem-v2.js.map     # Source map for debugging
│
├── 📁 docs/                        # 📚 DOCUMENTATION
│   ├── 📄 MIGRATION_COMPLETE.md    # Complete migration summary
│   ├── 📄 trap_system_analysis.md  # Original system analysis
│   ├── 📄 DEVELOPMENT_GUIDE.md     # Developer guide & architecture
│   └── 📄 FILE_ORGANIZATION.md     # This file
│
├── 📁 original-files/              # 🗄️ ARCHIVE (Original files)
│   ├── 📄 Live-SYS-TrapSystem.js   # Original 5,687-line monolith
│   ├── 📄 Live-SYS-ShopSystem.js   # Other Roll20 scripts
│   ├── 📄 Live-CommandMenu.js      # Related systems
│   └── 📄 [other scripts]          # Additional original files
│
└── 📁 archive/                     # 📋 FUTURE ARCHIVE
    └── [old versions]              # Previous versions & backups
```

## 🎯 File Purposes

### **Development Files** (Edit these)

| File | Purpose | Size | Complexity |
|------|---------|------|------------|
| `src/trap-core.js` | Config & state | 103 lines | ⭐ Simple |
| `src/trap-utils.js` | Utilities | 609 lines | ⭐⭐ Moderate |
| `src/index.js` | Entry point | 216 lines | ⭐⭐ Moderate |
| `src/trap-triggers.js` | Trap control | 359 lines | ⭐⭐ Moderate |
| `src/trap-ui.js` | UI helpers | 136 lines | ⭐ Simple |
| `src/trap-detector.js` | Movement detection | 485 lines | ⭐⭐⭐ Complex |
| `src/trap-macros.js` | Macro system | 524 lines | ⭐⭐⭐ Complex |
| `src/trap-interaction.js` | Skill checks | 643 lines | ⭐⭐⭐ Complex |
| `src/trap-commands.js` | Command router | 872 lines | ⭐⭐⭐⭐ Very Complex |
| `src/trap-detection.js` | Passive detection | 968 lines | ⭐⭐⭐⭐ Very Complex |

### **Production Files** (Deploy these)

| File | Purpose | Usage |
|------|---------|-------|
| `dist/TrapSystem-v2.js` | Final bundle | Copy to Roll20 API Scripts |
| `dist/TrapSystem-v2.js.map` | Source map | For debugging (optional) |

### **Documentation Files** (Reference these)

| File | Purpose | When to Read |
|------|---------|-------------|
| `README.md` | Project overview | First time setup |
| `docs/DEVELOPMENT_GUIDE.md` | Architecture guide | When developing |
| `docs/MIGRATION_COMPLETE.md` | Migration summary | Understanding the project |
| `docs/FILE_ORGANIZATION.md` | This file | When lost in files |

### **Archive Files** (Reference only)

| File | Purpose | When to Use |
|------|---------|------------|
| `original-files/Live-SYS-TrapSystem.js` | Original system | Comparison & rollback |
| `original-files/[others]` | Related systems | Understanding ecosystem |

## 🔄 Workflow Guide

### **Daily Development**
1. **Edit**: Modify files in `src/`
2. **Build**: Run `npm run build`
3. **Test**: Copy `dist/TrapSystem-v2.js` to Roll20
4. **Repeat**: Continue until satisfied

### **Adding Features**
1. **Plan**: Decide which `src/` file should contain the feature
2. **Implement**: Add code to appropriate module
3. **Export**: Make functionality available to other modules
4. **Test**: Build and test in Roll20

### **Debugging Issues**
1. **Check**: Console errors in Roll20
2. **Locate**: Use source maps to find original code
3. **Fix**: Edit the appropriate `src/` file
4. **Verify**: Rebuild and test

### **Deploying Updates**
1. **Build**: Ensure `npm run build` succeeds
2. **Test**: Verify functionality in Roll20 dev game
3. **Deploy**: Copy `dist/TrapSystem-v2.js` to production
4. **Monitor**: Check for errors and user feedback

## 🎨 Organization Principles

### **Why This Structure?**

#### **1. Development-First**
- Source files are the primary focus
- Clear separation of concerns
- Easy to navigate and modify

#### **2. Single Responsibility**
- Each file has one clear purpose
- Reduces complexity and conflicts
- Makes testing easier

#### **3. Dependency Clarity**
- Clear hierarchy from core to features
- No circular dependencies
- Predictable import patterns

#### **4. Production Ready**
- Single file output for Roll20
- Source maps for debugging
- Optimized bundle size

#### **5. Documentation Driven**
- Comprehensive guides for developers
- Clear explanations of decisions
- Easy onboarding for new contributors

### **File Naming Convention**

| Pattern | Example | Purpose |
|---------|---------|---------|
| `trap-[feature].js` | `trap-detection.js` | Feature modules |
| `[purpose].js` | `index.js` | Special purpose files |
| `[UPPER].md` | `README.md` | Documentation files |

### **Size Guidelines**

| Category | Target Size | Reasoning |
|----------|-------------|-----------|
| Core files | < 200 lines | Stability and simplicity |
| Utility files | < 800 lines | Comprehensive but manageable |
| Feature files | < 700 lines | Single feature focus |
| Complex files | < 1000 lines | Maximum before splitting |

## 🚀 Quick Actions

### **I want to...**

| Goal | Files to Edit | Command to Run |
|------|---------------|----------------|
| Add a new command | `src/trap-commands.js` | `npm run build` |
| Fix trap behavior | `src/trap-triggers.js` | `npm run build` |
| Improve detection | `src/trap-detection.js` or `src/trap-detector.js` | `npm run build` |
| Update UI | `src/trap-ui.js` or `src/trap-interaction.js` | `npm run build` |
| Add utilities | `src/trap-utils.js` | `npm run build` |
| Change config | `src/trap-core.js` | `npm run build` |
| Deploy to Roll20 | Copy `dist/TrapSystem-v2.js` | N/A |

### **I need to...**

| Need | File to Check | Purpose |
|------|---------------|---------|
| Understand the project | `README.md` | Overview and setup |
| Learn the architecture | `docs/DEVELOPMENT_GUIDE.md` | Technical details |
| See migration results | `docs/MIGRATION_COMPLETE.md` | Success metrics |
| Compare with original | `original-files/Live-SYS-TrapSystem.js` | Historical reference |
| Find this guide | `docs/FILE_ORGANIZATION.md` | You're here! |

---

**This organization maximizes developer productivity while maintaining Roll20 compatibility and code quality.**