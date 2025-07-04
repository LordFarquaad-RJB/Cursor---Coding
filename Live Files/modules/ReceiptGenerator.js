/**
 * ReceiptGenerator.js
 * 
 * Receipt generation and transaction recording module for the Shop System
 * Consolidates all receipt creation and transaction history functionality
 * 
 * Replaces:
 * - Combined receipt generation (Lines 7500-8000)
 * - Simple transaction receipts
 * - Receipt formatting and journaling
 * - Transaction history tracking
 * 
 * Estimated savings: 150-200 lines
 */

const ReceiptGenerator = {
    // Reference to ShopConfig for configuration
    config: null,
    
    // Initialize with config reference
    init(shopConfig) {
        this.config = shopConfig;
        return this;
    },
    
    /**
     * Generate a combined receipt for buy/sell transactions
     * @param {string} playerId - Player ID
     * @param {string} characterId - Character ID
     * @param {Array} buyItems - Items purchased
     * @param {Array} sellItems - Items sold
     * @param {number} finalBuyCopper - Final buy cost in copper
     * @param {number} finalSellCopper - Final sell value in copper
     * @param {number} buyAdjustmentCopper - Buy price adjustment from haggling
     * @param {number} sellAdjustmentCopper - Sell price adjustment from haggling
     * @param {number} originalBuyCopper - Original buy cost before haggling
     * @param {number} originalSellCopper - Original sell value before haggling
     * @param {Object} oldCurrency - Player's currency before transaction
     * @param {Object} newCurrency - Player's currency after transaction
     */
    generateCombinedReceipt(playerId, characterId, buyItems, sellItems, finalBuyCopper, finalSellCopper, 
                           buyAdjustmentCopper, sellAdjustmentCopper, originalBuyCopper, originalSellCopper,
                           oldCurrency, newCurrency) {
        
        const character = getObj('character', characterId);
        if (!character) {
            this.log('Failed to generate receipt: Character not found', 'error');
            return;
        }
        
        const player = getObj('player', playerId);
        const playerName = player ? player.get('_displayname') : 'Unknown Player';
        const characterName = character.get('name');
        const shop = ShopSystem.state.activeShop;
        const timestamp = new Date().toLocaleString();
        
        // Calculate net transaction
        const netTransactionCopper = finalSellCopper - finalBuyCopper;
        const transactionType = netTransactionCopper >= 0 ? "received" : "paid";
        const netAmount = ShopSystemModules.currency.fromCopper(Math.abs(netTransactionCopper));
        
        // Build receipt content
        let receiptContent = this.buildReceiptHeader(shop, characterName, playerName, timestamp);
        
        // Add buy section if applicable
        if (buyItems && buyItems.length > 0) {
            receiptContent += this.buildBuySection(buyItems, originalBuyCopper, finalBuyCopper, buyAdjustmentCopper);
        }
        
        // Add sell section if applicable
        if (sellItems && sellItems.length > 0) {
            receiptContent += this.buildSellSection(sellItems, originalSellCopper, finalSellCopper, sellAdjustmentCopper);
        }
        
        // Add transaction summary
        receiptContent += this.buildTransactionSummary(netTransactionCopper, transactionType, netAmount, oldCurrency, newCurrency);
        
        // Add receipt footer
        receiptContent += this.buildReceiptFooter();
        
        // Create handout for receipt
        this.createReceiptHandout(playerId, characterName, receiptContent, timestamp);
        
        this.log(`Generated combined receipt for ${characterName} (${playerName})`, 'info');
    },
    
    /**
     * Generate a simple receipt for single-type transactions
     * @param {string} playerId - Player ID
     * @param {string} characterId - Character ID
     * @param {Array} items - Transaction items
     * @param {string} transactionType - 'buy' or 'sell'
     * @param {Object} totalAmount - Total transaction amount
     * @param {Object} oldCurrency - Currency before transaction
     * @param {Object} newCurrency - Currency after transaction
     */
    generateSimpleReceipt(playerId, characterId, items, transactionType, totalAmount, oldCurrency, newCurrency) {
        const character = getObj('character', characterId);
        if (!character) {
            this.log('Failed to generate receipt: Character not found', 'error');
            return;
        }
        
        const player = getObj('player', playerId);
        const playerName = player ? player.get('_displayname') : 'Unknown Player';
        const characterName = character.get('name');
        const shop = ShopSystem.state.activeShop;
        const timestamp = new Date().toLocaleString();
        
        // Build receipt content
        let receiptContent = this.buildReceiptHeader(shop, characterName, playerName, timestamp);
        
        if (transactionType === 'buy') {
            const totalCopper = ShopSystemModules.currency.toCopper(totalAmount);
            receiptContent += this.buildBuySection(items, totalCopper, totalCopper, 0);
        } else if (transactionType === 'sell') {
            const totalCopper = ShopSystemModules.currency.toCopper(totalAmount);
            receiptContent += this.buildSellSection(items, totalCopper, totalCopper, 0);
        }
        
        // Add transaction summary
        const netCopper = transactionType === 'buy' ? 
            -ShopSystemModules.currency.toCopper(totalAmount) : 
            ShopSystemModules.currency.toCopper(totalAmount);
        const transactionLabel = transactionType === 'buy' ? "paid" : "received";
        
        receiptContent += this.buildTransactionSummary(netCopper, transactionLabel, totalAmount, oldCurrency, newCurrency);
        receiptContent += this.buildReceiptFooter();
        
        // Create handout for receipt
        this.createReceiptHandout(playerId, characterName, receiptContent, timestamp);
        
        this.log(`Generated ${transactionType} receipt for ${characterName} (${playerName})`, 'info');
    },
    
    /**
     * Build receipt header section
     * @param {Object} shop - Shop object
     * @param {string} characterName - Character name
     * @param {string} playerName - Player name
     * @param {string} timestamp - Transaction timestamp
     * @returns {string} Header HTML
     */
    buildReceiptHeader(shop, characterName, playerName, timestamp) {
        const shopName = shop ? shop.name : 'Unknown Shop';
        const merchantName = shop ? (shop.merchant_name || 'Unknown Merchant') : 'Unknown Merchant';
        const location = shop ? (shop.location || 'Unknown Location') : 'Unknown Location';
        
        return `
<div style="font-family: Georgia, serif; max-width: 400px; margin: 0 auto; padding: 20px; border: 2px solid #8B4513; background: #FFF8DC;">
    <div style="text-align: center; border-bottom: 2px solid #8B4513; padding-bottom: 10px; margin-bottom: 15px;">
        <h2 style="margin: 0; color: #8B4513;">${this.escapeHtml(shopName)}</h2>
        <p style="margin: 5px 0; font-style: italic;">${this.escapeHtml(merchantName)}</p>
        <p style="margin: 5px 0; font-size: 0.9em;">${this.escapeHtml(location)}</p>
    </div>
    
    <div style="margin-bottom: 15px;">
        <p><strong>Customer:</strong> ${this.escapeHtml(characterName)} (${this.escapeHtml(playerName)})</p>
        <p><strong>Date:</strong> ${this.escapeHtml(timestamp)}</p>
    </div>
`;
    },
    
    /**
     * Build buy section of receipt
     * @param {Array} buyItems - Items purchased
     * @param {number} originalCopper - Original cost in copper
     * @param {number} finalCopper - Final cost in copper
     * @param {number} adjustmentCopper - Price adjustment from haggling
     * @returns {string} Buy section HTML
     */
    buildBuySection(buyItems, originalCopper, finalCopper, adjustmentCopper) {
        let section = `
    <div style="margin-bottom: 15px;">
        <h3 style="margin: 0 0 10px 0; color: #8B4513; border-bottom: 1px solid #8B4513;">Items Purchased</h3>
        <table style="width: 100%; border-collapse: collapse;">
`;
        
        buyItems.forEach(item => {
            const itemTotal = ShopSystemModules.currency.toCopper(item.price) * item.quantity;
            const formattedTotal = ShopSystemModules.currency.formatCurrency(ShopSystemModules.currency.fromCopper(itemTotal));
            
            section += `
            <tr>
                <td style="padding: 3px 0;">${this.escapeHtml(item.name)}</td>
                <td style="text-align: center; padding: 3px 5px;">x${item.quantity}</td>
                <td style="text-align: right; padding: 3px 0;">${formattedTotal}</td>
            </tr>
`;
        });
        
        section += `
            <tr style="border-top: 1px solid #8B4513;">
                <td colspan="2" style="padding: 5px 0; font-weight: bold;">Subtotal:</td>
                <td style="text-align: right; padding: 5px 0; font-weight: bold;">${ShopSystemModules.currency.formatCurrency(ShopSystemModules.currency.fromCopper(originalCopper))}</td>
            </tr>
`;
        
        // Add haggle adjustment if applicable
        if (adjustmentCopper !== 0) {
            const adjustmentType = adjustmentCopper < 0 ? "Discount" : "Markup";
            const adjustmentAmount = ShopSystemModules.currency.formatCurrency(ShopSystemModules.currency.fromCopper(Math.abs(adjustmentCopper)));
            const adjustmentPercent = originalCopper > 0 ? Math.round(Math.abs(adjustmentCopper / originalCopper) * 100) : 0;
            
            section += `
            <tr>
                <td colspan="2" style="padding: 3px 0; color: ${adjustmentCopper < 0 ? '#228B22' : '#DC143C'};">${adjustmentType} (${adjustmentPercent}%):</td>
                <td style="text-align: right; padding: 3px 0; color: ${adjustmentCopper < 0 ? '#228B22' : '#DC143C'};">${adjustmentCopper < 0 ? '-' : '+'}${adjustmentAmount}</td>
            </tr>
`;
        }
        
        section += `
            <tr style="border-top: 2px solid #8B4513;">
                <td colspan="2" style="padding: 5px 0; font-weight: bold;">Total Paid:</td>
                <td style="text-align: right; padding: 5px 0; font-weight: bold;">${ShopSystemModules.currency.formatCurrency(ShopSystemModules.currency.fromCopper(finalCopper))}</td>
            </tr>
        </table>
    </div>
`;
        
        return section;
    },
    
    /**
     * Build sell section of receipt
     * @param {Array} sellItems - Items sold
     * @param {number} originalCopper - Original value in copper
     * @param {number} finalCopper - Final value in copper
     * @param {number} adjustmentCopper - Price adjustment from haggling
     * @returns {string} Sell section HTML
     */
    buildSellSection(sellItems, originalCopper, finalCopper, adjustmentCopper) {
        let section = `
    <div style="margin-bottom: 15px;">
        <h3 style="margin: 0 0 10px 0; color: #8B4513; border-bottom: 1px solid #8B4513;">Items Sold</h3>
        <table style="width: 100%; border-collapse: collapse;">
`;
        
        sellItems.forEach(item => {
            const itemTotal = ShopSystemModules.currency.toCopper(item.price) * item.quantity;
            const formattedTotal = ShopSystemModules.currency.formatCurrency(ShopSystemModules.currency.fromCopper(itemTotal));
            
            section += `
            <tr>
                <td style="padding: 3px 0;">${this.escapeHtml(item.name)}</td>
                <td style="text-align: center; padding: 3px 5px;">x${item.quantity}</td>
                <td style="text-align: right; padding: 3px 0;">${formattedTotal}</td>
            </tr>
`;
        });
        
        section += `
            <tr style="border-top: 1px solid #8B4513;">
                <td colspan="2" style="padding: 5px 0; font-weight: bold;">Subtotal:</td>
                <td style="text-align: right; padding: 5px 0; font-weight: bold;">${ShopSystemModules.currency.formatCurrency(ShopSystemModules.currency.fromCopper(originalCopper))}</td>
            </tr>
`;
        
        // Add haggle adjustment if applicable
        if (adjustmentCopper !== 0) {
            const adjustmentType = adjustmentCopper > 0 ? "Bonus" : "Penalty";
            const adjustmentAmount = ShopSystemModules.currency.formatCurrency(ShopSystemModules.currency.fromCopper(Math.abs(adjustmentCopper)));
            const adjustmentPercent = originalCopper > 0 ? Math.round(Math.abs(adjustmentCopper / originalCopper) * 100) : 0;
            
            section += `
            <tr>
                <td colspan="2" style="padding: 3px 0; color: ${adjustmentCopper > 0 ? '#228B22' : '#DC143C'};">${adjustmentType} (${adjustmentPercent}%):</td>
                <td style="text-align: right; padding: 3px 0; color: ${adjustmentCopper > 0 ? '#228B22' : '#DC143C'};">${adjustmentCopper > 0 ? '+' : ''}${adjustmentAmount}</td>
            </tr>
`;
        }
        
        section += `
            <tr style="border-top: 2px solid #8B4513;">
                <td colspan="2" style="padding: 5px 0; font-weight: bold;">Total Received:</td>
                <td style="text-align: right; padding: 5px 0; font-weight: bold;">${ShopSystemModules.currency.formatCurrency(ShopSystemModules.currency.fromCopper(finalCopper))}</td>
            </tr>
        </table>
    </div>
`;
        
        return section;
    },
    
    /**
     * Build transaction summary section
     * @param {number} netTransactionCopper - Net transaction amount in copper
     * @param {string} transactionType - Type of transaction
     * @param {Object} netAmount - Net amount object
     * @param {Object} oldCurrency - Currency before transaction
     * @param {Object} newCurrency - Currency after transaction
     * @returns {string} Summary section HTML
     */
    buildTransactionSummary(netTransactionCopper, transactionType, netAmount, oldCurrency, newCurrency) {
        const netAmountFormatted = ShopSystemModules.currency.formatCurrency(netAmount);
        const oldCurrencyFormatted = ShopSystemModules.currency.formatCurrency(oldCurrency);
        const newCurrencyFormatted = ShopSystemModules.currency.formatCurrency(newCurrency);
        
        return `
    <div style="margin-bottom: 15px; padding: 10px; background: #F5F5DC; border: 1px solid #8B4513;">
        <h3 style="margin: 0 0 10px 0; color: #8B4513;">Transaction Summary</h3>
        <p><strong>Net Amount ${transactionType.charAt(0).toUpperCase() + transactionType.slice(1)}:</strong> ${netAmountFormatted}</p>
        <p><strong>Currency Before:</strong> ${oldCurrencyFormatted}</p>
        <p><strong>Currency After:</strong> ${newCurrencyFormatted}</p>
    </div>
`;
    },
    
    /**
     * Build receipt footer
     * @returns {string} Footer HTML
     */
    buildReceiptFooter() {
        return `
    <div style="text-align: center; margin-top: 20px; padding-top: 10px; border-top: 2px solid #8B4513; font-size: 0.9em; color: #8B4513;">
        <p><em>Thank you for your business!</em></p>
        <p style="font-size: 0.8em;">Receipt generated by ShopSystem v${this.config?.VERSION || '1.0'}</p>
    </div>
</div>
`;
    },
    
    /**
     * Create a handout for the receipt
     * @param {string} playerId - Player ID
     * @param {string} characterName - Character name
     * @param {string} receiptContent - Receipt HTML content
     * @param {string} timestamp - Transaction timestamp
     */
    createReceiptHandout(playerId, characterName, receiptContent, timestamp) {
        try {
            const shop = ShopSystem.state.activeShop;
            const shopName = shop ? shop.name : 'Unknown Shop';
            const handoutName = `Receipt: ${characterName} - ${shopName} - ${new Date().toLocaleDateString()}`;
            
            // Check if similar recent receipt exists
            const existingReceipts = findObjs({
                _type: 'handout',
                name: handoutName
            });
            
            let finalHandoutName = handoutName;
            if (existingReceipts.length > 0) {
                finalHandoutName = `${handoutName} (${existingReceipts.length + 1})`;
            }
            
            const receiptHandout = createObj('handout', {
                name: finalHandoutName,
                inplayerjournals: playerId,
                archived: false
            });
            
            receiptHandout.set('notes', receiptContent);
            
            this.log(`Created receipt handout: ${finalHandoutName}`, 'debug');
            
        } catch (error) {
            this.log(`Error creating receipt handout: ${error.message}`, 'error');
        }
    },
    
    /**
     * Generate a haggle result receipt addition
     * @param {Object} haggleResult - Haggle result details
     * @returns {string} Haggle section HTML
     */
    buildHaggleSection(haggleResult) {
        if (!haggleResult || !haggleResult.applied) {
            return '';
        }
        
        const { skillType, rollValue, dc, success, adjustmentPercent } = haggleResult;
        const resultText = success ? 'Success' : 'Failed';
        const resultColor = success ? '#228B22' : '#DC143C';
        
        return `
    <div style="margin-bottom: 15px; padding: 8px; background: #FFF8DC; border: 1px solid #DDD;">
        <h4 style="margin: 0 0 8px 0; color: #8B4513;">Haggle Attempt</h4>
        <p><strong>Skill Used:</strong> ${this.escapeHtml(skillType)}</p>
        <p><strong>Roll:</strong> ${rollValue} vs DC ${dc}</p>
        <p style="color: ${resultColor};"><strong>Result:</strong> ${resultText}</p>
        ${adjustmentPercent !== 0 ? `<p><strong>Price Adjustment:</strong> ${adjustmentPercent > 0 ? '+' : ''}${Math.round(adjustmentPercent * 100)}%</p>` : ''}
    </div>
`;
    },
    
    /**
     * Create a transaction log entry
     * @param {Object} transactionData - Transaction details
     */
    logTransaction(transactionData) {
        try {
            // Find or create transaction log handout
            let logHandout = findObjs({
                _type: 'handout',
                name: 'ShopSystem Transaction Log'
            })[0];
            
            if (!logHandout) {
                logHandout = createObj('handout', {
                    name: 'ShopSystem Transaction Log',
                    inplayerjournals: '',
                    archived: false
                });
                
                const logHeader = `
<h2>ShopSystem Transaction Log</h2>
<p><em>Automatic transaction logging for audit purposes</em></p>
<hr>
`;
                logHandout.set('notes', logHeader);
            }
            
            // Build log entry
            const timestamp = new Date().toLocaleString();
            const logEntry = `
<div style="border-bottom: 1px solid #ccc; margin-bottom: 10px; padding-bottom: 10px;">
    <h4>${timestamp}</h4>
    <p><strong>Player:</strong> ${this.escapeHtml(transactionData.playerName)}</p>
    <p><strong>Character:</strong> ${this.escapeHtml(transactionData.characterName)}</p>
    <p><strong>Shop:</strong> ${this.escapeHtml(transactionData.shopName)}</p>
    <p><strong>Type:</strong> ${this.escapeHtml(transactionData.type)}</p>
    <p><strong>Amount:</strong> ${this.escapeHtml(transactionData.amount)}</p>
    ${transactionData.items ? `<p><strong>Items:</strong> ${transactionData.items}</p>` : ''}
</div>
`;
            
            // Append to existing log
            logHandout.get('notes', function(currentNotes) {
                const updatedNotes = (currentNotes || '') + logEntry;
                logHandout.set('notes', updatedNotes);
            });
            
            this.log('Transaction logged successfully', 'debug');
            
        } catch (error) {
            this.log(`Error logging transaction: ${error.message}`, 'error');
        }
    },
    
    /**
     * Escape HTML characters for safe display
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },
    
    /**
     * Generate receipt for failed transaction
     * @param {string} playerId - Player ID
     * @param {string} reason - Failure reason
     * @param {Object} attemptedTransaction - Transaction that failed
     */
    generateFailureReceipt(playerId, reason, attemptedTransaction) {
        const player = getObj('player', playerId);
        const playerName = player ? player.get('_displayname') : 'Unknown Player';
        const timestamp = new Date().toLocaleString();
        
        const failureContent = `
<div style="font-family: Georgia, serif; max-width: 400px; margin: 0 auto; padding: 20px; border: 2px solid #DC143C; background: #FFF0F0;">
    <div style="text-align: center; border-bottom: 2px solid #DC143C; padding-bottom: 10px; margin-bottom: 15px;">
        <h2 style="margin: 0; color: #DC143C;">Transaction Failed</h2>
    </div>
    
    <div style="margin-bottom: 15px;">
        <p><strong>Player:</strong> ${this.escapeHtml(playerName)}</p>
        <p><strong>Date:</strong> ${this.escapeHtml(timestamp)}</p>
        <p><strong>Reason:</strong> ${this.escapeHtml(reason)}</p>
    </div>
    
    <div style="text-align: center; margin-top: 20px; padding-top: 10px; border-top: 2px solid #DC143C; font-size: 0.9em; color: #DC143C;">
        <p><em>Please try again or contact the GM for assistance.</em></p>
    </div>
</div>
`;
        
        this.createReceiptHandout(playerId, 'Failed Transaction', failureContent, timestamp);
        this.log(`Generated failure receipt for ${playerName}: ${reason}`, 'info');
    },
    
    // Helper methods
    log(message, type = 'info') {
        const prefix = this.config?.LOGGING?.PREFIX?.[type] || '📜';
        log(`${prefix} ReceiptGenerator: ${message}`);
    }
};

// Export for Roll20 environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReceiptGenerator;
} else {
    this.ReceiptGenerator = ReceiptGenerator;
}