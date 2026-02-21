const { Telegraf } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf('8473768451:AAF7xWs6GpigimrIdlQEpQvMRThGEv6xpU8');

console.log('🇵🇰 PAKISTAN DATABASE BOT STARTED');

// Check if input is CNIC
function isCNIC(input) {
    let clean = input.replace(/\D/g, '');
    if (clean.length === 13) return true;
    if (input.includes('-')) {
        let parts = input.split('-');
        if (parts.length === 3 && parts.join('').length === 13) return true;
    }
    return false;
}

// Format phone number
function formatPhone(input) {
    let num = input.replace(/\D/g, '');
    if (!num) return null;
    
    if (num.startsWith('03') && num.length === 11) return num.substring(1);
    if (num.startsWith('3') && num.length === 10) return num;
    if (num.startsWith('92') && num.length === 12) return num.substring(2);
    if (num.startsWith('0092') && num.length === 14) return num.substring(4);
    if (num.startsWith('0') && num.length === 11) return num.substring(1);
    return null;
}

// Format CNIC
function formatCNIC(input) {
    let clean = input.replace(/\D/g, '');
    if (clean.length === 13) {
        return `${clean.slice(0,5)}-${clean.slice(5,12)}-${clean.slice(12)}`;
    }
    return null;
}

// Mock Database (Replace with actual API)
const DATABASE = {
    // Phone numbers data
    '3001234567': {
        name: 'John Alexander',
        cnic: '42101-1234567-8',
        address: '23 Main Boulevard, Lahore'
    },
    '3105551234': {
        name: 'Sarah Johnson',
        cnic: '35202-4567890-1',
        address: '55 F-10/4, Islamabad'
    },
    '3336678955': {
        name: 'Michael Williams',
        cnic: '42101-1234567-8',
        address: '12 Model Town, Lahore'
    },
    '3217654321': {
        name: 'John Alexander',
        cnic: '42101-1234567-8',
        address: '23 Main Boulevard, Lahore'
    },
    '3335557777': {
        name: 'John Alexander',
        cnic: '42101-1234567-8',
        address: '23 Main Boulevard, Lahore'
    },
    '3456789012': {
        name: 'Sarah Johnson',
        cnic: '35202-4567890-1',
        address: '55 F-10/4, Islamabad'
    },
    // CNIC data
    '42101-1234567-8': {
        name: 'John Alexander',
        address: '23 Main Boulevard, Lahore',
        numbers: ['3001234567', '3217654321', '3335557777']
    },
    '35202-4567890-1': {
        name: 'Sarah Johnson',
        address: '55 F-10/4, Islamabad',
        numbers: ['3105551234', '3456789012']
    },
    '37303-5678901-2': {
        name: 'Michael Williams',
        address: '78 People\'s Colony, Faisalabad',
        numbers: ['3336678955']
    }
};

bot.start((ctx) => {
    ctx.reply(
        '🇵🇰 *PAKISTAN DATABASE BOT* 🇵🇰\n\n' +
        'Send a phone number or CNIC number\n\n' +
        '📱 *Phone Formats:*\n' +
        '• 3001234567\n' +
        '• 03001234567\n' +
        '• 923001234567\n' +
        '• +923001234567\n\n' +
        '🆔 *CNIC Formats:*\n' +
        '• 4210112345678\n' +
        '• 42101-1234567-8',
        { parse_mode: 'Markdown' }
    );
});

bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith('/')) return;
    
    // Check if CNIC
    if (isCNIC(text)) {
        const cnic = formatCNIC(text);
        console.log(`🔍 Searching CNIC: ${cnic}`);
        
        const msg = await ctx.reply(`🆔 Searching CNIC *${cnic}*...`, { parse_mode: 'Markdown' });
        
        try {
            // Get CNIC data
            const cnicData = DATABASE[cnic];
            
            if (!cnicData) {
                return ctx.telegram.editMessageText(
                    ctx.chat.id, 
                    msg.message_id, 
                    null, 
                    `❌ No data found for CNIC *${cnic}*`,
                    { parse_mode: 'Markdown' }
                );
            }
            
            let response = `🆔 *CNIC:* ${cnic}\n`;
            response += `👤 *Name:* ${cnicData.name}\n`;
            response += `📍 *Address:* ${cnicData.address}\n\n`;
            response += `📱 *Registered Numbers (${cnicData.numbers.length}):*\n\n`;
            
            for (let i = 0; i < cnicData.numbers.length; i++) {
                const num = cnicData.numbers[i];
                const phoneData = DATABASE[num] || {};
                response += `${i+1}. 📞 *${num}*\n`;
                response += `   📍 ${phoneData.address || 'N/A'}\n`;
                if (i < cnicData.numbers.length - 1) response += `   ──────────\n`;
            }
            
            await ctx.telegram.editMessageText(
                ctx.chat.id, 
                msg.message_id, 
                null, 
                response,
                { parse_mode: 'Markdown' }
            );
            console.log(`✅ CNIC found: ${cnic}`);
            
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
            await ctx.telegram.editMessageText(
                ctx.chat.id, 
                msg.message_id, 
                null, 
                '⚠️ Server connection error'
            );
        }
        return;
    }
    
    // Handle as phone number
    const phone = formatPhone(text);
    if (!phone) {
        return ctx.reply(
            '❌ *Invalid format*\n\n' +
            'Please send:\n' +
            '📱 Phone: 3001234567\n' +
            '🆔 CNIC: 42101-1234567-8',
            { parse_mode: 'Markdown' }
        );
    }
    
    console.log(`🔍 Searching Phone: ${phone}`);
    const msg = await ctx.reply(`📱 Searching *${phone}*...`, { parse_mode: 'Markdown' });
    
    try {
        // Get phone owner data
        const ownerData = DATABASE[phone];
        
        if (!ownerData) {
            return ctx.telegram.editMessageText(
                ctx.chat.id, 
                msg.message_id, 
                null, 
                `❌ No data found for number *${phone}*`,
                { parse_mode: 'Markdown' }
            );
        }
        
        let response = `✅ *Number Found*\n\n`;
        response += `📞 *Phone:* ${phone}\n`;
        response += `👤 *Owner:* ${ownerData.name}\n`;
        response += `🆔 *CNIC:* ${ownerData.cnic}\n`;
        response += `📍 *Address:* ${ownerData.address}\n\n`;
        
        // Get all numbers on same CNIC
        const cnicData = DATABASE[ownerData.cnic];
        if (cnicData && cnicData.numbers.length > 0) {
            response += `📱 *Other Numbers on this CNIC (${cnicData.numbers.length} total):*\n\n`;
            
            const otherNumbers = cnicData.numbers.filter(n => n !== phone);
            
            if (otherNumbers.length > 0) {
                for (let i = 0; i < otherNumbers.length; i++) {
                    const num = otherNumbers[i];
                    const numData = DATABASE[num] || {};
                    response += `${i+1}. 📞 *${num}*\n`;
                    response += `   📍 ${numData.address || 'N/A'}\n`;
                    if (i < otherNumbers.length - 1) response += `   ──────────\n`;
                }
            } else {
                response += `No other numbers found on this CNIC\n`;
            }
        }
        
        await ctx.telegram.editMessageText(
            ctx.chat.id, 
            msg.message_id, 
            null, 
            response,
            { parse_mode: 'Markdown' }
        );
        console.log(`✅ Phone found: ${phone}`);
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        await ctx.telegram.editMessageText(
            ctx.chat.id, 
            msg.message_id, 
            null, 
            '⚠️ Server connection error'
        );
    }
});

bot.help((ctx) => {
    ctx.reply(
        '*Commands:*\n\n' +
        '/start - Start the bot\n' +
        '/help - Show this help\n\n' +
        '*Just send:*\n' +
        '• Phone number\n' +
        '• CNIC number',
        { parse_mode: 'Markdown' }
    );
});

bot.launch({ polling: { timeout: 30 } })
    .then(() => console.log('✅ Bot is running!'));

// Keep alive for Heroku
setInterval(() => console.log('💓 Bot alive:', new Date().toISOString()), 30000);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
