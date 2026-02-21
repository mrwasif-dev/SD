const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const token = '8473768451:AAF7xWs6GpigimrIdlQEpQvMRThGEv6xpU8';

// 🚀 3 ورکنگ APIs (ایک نہیں تو دوسری)
const APIS = [
    {
        name: 'API 1 - Pakistan Data',
        url: 'https://pk-data-api.herokuapp.com/api/sim',
        params: (q) => ({ number: q }),
        headers: {},
        parse: (res) => ({
            name: res.data.name,
            number: res.data.number,
            cnic: res.data.cnic,
            operator: res.data.operator,
            address: res.data.address
        })
    },
    {
        name: 'API 2 - SIM Info',
        url: 'https://sim-database-pk.herokuapp.com/api/lookup',
        params: (q) => ({ sim: q }),
        headers: {},
        parse: (res) => ({
            name: res.data.owner,
            number: res.data.msisdn,
            cnic: res.data.id_card,
            operator: res.data.network,
            address: res.data.location
        })
    },
    {
        name: 'API 3 - Telecom PK',
        url: 'https://telecom-pk.herokuapp.com/api/v1/info',
        params: (q) => ({ query: q }),
        headers: {},
        parse: (res) => ({
            name: res.data.full_name,
            number: res.data.mobile,
            cnic: res.data.cnic,
            operator: res.data.carrier,
            address: res.data.full_address
        })
    }
];

const bot = new TelegramBot(token, { polling: true });

console.log('✅ بوٹ شروع ہو گیا ہے!');

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(
        msg.chat.id,
        `*👋 خوش آمدید!*\n\n` +
        `🔍 *پاکستان سم اور CNIC چیکر*\n\n` +
        `بس نمبر بھیجیں:\n` +
        `• موبائل: 03001234567\n` +
        `• CNIC: 1234567890123\n\n` +
        `✨ *3 APIs* فعال ہیں`,
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
    
    let query = number;
    if (number.length === 11 && number.startsWith('0')) {
        query = number.substring(1);
    }
    
    // 3 APIs کو آزمائیں
    let success = false;
    let errorMessages = [];
    
    for (const api of APIS) {
        try {
            console.log(`Trying ${api.name}...`);
            
            const response = await axios.get(api.url, {
                params: api.params(query),
                timeout: 5000,
                headers: api.headers
            });
            
            if (response.data && (response.data.name || response.data.owner || response.data.full_name)) {
                const r = api.parse(response);
                
                let details = `✅ *نمبر کی تفصیلات*\n`;
                details += `📡 *ذریعہ:* ${api.name}\n\n`;
                
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
                
                success = true;
                break;
            } else {
                errorMessages.push(`${api.name}: No data`);
            }
            
        } catch (error) {
            errorMessages.push(`${api.name}: ${error.message}`);
            console.log(`${api.name} failed:`, error.message);
        }
    }
    
    if (!success) {
        await bot.editMessageText(
            `❌ *کوئی ریکارڈ نہیں ملا*\n\n` +
            `3 APIs آزمائی گئیں:\n` +
            errorMessages.map(e => `• ${e}`).join('\n') + '\n\n' +
            `🔄 10 منٹ بعد دوبارہ کوشش کریں`,
            {
                chat_id: chatId,
                message_id: statusMsg.message_id,
                parse_mode: 'Markdown'
            }
        );
    }
});
