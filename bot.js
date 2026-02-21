const { Telegraf } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf('8473768451:AAF7xWs6GpigimrIdlQEpQvMRThGEv6xpU8');

console.log('🇵🇰 E3-HACKER PAKISTAN DATABASE BOT');

// CNIC چیک
function isCNIC(input) {
    let clean = input.replace(/\D/g, '');
    if (clean.length === 13) return true;
    if (input.includes('-')) {
        let parts = input.split('-');
        if (parts.length === 3 && parts.join('').length === 13) return true;
    }
    return false;
}

// فون نمبر نارملائز
function formatPhone(input) {
    let num = input.replace(/\D/g, '');
    if (!num) return null;
    
    if (num.startsWith('03') && num.length === 11) return num.substring(1);
    if (num.startsWith('3') && num.length === 10) return num;
    if (num.startsWith('92') && num.length === 12) return num.substring(2);
    if (num.startsWith('0092') && num.length === 14) return num.substring(4);
    return null;
}

// CNIC نارملائز
function formatCNIC(input) {
    let clean = input.replace(/\D/g, '');
    if (clean.length === 13) {
        return `${clean.slice(0,5)}-${clean.slice(5,12)}-${clean.slice(12)}`;
    }
    return null;
}

bot.start((ctx) => {
    ctx.reply(
        '🇵🇰 **پاکستان ڈیٹا بیس** 🇵🇰\n\n' +
        '📱 **فون نمبر** یا 🆔 **CNIC** لکھیں\n\n' +
        '📌 **مثال:**\n' +
        '• 3001234567\n' +
        '• 42101-1234567-8'
    );
});

bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith('/')) return;
    
    // 🔍 CNIC چیک
    if (isCNIC(text)) {
        const cnic = formatCNIC(text);
        console.log(`🔍 CNIC تلاش: ${cnic}`);
        
        const msg = await ctx.reply(`🆔 CNIC **${cnic}** تلاش ہو رہا ہے...`);
        
        try {
            // یہاں وہ API لگے گی جو CNIC پر رجسٹرڈ نمبر دیتی ہے
            // فی الحال Mock Data
            await showCNICData(ctx, msg, cnic);
            
        } catch (error) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '⚠️ سرور کنکشن میں مسئلہ');
        }
        return;
    }
    
    // 📱 فون نمبر چیک
    const phone = formatPhone(text);
    if (!phone) {
        return ctx.reply('❌ غلط فارمیٹ');
    }
    
    console.log(`🔍 فون تلاش: ${phone}`);
    const msg = await ctx.reply(`📱 **${phone}** تلاش ہو رہا ہے...`);
    
    try {
        // پہلے نمبر کا ڈیٹا لیتے ہیں
        const res = await axios.get(`https://arslan-apis.vercel.app/more/database?number=${phone}`, {
            timeout: 10000
        });
        
        if (!res.data.status || !res.data.result?.length) {
            return ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ ${phone} کا ڈیٹا نہیں ملا`);
        }
        
        // نمبر کا مالک (پہلا ریکارڈ)
        const owner = res.data.result[0];
        const ownerCNIC = owner.cnic?.replace(/\D/g, '') || '';
        
        let response = `👤 **مالک:** ${owner.full_name || 'نام نامعلوم'}\n`;
        response += `🆔 **CNIC:** ${owner.cnic || 'N/A'}\n`;
        response += `📍 **پتہ:** ${owner.address || 'N/A'}\n\n`;
        
        if (ownerCNIC.length === 13) {
            response += `📱 **اس CNIC پر رجسٹرڈ نمبر:**\n\n`;
            
            // یہاں وہ API لگے گی جو CNIC کے تمام نمبر دیتی ہے
            // فی الحال Mock Data
            const registeredNumbers = getMockNumbersForCNIC(ownerCNIC, phone);
            
            registeredNumbers.forEach((num, i) => {
                response += `${i+1}. 📞 ${num.number}\n`;
                response += `   👤 ${num.name}\n`;
                response += `   📍 ${num.address}\n`;
                if (i < registeredNumbers.length - 1) response += `   ──────────\n`;
            });
        }
        
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, response);
        console.log(`✅ کامیاب: ${phone}`);
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '⚠️ سرور کنکشن میں مسئلہ');
    }
});

// Mock Data فنکشن (جب تک API نہیں ملتی)
function getMockNumbersForCNIC(cnic, currentPhone) {
    const mockDB = {
        '4210112345678': [
            { number: '3001234567', name: 'John Alexander', address: 'Lahore' },
            { number: '3217654321', name: 'John Alexander', address: 'Lahore' },
            { number: '3335557777', name: 'John Alexander', address: 'Lahore' }
        ],
        '3520212345671': [
            { number: '3105551234', name: 'Sarah Johnson', address: 'Islamabad' },
            { number: '3456789012', name: 'Sarah Johnson', address: 'Islamabad' }
        ]
    };
    
    // فلٹر کریں کہ جو نمبر پہلے سے دکھایا وہ دوبارہ نہ دکھے
    let numbers = mockDB[cnic] || [];
    return numbers.filter(n => n.number !== currentPhone);
}

// CNIC ڈیٹا دکھانے کا فنکشن
async function showCNICData(ctx, msg, cnic) {
    // یہاں CNIC API کال ہوگی
    // فی الحال Mock Data
    
    const cleanCNIC = cnic.replace(/\D/g, '');
    const numbers = getMockNumbersForCNIC(cleanCNIC, '');
    
    if (numbers.length === 0) {
        return ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `🆔 ${cnic}\n\n❌ کوئی نمبر رجسٹر نہیں`);
    }
    
    let response = `🆔 **CNIC:** ${cnic}\n`;
    response += `📊 **کل نمبر:** ${numbers.length}\n\n`;
    
    numbers.forEach((num, i) => {
        response += `${i+1}. 📞 ${num.number}\n`;
        response += `   👤 ${num.name}\n`;
        response += `   📍 ${num.address}\n`;
        if (i < numbers.length - 1) response += `   ──────────\n`;
    });
    
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, response);
}

bot.launch({ polling: { timeout: 30 } })
    .then(() => console.log('✅ بوٹ چل رہا ہے!'));

setInterval(() => console.log('💓 زندہ:', new Date().toISOString()), 30000);
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
