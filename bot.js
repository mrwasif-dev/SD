const { Telegraf } = require('telegraf');
const axios = require('axios');

// اپنا Bot Token یہاں لگائیں
const BOT_TOKEN = '7252431272:AAEQO4xNHo3UE98vWoy5qH_7_6oKrdGkqTk';
const bot = new Telegraf(BOT_TOKEN);

// API URL
const API_URL = 'https://arslan-apis.vercel.app/more/database';

// اسٹارٹ کمانڈ
bot.start((ctx) => {
    const user = ctx.from.first_name || 'صارف';
    ctx.reply(
        `👋 سلام ${user}!\n\n` +
        `🔍 **پاکستان سم ڈیٹا بیس بوٹ**\n\n` +
        `📱 نمبر لکھیں (بغیر 0 کے)\n` +
        `مثال: \`3001234567\``
    );
});

// نمبر سرچ کریں
bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    
    // کمانڈز کو ignore کریں
    if (text.startsWith('/')) return;
    
    // صرف نمبر رکھیں
    const number = text.replace(/\D/g, '');
    
    if (!number) {
        ctx.reply('❌ براہ کرم نمبر لکھیں');
        return;
    }
    
    if (number.length < 10 || number.length > 12) {
        ctx.reply(`❌ غلط نمبر! 10-12 ہندسے ہونے چاہئیں`);
        return;
    }
    
    if (number.startsWith('0')) {
        ctx.reply('❌ نمبر 0 سے شروع نہ کریں۔ مثال: 3001234567');
        return;
    }
    
    // تلاش شروع کریں
    const msg = await ctx.reply(`🔍 نمبر ${number} تلاش کیا جا رہا ہے...`);
    
    try {
        // API کال
        const res = await axios.get(`${API_URL}?number=${number}`);
        const data = res.data;
        
        if (!data.status || !data.result || data.result.length === 0) {
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                msg.message_id,
                null,
                `❌ نمبر ${number} کے لیے کوئی ڈیٹا نہیں ملا`
            );
            return;
        }
        
        // نتیجہ دکھائیں
        let result = `✅ **نمبر:** ${number}\n`;
        result += `📊 **کل ریکارڈ:** ${data.result.length}\n\n`;
        
        data.result.forEach((item, i) => {
            result += `*${i + 1}. ${item.full_name || 'نام نامعلوم'}*\n`;
            result += `📞 فون: ${item.phone || 'N/A'}\n`;
            result += `🆔 CNIC: ${item.cnic || 'N/A'}\n`;
            result += `📍 پتہ: ${item.address || 'N/A'}\n`;
            if (i < data.result.length - 1) result += `──────────\n`;
        });
        
        await ctx.telegram.editMessageText(
            ctx.chat.id,
            msg.message_id,
            null,
            result,
            { parse_mode: 'Markdown' }
        );
        
    } catch (error) {
        await ctx.telegram.editMessageText(
            ctx.chat.id,
            msg.message_id,
            null,
            `⚠️ سرور کنکشن میں مسئلہ۔ تھوڑی دیر بعد کوشش کریں`
        );
    }
});

// ہیلپ کمانڈ
bot.help((ctx) => {
    ctx.reply(
        '📌 **مدد**\n\n' +
        '• نمبر بغیر 0 کے لکھیں\n' +
        '• صرف پاکستانی نمبر\n' +
        '• مثال: 3001234567'
    );
});

// بوٹ چلائیں
bot.launch()
    .then(() => console.log('✅ بوٹ چل رہا ہے'))
    .catch(err => console.log('❌ خرابی:', err));

// گرہنتی ہینڈلنگ
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
