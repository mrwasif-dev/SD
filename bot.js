const { Telegraf } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf('7252431272:AAEQO4xNHo3UE98vWoy5qH_7_6oKrdGkqTk');

bot.start((ctx) => ctx.reply('📱 نمبر لکھیں (بغیر 0 کے)'));

bot.on('text', async (ctx) => {
    const num = ctx.message.text.replace(/\D/g, '');
    if (!num || num.length < 10) return ctx.reply('❌ غلط نمبر');
    
    try {
        const msg = await ctx.reply(`🔍 تلاش: ${num}`);
        const res = await axios.get(`https://arslan-apis.vercel.app/more/database?number=${num}`);
        
        if (!res.data.result?.length) {
            return ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '❌ نہیں ملا');
        }
        
        let text = `✅ ${num}\n`;
        res.data.result.forEach((d, i) => {
            text += `\n${i+1}. ${d.full_name || '-'}\n📞 ${d.phone || '-'}\n🆔 ${d.cnic || '-'}\n📍 ${d.address || '-'}\n`;
        });
        
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, text);
    } catch {
        ctx.reply('⚠️ مسئلہ ہے');
    }
});

bot.launch();
console.log('✅ بوٹ آن ہے');
