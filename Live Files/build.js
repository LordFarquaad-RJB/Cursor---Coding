/**
 * Build Script for Live-SYS-ShopSystem
 * 
 * Concatenates all modules into a single Roll20-ready script
 * Usage: node build.js [--dev] [--output filename]
 */

const fs = require('fs');
const path = require('path');

// Build configuration
const CONFIG = {
    sourceDir: './modules',
    outputDir: './',
    outputFile: 'Live-SYS-ShopSystem-Built.js',
    originalFile: 'Live-SYS-ShopSystem.js',
    
    // Module load order (dependencies first)
    moduleOrder: [
        'ShopConfig.js',
        'CurrencyManager.js', 
        'MenuBuilder.js',
        'BasketManager.js',
        'ReceiptGenerator.js',
        'StockManager.js',
        'DatabaseManager.js'
    ],
    
    // Modules that are required vs optional
    requiredModules: [
        'ShopConfig.js',
        'CurrencyManager.js',
        'MenuBuilder.js'
    ]
};

// Parse command line arguments
const args = process.argv.slice(2);
const isDev = args.includes('--dev');
const outputIndex = args.indexOf('--output');
const outputFile = outputIndex !== -1 && args[outputIndex + 1] ? args[outputIndex + 1] : CONFIG.outputFile;

console.log('🔧 Building Live-SYS-ShopSystem for Roll20...');
console.log(`📂 Source: ${CONFIG.sourceDir}`);
console.log(`📄 Output: ${outputFile}`);
console.log(`🔧 Mode: ${isDev ? 'Development' : 'Production'}`);

/**
 * Read and clean a module file
 */
function readModule(modulePath) {
    if (!fs.existsSync(modulePath)) {
        console.log(`⚠️  Module not found: ${modulePath}`);
        return null;
    }
    
    let content = fs.readFileSync(modulePath, 'utf8');
    
    // Remove export statements (Roll20 doesn't support them)
    content = content.replace(/if \(typeof module !== 'undefined'[\s\S]*?}\s*else\s*{\s*this\..*?;\s*}/g, '');
    
    // Remove module.exports lines
    content = content.replace(/module\.exports = .*?;/g, '');
    
    return content;
}

/**
 * Generate module initialization code
 */
function generateInitCode(availableModules) {
    return `
// ============================================================================
// MODULE INITIALIZATION
// ============================================================================

// Initialize ShopSystemModules object
if (typeof ShopSystemModules === 'undefined') {
    var ShopSystemModules = {};
}

// Initialize modules in dependency order
${availableModules.includes('ShopConfig.js') ? 'ShopSystemModules.config = ShopConfig;' : ''}
${availableModules.includes('CurrencyManager.js') ? 'ShopSystemModules.currency = CurrencyManager.init(ShopConfig);' : ''}
${availableModules.includes('MenuBuilder.js') ? 'ShopSystemModules.menu = MenuBuilder.init(ShopConfig);' : ''}
${availableModules.includes('BasketManager.js') ? 'ShopSystemModules.basket = BasketManager.init(ShopConfig);' : ''}
${availableModules.includes('ReceiptGenerator.js') ? 'ShopSystemModules.receipt = ReceiptGenerator.init(ShopConfig);' : ''}
${availableModules.includes('StockManager.js') ? 'ShopSystemModules.stock = StockManager.init(ShopConfig);' : ''}
${availableModules.includes('DatabaseManager.js') ? 'ShopSystemModules.database = DatabaseManager.init(ShopConfig);' : ''}

// Log module status
log('📦 ShopSystem Modules Loaded:');
${availableModules.map(mod => `log('  ✅ ${mod.replace('.js', '')}');`).join('\n')}

// Helper function to check if modules are available
function checkModules() {
    const required = ${JSON.stringify(CONFIG.requiredModules.map(m => m.replace('.js', '')))};
    const missing = required.filter(name => !ShopSystemModules[name.toLowerCase()]);
    
    if (missing.length > 0) {
        log('❌ Missing required modules: ' + missing.join(', '));
        return false;
    }
    
    log('✅ All required modules loaded successfully');
    return true;
}

// Validate module loading
checkModules();

// ============================================================================
// MAIN SHOPSYSTEM CODE BEGINS HERE
// ============================================================================
`;
}

/**
 * Generate build header
 */
