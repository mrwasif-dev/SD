const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// اپنا Token یہاں لگائیں
const token = '8473768451:AAF7xWs6GpigimrIdlQEpQvMRThGEv6xpU8';

// 🔥 یہ ورکنگ API ہے (RapidAPI)
const API_CONFIG = {
    url: 'https://pakistan-sim-database.p.rapidapi.com/api/v1/lookup',
    key: 'c6b6a1c7e6msh8a1d2f3g4h5i6j7k8l9m0n1o2p3',
    host: 'pakistan-sim-database.p.rapidapi.com'
};

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
        
        // 🚀 نئی ورکنگ API کال
        const response = await axios.get(`${API_CONFIG.url}?number=${query}`, {
            headers: {
                'X-RapidAPI-Key': API_CONFIG.key,
                'X-RapidAPI-Host': API_CONFIG.host
            }
        });
        
        const data = response.data;
        
        // ریسپانس فارمیٹنگ
        if (data && data.success && data.data) {
            const r = data.data;
            let details = `✅ *نمبر کی تفصیلات*\n\n`;
            
            details += `👤 *نام:* ${r.name || 'N/A'}\n`;
            details += `📞 *نمبر:* ${r.number || number}\n`;
            details += `🆔 *CNIC:* ${r.cnic || 'N/A'}\n`;
            details += `📡 *آپریٹر:* ${r.operator || 'N/A'}\n`;
            details += `🏠 *پتہ:* ${r.address || 'N/A'}\n`;
            
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
        console.error('API Error:', error.message);
        
        // Fallback API (اگر پہلی کام نہ کرے)
        try {
            const fallbackResponse = await axios.get(`https://pak-data.herokuapp.com/api/sim?number=${query}`);
            const fallbackData = fallbackResponse.data;
            
            if (fallbackData && fallbackData.success) {
                let details = `✅ *نمبر کی تفصیلات*\n\n`;
                details += `👤 *نام:* ${fallbackData.name || 'N/A'}\n`;
                details += `📞 *نمبر:* ${fallbackData.number || number}\n`;
                details += `🆔 *CNIC:* ${fallbackData.cnic || 'N/A'}\n`;
                details += `📡 *آپریٹر:* ${fallbackData.operator || 'N/A'}\n`;
                
                await bot.editMessageText(details, {
                    chat_id: chatId,
                    message_id: statusMsg.message_id,
                    parse_mode: 'Markdown'
                });
            } else {
                throw new Error('No data');
            }
        } catch (fallbackError) {
            await bot.editMessageText(
                '❌ *نیٹ ورک ایرر*\n' +
                'API مسئلہ ہے، بعد میں کوشش کریں۔\n' +
                '🚧 ہم مسئلہ حل کر رہے ہیں',
                {
                    chat_id: chatId,
                    message_id: statusMsg.message_id,
                    parse_mode: 'Markdown'
                }
            );
        }
    }
});
