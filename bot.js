const { Telegraf } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf('8473768451:AAF7xWs6GpigimrIdlQEpQvMRThGEv6xpU8');

// یہی API جو HTML میں ہے
const API_URL = 'https://arslan-apis.vercel.app/more/database';

console.log('🇵🇰 PAKISTAN SIM DATABASE BOT STARTED');

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

bot.start((ctx) => {
    ctx.reply(
        '🇵🇰 *PAKISTAN SIM DATABASE* 🇵🇰\n\n' +
        'Send phone number or CNIC\n\n' +
        '📱 *Phone Examples:*\n' +
        '• 3001234567\n' +
        '• 03001234567\n' +
        '• 923001234567\n\n' +
        '🆔 *CNIC Examples:*\n' +
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
        
        // CNIC API is not available in the HTML
        // So we'll show a message
        await ctx.telegram.editMessageText(
            ctx.chat.id,
            msg.message_id,
            null,
            `🆔 *CNIC:* ${cnic}\n\n⚠️ CNIC database is not available. Only phone numbers are supported.`,
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    // Handle as phone number
    const phone = formatPhone(text);
    if (!phone) {
        return ctx.reply(
            '❌ *Invalid format*\n\n' +
            'Send:\n' +
            '📱 Phone: 3001234567\n' +
            '🆔 CNIC: 42101-1234567-8',
            { parse_mode: 'Markdown' }
        );
    }
    
    console.log(`🔍 Searching Phone: ${phone}`);
    const msg = await ctx.reply(`📱 Searching *${phone}*...`, { parse_mode: 'Markdown' });
    
    try {
        // Using the same API from HTML
        const response = await axios.get(`${API_URL}?number=${phone}`, {
            timeout: 10000
        });
        
        const data = response.data;
        
        if (!data.status || !data.result || data.result.length === 0) {
            return ctx.telegram.editMessageText(
                ctx.chat.id,
                msg.message_id,
                null,
                `❌ No data found for number *${phone}*`,
                { parse_mode: 'Markdown' }
            );
        }
        
        // Display results exactly like the HTML page
        let resultText = `✅ *Results for ${phone}*\n`;
        resultText += `📊 *Total Records:* ${data.result.length}\n\n`;
        
        data.result.forEach((item, index) => {
            resultText += `*${index + 1}. ${item.full_name || 'UNKNOWN'}*\n`;
            resultText += `📞 Phone: ${item.phone || 'N/A'}\n`;
            resultText += `🆔 CNIC: ${item.cnic || 'N/A'}\n`;
            resultText += `📍 Address: ${item.address || 'N/A'}\n`;
            if (index < data.result.length - 1) resultText += `──────────\n`;
        });
        
        await ctx.telegram.editMessageText(
            ctx.chat.id,
            msg.message_id,
            null,
            resultText,
            { parse_mode: 'Markdown' }
        );
        
        console.log(`✅ Success: ${phone} - ${data.result.length} records`);
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        
        // Mock data for testing (same as HTML)
        if (['3336678955', '3105551234', '4155557890', '923001234567'].includes(phone)) {
            const mockData = getMockData(phone);
            let resultText = `✅ *Results for ${phone} (MOCK)*\n`;
            resultText += `📊 *Total Records:* ${mockData.length}\n\n`;
            
            mockData.forEach((item, index) => {
                resultText += `*${index + 1}. ${item.full_name}*\n`;
                resultText += `📞 Phone: ${item.phone}\n`;
                resultText += `🆔 CNIC: ${item.cnic}\n`;
                resultText += `📍 Address: ${item.address}\n`;
                if (index < mockData.length - 1) resultText += `──────────\n`;
            });
            
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                msg.message_id,
                null,
                resultText,
                { parse_mode: 'Markdown' }
            );
        } else {
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                msg.message_id,
                null,
                '⚠️ Connection error. Please try again.',
                { parse_mode: 'Markdown' }
            );
        }
    }
});

// Mock data function (same as HTML)
function getMockData(number) {
    const mockDB = {
        '3336678955': [
            {
                full_name: 'John Alexander',
                phone: '3336678955',
                cnic: '42101-1234567-8',
                address: 'Lahore, Pakistan'
            },
            {
                full_name: 'John A. Smith',
                phone: '3336678955',
                cnic: '42101-9876543-2',
                address: 'Karachi, Pakistan'
            }
        ],
        '3105551234': [
            {
                full_name: 'Sarah Johnson',
                phone: '3105551234',
                cnic: '35202-4567890-1',
                address: 'Islamabad, Pakistan'
            }
        ],
        '4155557890': [
            {
                full_name: 'Michael Williams',
                phone: '4155557890',
                cnic: '37303-5678901-2',
                address: 'Faisalabad, Pakistan'
            },
            {
                full_name: 'Mike Williams',
                phone: '4155557890',
                cnic: '37303-8765432-1',
                address: 'Rawalpindi, Pakistan'
            }
        ],
        '923001234567': [
            {
                full_name: 'Test User',
                phone: '923001234567',
                cnic: '42101-1122334-5',
                address: 'Pakistan'
            }
        ]
    };
    
    return mockDB[number] || [];
}

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

setInterval(() => console.log('💓 Bot alive:', new Date().toISOString()), 30000);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
