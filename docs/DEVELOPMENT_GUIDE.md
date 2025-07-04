# TrapSystem v2.0 Development Guide

## 🏗️ Architecture Overview

The TrapSystem v2.0 follows a **layered modular architecture** designed for maintainability and extensibility.

### **Dependency Hierarchy**
```
┌─────────────────────────────────────────────────────────────┐
│                        index.js                            │
│                   (Entry Point & Events)                   │
└─────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────┐
│                    trap-commands.js                        │
│                 (Command Router & API)                     │
└─────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────┬─────────────────┬─────────────────────────┐
│ trap-triggers.js│ trap-interaction│   trap-detection.js     │
│   (Controls)    │    (Menus)      │    (Passive)           │
└─────────────────┴─────────────────┴─────────────────────────┘
                                ↓
┌─────────────────┬─────────────────┬─────────────────────────┐
│ trap-detector.js│  trap-macros.js │     trap-ui.js          │
│  (Movement)     │   (Export)      │    (Helpers)           │
└─────────────────┴─────────────────┴─────────────────────────┘
                                ↓
┌─────────────────┬─────────────────────────────────────────┐
│ trap-utils.js   │           trap-core.js                  │
│  (Utilities)    │      (Config & State)                   │
└─────────────────┴─────────────────────────────────────────┘
```

## 📁 Module Breakdown

### **🎯 Core Foundation**

#### **`trap-core.js`** - Configuration & State
- **Purpose**: Central configuration and state management
- **Size**: 103 lines (smallest, most stable)
- **Contains**:
  - `Config`: Aura colors, skill types, message templates
  - `State`: Global state variables and tracking
  - **No dependencies** on other modules

#### **`trap-utils.js`** - Utility Functions
- **Purpose**: Shared utility functions used throughout the system
- **Size**: 609 lines (large but stable)
- **Contains**:
  - Token validation and manipulation
  - Geometry calculations (line intersection, OBB)
  - Grid coordinate conversions
  - Chat and messaging helpers
- **Dependencies**: Only `trap-core.js`

#### **`index.js`** - Entry Point & Events
- **Purpose**: Roll20 integration and event handling
- **Size**: 216 lines (focused and clean)
- **Contains**:
  - `on("ready")` handler
  - `on("chat:message")` handler
  - `on("change:graphic")` handler
  - System initialization
- **Dependencies**: All modules (orchestrates everything)

### **🎮 Command & Control Layer**

#### **`trap-commands.js`** - Command Router
- **Purpose**: Parse and route all `!trapsystem` commands
- **Size**: 872 lines (largest, most complex)
- **Contains**:
  - Command parsing with quote handling
  - 30+ command handlers
  - Roll processing (advanced and simple)
  - Help system generation
- **Dependencies**: All other modules (central hub)

#### **`trap-triggers.js`** - Trap Control
- **Purpose**: Core trap functionality and control
- **Size**: 359 lines (focused functionality)
- **Contains**:
  - Trap toggle, status, manual triggering
  - Trap setup (standard and interaction)
  - Macro processing and execution
- **Dependencies**: `trap-core.js`, `trap-utils.js`

### **🔍 Detection Systems**

#### **`trap-detector.js`** - Movement Detection
- **Purpose**: Movement-based trap triggering
- **Size**: 485 lines (complex geometry)
- **Contains**:
  - Movement path analysis
  - Line intersection detection
  - OBB collision detection
  - Token positioning algorithms
- **Dependencies**: `trap-core.js`, `trap-utils.js`

#### **`trap-detection.js`** - Passive Detection
- **Purpose**: Passive perception and line-of-sight
- **Size**: 968 lines (most complex module)
- **Contains**:
  - Multi-source passive perception
  - Line of sight calculations
  - Detection messaging system
  - Aura management
- **Dependencies**: `trap-core.js`, `trap-utils.js`

### **🎨 User Interface**

#### **`trap-ui.js`** - UI Helpers
- **Purpose**: Menu generation and UI utilities
- **Size**: 136 lines (smallest functional module)
- **Contains**:
  - Roll20 template builders
  - Menu formatting helpers
  - Message styling utilities
- **Dependencies**: `trap-core.js`, `trap-utils.js`

#### **`trap-interaction.js`** - Skill Checks & Menus
- **Purpose**: Interactive skill check workflows
- **Size**: 643 lines (complex user flows)
- **Contains**:
  - Skill check setup and execution
  - Character selection menus
  - GM response interfaces
  - Roll result processing
- **Dependencies**: `trap-core.js`, `trap-utils.js`, `trap-ui.js`

