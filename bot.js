const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// 🔴 صرف یہ ایک چیز بدلنی ہے - اپنا Token یہاں لگائیں
const token = '8473768451:AAF7xWs6GpigimrIdlQEpQvMRThGEv6xpU8';

// باقی سب یونہی رہنے دیں
const API_KEY = '49d32e2308c704f3fa';
const API_URL = 'https://api.nexoracle.com/details/pak-sim-database';

const bot = new TelegramBot(token, { polling: true });

console.log('✅ بوٹ شروع ہو گیا ہے! Telegram پر @BotFather سے اپنا بوٹ چیک کریں');

// /start کمانڈ
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(
        msg.chat.id,
        `*👋 خوش آمدید!*\n\n` +
        `🔍 *پاکستان سم اور CNIC چیکر*\n\n` +
        `بس نمبر بھیجیں:\n` +
        `• موبائل: 03001234567\n` +
        `• CNIC: 1234567890123\n\n` +
        `📌 *نوٹ:* یہ معلومات صرف تعلیمی مقصد کے لیے ہیں`,
        { parse_mode: 'Markdown' }
    );
});

// /help کمانڈ
bot.onText(/\/help/, (msg) => {
    bot.sendMessage(
        msg.chat.id,
        `*📚 مدد*\n\n` +
        `• 10 یا 11 ہندسوں کا موبائل نمبر\n` +
        `• 13 ہندسوں کا CNIC نمبر\n` +
        `• بغیر کسی ڈیش یا اسپیس کے\n\n` +
        `*مثال:*\n` +
        `03001234567\n` +
        `1234567890123`,
        { parse_mode: 'Markdown' }
    );
});

// میسج ہینڈلر
bot.on('message', async (msg) => {
    // اگر کمانڈ ہو تو ignore کریں
    if (msg.text.startsWith('/')) return;
    
    const chatId = msg.chat.id;
    const number = msg.text.trim();
    
    // نمبر والیڈیشن
    if (!number.match(/^[0-9]{10,13}$/)) {
        return bot.sendMessage(
            chatId, 
            '❌ *غلط نمبر*\nصرف 10-13 ہندسوں کا نمبر درج کریں', 
            { parse_mode: 'Markdown' }
        );
    }
    
    // لوڈنگ میسج
    const statusMsg = await bot.sendMessage(
        chatId, 
        '🔍 *تلاش جاری ہے...*', 
        { parse_mode: 'Markdown' }
    );
    
    try {
        // API کال
        let query = number;
        if (number.length === 11 && number.startsWith('0')) {
            query = number.substring(1);
        }
        
        const response = await axios.get(`${API_URL}?apikey=${API_KEY}&q=${query}`);
        const data = response.data;
        
        // چیک کریں ڈیٹا ہے یا نہیں
        if (data.result === "No SIM or CNIC data found." || 
            data.result === "No SIM data found.") {
            
            await bot.editMessageText(
                '❌ *کوئی ریکارڈ نہیں ملا*\n\nواٹس ایپ چینل جوائن کریں:\nhttps://whatsapp.com/channel/0029Vb5qnK2HbFUyftE5UP1X',
                {
                    chat_id: chatId,
                    message_id: statusMsg.message_id,
                    parse_mode: 'Markdown'
                }
            );
            return;
        }
        
        // ڈیٹا دکھائیں
        if (data.result && typeof data.result === 'object') {
            const r = data.result;
            
            let details = `✅ *نمبر کی تفصیلات*\n\n`;
            
            if (r.name) details += `👤 *نام:* ${r.name}\n`;
            if (r.number) details += `📞 *نمبر:* ${r.number}\n`;
            if (r.cnic) details += `🆔 *CNIC:* ${r.cnic}\n`;
            if (r.operator) details += `📡 *آپریٹر:* ${r.operator}\n`;
            if (r.address) details += `🏠 *پتہ:* ${r.address}\n`;
            
            // اگر array ہو تو
            if (Array.isArray(data.result)) {
                details = `✅ *ملے ${data.result.length} ریکارڈ*\n\n`;
                data.result.forEach((item, index) => {
                    details += `*ریکارڈ ${index + 1}:*\n`;
                    if (item.name) details += `👤 نام: ${item.name}\n`;
                    if (item.number) details += `📞 نمبر: ${item.number}\n`;
                    if (item.cnic) details += `🆔 CNIC: ${item.cnic}\n`;
                    if (item.operator) details += `📡 آپریٹر: ${item.operator}\n`;
                    if (item.address) details += `🏠 پتہ: ${item.address}\n`;
                    details += `\n`;
                });
            }
            
            await bot.editMessageText(details, {
                chat_id: chatId,
                message_id: statusMsg.message_id,
                parse_mode: 'Markdown'
            });
        } else {
            await bot.editMessageText('❌ *کوئی ڈیٹا نہیں ملا*', {
                chat_id: chatId,
                message_id: statusMsg.message_id,
                parse_mode: 'Markdown'
            });
        }
        
    } catch (error) {
        console.error(error);
        await bot.editMessageText(
            '❌ *نیٹ ورک ایرر*\nبراہ کرم بعد میں کوشش کریں یا انتظامیہ سے رابطہ کریں',
            {
                chat_id: chatId,
                message_id: statusMsg.message_id,
                parse_mode: 'Markdown'
            }
        );
    }
});

// بوٹ آن لائن ہے
console.log('🚀 بوٹ تیار ہے!');