function generateBuildHeader() {
    const timestamp = new Date().toISOString();
    const version = require('./package.json').version || '1.0.0';
    
    return `/**
 * Live-SYS-ShopSystem - Built Version
 * 
 * Generated: ${timestamp}
 * Version: ${version}
 * Build Mode: ${isDev ? 'Development' : 'Production'}
 * 
 * This file is auto-generated from multiple modules.
 * Do not edit directly - edit the source modules instead.
 * 
 * Source modules included:
${CONFIG.moduleOrder.map(mod => ` * - ${mod}`).join('\n')}
 */

// ============================================================================
// MODULES
// ============================================================================
`;
}

/**
 * Process the original main file  
 */
function processMainFile() {
    const mainPath = path.join(CONFIG.outputDir, CONFIG.originalFile);
    
    if (!fs.existsSync(mainPath)) {
        console.log(`⚠️  Original file not found: ${mainPath}`);
        return '// Original ShopSystem file not found';
    }
    
    let content = fs.readFileSync(mainPath, 'utf8');
    
    // Remove the CONFIG object if it exists (will be replaced by ShopConfig module)
    content = content.replace(/const CONFIG = \{[\s\S]*?\};/g, '// CONFIG object replaced by ShopConfig module');
    
    // TODO: Add more automatic replacements here as we identify them
    
    return content;
}

/**
 * Main build function
 */
function buildScript() {
    const parts = [];
    const availableModules = [];
    
    // Add build header
    parts.push(generateBuildHeader());
    
    // Process each module in order
    CONFIG.moduleOrder.forEach(moduleName => {
        const modulePath = path.join(CONFIG.sourceDir, moduleName);
        const moduleContent = readModule(modulePath);
        
        if (moduleContent) {
            availableModules.push(moduleName);
            parts.push(`\n// ============================================================================`);
            parts.push(`// MODULE: ${moduleName}`);
            parts.push(`// ============================================================================\n`);
            parts.push(moduleContent);
        }
    });
    
    // Add module initialization
    parts.push(generateInitCode(availableModules));
    
    // Add original main file (if we want to include it)
    if (isDev) {
        parts.push('\n// ============================================================================');
        parts.push('// ORIGINAL MAIN FILE (for reference in dev mode)');
        parts.push('// ============================================================================\n');
        parts.push('/*\n' + processMainFile() + '\n*/');
    }
    
    return parts.join('\n');
}

/**
 * Write the built file
 */
function writeBuiltFile(content) {
    const outputPath = path.join(CONFIG.outputDir, outputFile);
    
    try {
        fs.writeFileSync(outputPath, content);
        console.log(`✅ Built file created: ${outputPath}`);
        console.log(`📊 File size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
        
        // Count lines
        const lines = content.split('\n').length;
        console.log(`📏 Lines: ${lines}`);
        
        return true;
    } catch (error) {
        console.error(`❌ Error writing file: ${error.message}`);
        return false;
    }
}

/**
 * Create a simple package.json if it doesn't exist
 */
function ensurePackageJson() {
    const packagePath = path.join(CONFIG.outputDir, 'package.json');
    
    if (!fs.existsSync(packagePath)) {
        const defaultPackage = {
            name: "live-sys-shopsystem",
            version: "1.0.0",
            description: "Roll20 Shop System - Modular Build",
            main: "Live-SYS-ShopSystem.js",
            scripts: {
                build: "node build.js",
                "build:dev": "node build.js --dev"
            },
            keywords: ["roll20", "dnd", "shop", "system"],
            author: "Your Name",
            license: "MIT"
        };
        
        fs.writeFileSync(packagePath, JSON.stringify(defaultPackage, null, 2));
        console.log('📦 Created package.json');
    }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

function main() {
    console.log('🚀 Starting build process...\n');
    
    // Ensure package.json exists
    ensurePackageJson();
    
    // Check if source directory exists
    if (!fs.existsSync(CONFIG.sourceDir)) {
        console.error(`❌ Source directory not found: ${CONFIG.sourceDir}`);
        process.exit(1);
    }
    
    // Build the script
    const builtContent = buildScript();
    
    // Write the output file
    const success = writeBuiltFile(builtContent);
    
    if (success) {
        console.log('\n🎉 Build completed successfully!');
        console.log(`\n📋 Next steps:`);
        console.log(`   1. Open Roll20 and go to the API Scripts tab`);
        console.log(`   2. Create a new script or edit existing script`);
        console.log(`   3. Copy the contents of ${outputFile} into the script`);
        console.log(`   4. Save and test the script`);
        
        if (isDev) {
            console.log(`\n🔧 Development mode: Original file included as comments for reference`);
        }
    } else {
        console.log('\n❌ Build failed');
        process.exit(1);
    }
}

// Run the build
main();