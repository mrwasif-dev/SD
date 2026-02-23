const TelegramBot = require('node-telegram-bot-api');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || 'YOUR_TOKEN';
const SESSION_DIR = path.join(__dirname, 'session');

if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR);

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

const whatsapp = new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

let userStates = {};

// WhatsApp Events
whatsapp.on('ready', () => {
    console.log('✅ WhatsApp Connected!');
    Object.keys(userStates).forEach(chatId => {
        if (userStates[chatId]?.waiting) {
            bot.sendMessage(chatId, '✅ *WhatsApp Connected!*\nSend videos now.');
            delete userStates[chatId];
        }
    });
});

// Telegram Commands
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 
        '*🤖 WhatsApp Bot*\n\n/pair - Connect WhatsApp\n/status - Check status\n\nSend any video!');
});

bot.onText(/\/pair/, (msg) => {
    userStates[msg.chat.id] = { step: 'waiting_number' };
    bot.sendMessage(msg.chat.id, '📱 Send your number (e.g., 923001234567):');
});

bot.onText(/\/status/, (msg) => {
    const connected = whatsapp.info?.wid ? '✅ Connected' : '❌ Not Connected';
    bot.sendMessage(msg.chat.id, `*Status:* ${connected}`);
});

// Handle messages
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    if (text?.startsWith('/')) return;
    
    // Handle number input
    if (userStates[chatId]?.step === 'waiting_number') {
        const number = text.replace(/[^0-9]/g, '');
        if (number.length < 10) {
            return bot.sendMessage(chatId, '❌ Invalid number. Try again:');
        }
        
        userStates[chatId] = { step: 'waiting_code', number };
        bot.sendMessage(chatId, '⏳ Generating code...');
        
        try {
            const code = await whatsapp.requestPairingCode(number);
            bot.sendMessage(chatId, 
                `🔐 *Your Code:* \`${code}\`\n\n` +
                `1️⃣ WhatsApp → ⋮ → Linked Devices\n` +
                `2️⃣ "Link with phone number instead"\n` +
                `3️⃣ Enter: *${code}*`);
            
            setTimeout(() => {
                if (userStates[chatId]) delete userStates[chatId];
            }, 300000);
        } catch (err) {
            bot.sendMessage(chatId, `❌ Error: ${err.message}`);
            delete userStates[chatId];
        }
    }
});

// Handle videos
bot.on('video', async (msg) => {
    const chatId = msg.chat.id;
    
    if (!whatsapp.info?.wid) {
        return bot.sendMessage(chatId, '❌ Use /pair first');
    }
    
    try {
        const status = await bot.sendMessage(chatId, '⏳ Downloading...');
        
        const video = msg.video;
        if (video.file_size > 64 * 1024 * 1024) {
            return bot.editMessageText('❌ Too large (max 64MB)', {
                chat_id: chatId, message_id: status.message_id
            });
        }
        
        const file = await bot.getFile(video.file_id);
        const url = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;
        const filePath = `/tmp/video_${Date.now()}.mp4`;
        
        const response = await axios({ url, method: 'GET', responseType: 'stream' });
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);
        
        writer.on('finish', async () => {
            await bot.editMessageText('⏳ Sending to WhatsApp...', {
                chat_id: chatId, message_id: status.message_id
            });
            
            const media = MessageMedia.fromFilePath(filePath);
            await whatsapp.sendMessage(whatsapp.info.wid.user + '@c.us', media);
            
            await bot.editMessageText('✅ Done!', {
                chat_id: chatId, message_id: status.message_id
            });
            
            fs.unlinkSync(filePath);
        });
    } catch (err) {
        bot.sendMessage(chatId, `❌ Error: ${err.message}`);
    }
});

// Start
console.log('🤖 Starting...');
whatsapp.initialize();
console.log('✅ Bot Ready!');
