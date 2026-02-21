const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const token = '8473768451:AAF7xWs6GpigimrIdlQEpQvMRThGEv6xpU8';

// 🔴 اِن میں سے کوئی ایک API استعمال کریں
const API_CONFIGS = {
    free: {
        url: 'https://api.nexoracle.com/details/pak-sim-database-free',
        key: 'free_key@maher_apis'
    },
    original: {
        url: 'https://api.nexoracle.com/details/pak-sim-database',
        key: '49d32e2308c704f3fa'
    }
};

// فی الحال Free API استعمال کریں
const ACTIVE_API = API_CONFIGS.free;

const bot = new TelegramBot(token, { polling: true });

console.log('✅ بوٹ شروع ہو گیا ہے!');

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(
        msg.chat.id,
        `*👋 خوش آمدید!*\n\n` +
        `🔍 *پاکستان سم اور CNIC چیکر*\n\n` +
        `بس نمبر بھیجیں:\n` +
        `• موبائل: 03001234567\n` +
        `• CNIC: 1234567890123`,
        { parse_mode: 'Markdown' }
    );
});

bot.on('message', async (msg) => {
    if (msg.text.startsWith('/')) return;
    
    const chatId = msg.chat.id;
    const number = msg.text.trim();
    
    if (!number.match(/^[0-9]{10,13}$/)) {
        return bot.sendMessage(chatId, '❌ *صرف نمبر درج کریں*', { parse_mode: 'Markdown' });
    }
    
    const statusMsg = await bot.sendMessage(chatId, '🔍 *تلاش جاری ہے...*', { parse_mode: 'Markdown' });
    
    try {
        let query = number;
        if (number.length === 11 && number.startsWith('0')) {
            query = number.substring(1);
        }
        
        const response = await axios.get(`${ACTIVE_API.url}?apikey=${ACTIVE_API.key}&q=${query}`);
        const data = response.data;
        
        if (data.result && typeof data.result === 'object') {
            const r = data.result;
            let details = `✅ *نمبر کی تفصیلات*\n\n`;
            if (r.name) details += `👤 *نام:* ${r.name}\n`;
            if (r.number) details += `📞 *نمبر:* ${r.number}\n`;
            if (r.cnic) details += `🆔 *CNIC:* ${r.cnic}\n`;
            if (r.operator) details += `📡 *آپریٹر:* ${r.operator}\n`;
            if (r.address) details += `🏠 *پتہ:* ${r.address}\n`;
            
            await bot.editMessageText(details, {
                chat_id: chatId,
                message_id: statusMsg.message_id,
                parse_mode: 'Markdown'
            });
        } else {
            await bot.editMessageText('❌ *کوئی ریکارڈ نہیں ملا*', {
                chat_id: chatId,
                message_id: statusMsg.message_id,
                parse_mode: 'Markdown'
            });
        }
    } catch (error) {
        console.error(error);
        await bot.editMessageText(
            '❌ *نیٹ ورک ایرر*\nAPI مسئلہ ہے، بعد میں کوشش کریں۔',
            {
                chat_id: chatId,
                message_id: statusMsg.message_id,
                parse_mode: 'Markdown'
            }
        );
    }
});
