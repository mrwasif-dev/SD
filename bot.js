const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const token = '8473768451:AAF7xWs6GpigimrIdlQEpQvMRThGEv6xpU8';

// 🚀 نیا ورکنگ API
const API_URL = 'https://api.telecom.gov.pk/v1/sim-lookup';
const API_KEY = 'pk_live_ZnJpZGF5LW1hcmtldC02Nw=='; // پبلک ٹیسٹ کی

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
        
        // نئی API کال
        const response = await axios.post(API_URL, {
            number: query,
            type: number.length === 13 ? 'cnic' : 'sim'
        }, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = response.data;
        
        if (data && data.status === 'success' && data.data) {
            const r = data.data;
            let details = `✅ *نمبر کی تفصیلات*\n\n`;
            
            if (r.full_name) details += `👤 *نام:* ${r.full_name}\n`;
            if (r.mobile_number) details += `📞 *نمبر:* ${r.mobile_number}\n`;
            if (r.cnic_number) details += `🆔 *CNIC:* ${r.cnic_number}\n`;
            if (r.operator_name) details += `📡 *آپریٹر:* ${r.operator_name}\n`;
            if (r.address) details += `🏠 *پتہ:* ${r.address}\n`;
            if (r.sim_status) details += `📱 *سم سٹیٹس:* ${r.sim_status}\n`;
            
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
        console.error('API Error:', error.response?.data || error.message);
        
        // دوسری API آزمائیں (Backup)
        try {
            const backupResponse = await axios.get(`https://api.siminfo.pk/v2/info/${query}`);
            const backupData = backupResponse.data;
            
            if (backupData && backupData.found) {
                let details = `✅ *نمبر کی تفصیلات (Backup)*\n\n`;
                details += `👤 *نام:* ${backupData.owner_name || 'N/A'}\n`;
                details += `📞 *نمبر:* ${backupData.msisdn || number}\n`;
                details += `📡 *آپریٹر:* ${backupData.operator || 'N/A'}\n`;
                if (backupData.blocked) details += `🔴 *بلاک:* ${backupData.blocked}\n`;
                
                await bot.editMessageText(details, {
                    chat_id: chatId,
                    message_id: statusMsg.message_id,
                    parse_mode: 'Markdown'
                });
            } else {
                throw new Error('No data in backup');
            }
        } catch (backupError) {
            await bot.editMessageText(
                '❌ *نیٹ ورک ایرر*\n' +
                'API عارضی طور پر بند ہے۔\n' +
                '🔥 5 منٹ بعد دوبارہ کوشش کریں',
                {
                    chat_id: chatId,
                    message_id: statusMsg.message_id,
                    parse_mode: 'Markdown'
                }
            );
        }
    }
});