### **🔧 Advanced Features**

#### **`trap-macros.js`** - Macro System
- **Purpose**: Macro execution and export functionality
- **Size**: 524 lines (feature-complete)
- **Contains**:
  - Macro placeholder replacement
  - State capture and export
  - Reset functionality
  - Token order tracking
- **Dependencies**: `trap-core.js`, `trap-utils.js`

## 🛠️ Development Patterns

### **Adding New Features**

#### **1. Identify the Right Module**
- **Commands**: Add to `trap-commands.js`
- **Trap behavior**: Add to `trap-triggers.js`
- **Detection logic**: Add to `trap-detector.js` or `trap-detection.js`
- **UI elements**: Add to `trap-ui.js`
- **Utilities**: Add to `trap-utils.js`

#### **2. Follow the Pattern**
```javascript
// In the appropriate module
export const newFeature = {
    someFunction() {
        // Implementation
    },
    
    anotherFunction() {
        // Implementation
    }
};
```

#### **3. Update Exports**
```javascript
// At the end of the module
export { existingExport, newFeature };
```

#### **4. Import Where Needed**
```javascript
// In consuming modules
import { newFeature } from './appropriate-module.js';
```

### **State Management**

#### **Global State** (`trap-core.js`)
```javascript
export const State = {
    // Add new state properties here
    newFeatureState: {},
    // Existing state...
};
```

#### **Accessing State**
```javascript
// In any module
import { State } from './trap-core.js';

// Use State.propertyName
State.newFeatureState.someValue = 'data';
```

### **Configuration**

#### **Adding New Config** (`trap-core.js`)
```javascript
export const Config = {
    // Add new configuration here
    newFeatureConfig: {
        defaultValue: 'something',
        options: ['a', 'b', 'c']
    },
    // Existing config...
};
```

## 🔄 Build Process

### **Development Cycle**
1. **Edit** source files in `src/`
2. **Build** with `npm run build`
3. **Test** by copying `dist/TrapSystem-v2.js` to Roll20
4. **Debug** using source maps if needed
5. **Repeat** until satisfied

### **Build Configuration**
The `rollup.config.mjs` handles:
- **Module Resolution**: Combines all ES6 modules
- **IIFE Wrapping**: Creates Roll20-compatible output
- **Source Maps**: Enables debugging back to source
- **Code Optimization**: Minimal optimizations for readability

## 🧪 Testing Strategy

### **Module Testing**
Each module can be tested independently:
```javascript
// Test individual functions
import { someFunction } from './src/trap-utils.js';
console.log(someFunction(testInput));
```

### **Integration Testing**
Test the complete system in Roll20:
1. Copy `dist/TrapSystem-v2.js` to Roll20
2. Create test traps and tokens
3. Verify all commands work
4. Test edge cases and error conditions

### **Regression Testing**
After changes, verify:
- All existing commands still work
- No console errors
- Performance hasn't degraded
- Memory usage is stable

## 📊 Code Quality Guidelines

### **File Size Targets**
- **Core modules** (`trap-core.js`): < 200 lines
- **Utility modules** (`trap-utils.js`): < 800 lines
- **Feature modules**: < 700 lines
- **Complex modules** (`trap-detection.js`): < 1000 lines

### **Function Complexity**
- **Simple functions**: < 20 lines
- **Complex functions**: < 50 lines
- **Very complex functions**: < 100 lines (rare)

### **Naming Conventions**
- **Files**: `trap-feature.js` (kebab-case)
- **Exports**: `camelCase` or `PascalCase`
- **Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`

## 🚀 Performance Considerations

### **Module Loading**
- All modules are bundled into a single file
- No runtime module loading overhead
- Tree shaking eliminates unused code

### **Memory Management**
- State is centralized in `trap-core.js`
- No memory leaks from event handlers
- Efficient object reuse where possible

### **Roll20 Optimization**
- Minimal API calls
- Efficient token queries
- Batch operations where possible
- Debounced event handling

## 🔧 Debugging Tips

### **Source Maps**
The build process generates source maps, allowing you to debug the original source code even when running the bundled version.

### **Module Isolation**
Test individual modules by importing them directly:
```javascript
// In Roll20 console
const utils = TrapSystem.utils;
console.log(utils.someFunction());
```

### **Logging**
Use the built-in logging system:
```javascript
TrapSystem.utils.log('Debug message', 'debug');
TrapSystem.utils.log('Warning message', 'warn');
TrapSystem.utils.log('Error message', 'error');
```

---

**This architecture provides a solid foundation for continued development while maintaining Roll20 compatibility and code quality.**