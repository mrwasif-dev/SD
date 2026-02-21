const { Telegraf } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf('8473768451:AAF7xWs6GpigimrIdlQEpQvMRThGEv6xpU8');

console.log('🇵🇰 E3-HACKER PAKISTAN SIM DATABASE BOT');

// پاکستانی نمبر نارملائز کرنے کا فنکشن
function formatPakistaniNumber(input) {
    // تمام غیر عددی حروف ہٹائیں
    let num = input.replace(/\D/g, '');
    
    if (!num) return null;
    
    // کیس 1: 03001234567 (11 digits with 0)
    if (num.startsWith('03') && num.length === 11) {
        return num.substring(1); // 3001234567
    }
    
    // کیس 2: 3001234567 (10 digits without 0)
    if (num.startsWith('3') && num.length === 10) {
        return num;
    }
    
    // کیس 3: 923001234567 (12 digits with 92)
    if (num.startsWith('92') && num.length === 12) {
        return num.substring(2); // 3001234567
    }
    
    // کیس 4: +923001234567 (13 digits with +)
    if (num.startsWith('92') && num.length === 12) {
        return num.substring(2);
    }
    
    // کیس 5: 00923001234567 (14 digits with 00)
    if (num.startsWith('0092') && num.length === 14) {
        return num.substring(4); // 3001234567
    }
    
    // اگر کوئی اور فارمیٹ ہے تو null return
    return null;
}

bot.start((ctx) => {
    ctx.reply(
        '🇵🇰 **پاکستان سم ڈیٹا بیس** 🇵🇰\n\n' +
        '📱 **موبائل نمبر لکھیں**\n\n' +
        '✅ **قبول شدہ فارمیٹس:**\n' +
        '• 3001234567\n' +
        '• 03001234567\n' +
        '• 923001234567\n' +
        '• +923001234567\n' +
        '• 00923001234567\n\n' +
        '⚠️ **صرف پاکستانی نمبر**'
    );
});

bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith('/')) return;
    
    // نمبر کو نارملائز کریں
    const normalized = formatPakistaniNumber(text);
    
    if (!normalized) {
        return ctx.reply(
            '❌ **غلط نمبر فارمیٹ**\n\n' +
            'صرف پاکستانی نمبر درج کریں:\n' +
            '✅ 3001234567\n' +
            '✅ 03001234567\n' +
            '✅ 923001234567\n' +
            '✅ +923001234567\n' +
            '✅ 00923001234567'
        );
    }
    
    console.log(`🔍 تلاش: ${text} -> ${normalized}`);
    const msg = await ctx.reply(`🔍 ${normalized} تلاش ہو رہا ہے...`);
    
    try {
        const res = await axios.get(`https://arslan-apis.vercel.app/more/database?number=${normalized}`, {
            timeout: 10000
        });
        
        if (!res.data.status || !res.data.result?.length) {
            return ctx.telegram.editMessageText(
                ctx.chat.id, 
                msg.message_id, 
                null, 
                `❌ **${normalized}** کے لیے کوئی ڈیٹا نہیں ملا`
            );
        }
        
        let response = `✅ **نمبر:** ${normalized}\n`;
        response += `📊 **کل ریکارڈز:** ${res.data.result.length}\n\n`;
        
        res.data.result.forEach((item, i) => {
            response += `*${i+1}. ${item.full_name || 'نام نامعلوم'}*\n`;
            response += `📞 ${item.phone || 'N/A'}\n`;
            response += `🆔 ${item.cnic || 'N/A'}\n`;
            response += `📍 ${item.address || 'N/A'}\n`;
            if (i < res.data.result.length - 1) response += `──────────\n`;
        });
        
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, response);
        console.log(`✅ کامیاب: ${normalized}`);
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        await ctx.telegram.editMessageText(
            ctx.chat.id, 
            msg.message_id, 
            null, 
            '⚠️ **سرور کنکشن میں مسئلہ**\nبراہ کرم تھوڑی دیر بعد کوشش کریں'
        );
    }
});

bot.help((ctx) => {
    ctx.reply(
        '📌 **رہنمائی**\n\n' +
        '🇵🇰 **پاکستانی نمبر فارمیٹس:**\n' +
        '• 3001234567\n' +
        '• 03001234567\n' +
        '• 923001234567\n' +
        '• +923001234567\n' +
        '• 00923001234567\n\n' +
        '⚠️ **نوٹ:** صرف پاکستانی نمبرز'
    );
});

// بوٹ اسٹارٹ
bot.launch({
    polling: {
        timeout: 30
    }
}).then(() => {
    console.log('✅ بوٹ چل رہا ہے!');
    console.log('🤖 Username: @' + bot.botInfo?.username);
}).catch(err => {
    console.log('❌ خرابی:', err.message);
});

// Heroku زندہ رکھیں
setInterval(() => {
    console.log('💓 بوٹ زندہ ہے:', new Date().toISOString());
}, 30000);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
