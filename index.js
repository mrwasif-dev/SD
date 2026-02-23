const TelegramBot = require('node-telegram-bot-api');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ============= CONFIGURATION =============
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '8473768451:AAF7xWs6GpigimrIdlQEpQvMRThGEv6xpU8';
const SESSION_DIR = path.join(__dirname, 'session');

// Create session directory
if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
}

// ============= TELEGRAM BOT =============
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// ============= WHATSAPP CLIENT =============
const whatsapp = new Client({
    authStrategy: new LocalAuth({
        dataPath: SESSION_DIR
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote'
        ]
    }
});

// Store user states
const userStates = {};

// ============= WHATSAPP EVENTS =============
whatsapp.on('qr', (qr) => {
    console.log('QR Code generated (ignored - using pairing code)');
    // Save QR to file as backup
    fs.writeFileSync('/tmp/qr.txt', qr);
});

whatsapp.on('ready', () => {
    console.log('✅ WhatsApp Connected!');
    
    // Notify all users
    Object.keys(userStates).forEach(chatId => {
        if (userStates[chatId]?.waitingForConnection) {
            bot.sendMessage(chatId, '✅ *WhatsApp Connected!*\n\nYou can now send videos!', {
                parse_mode: 'Markdown'
            }).catch(() => {});
            delete userStates[chatId];
        }
    });
});

whatsapp.on('authenticated', () => {
    console.log('✅ WhatsApp Authenticated!');
});

whatsapp.on('auth_failure', (msg) => {
    console.log('❌ Auth Failed:', msg);
});

whatsapp.on('disconnected', (reason) => {
    console.log('❌ WhatsApp Disconnected:', reason);
});

// ============= TELEGRAM COMMANDS =============

// /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 
        '*🤖 WhatsApp Video Forwarder Bot*\n\n' +
        '*Commands:*\n' +
        '/pair - *Connect WhatsApp* (Get 8-digit code)\n' +
        '/status - Check connection status\n' +
        '/help - Show help guide\n\n' +
        '*📹 How to use:*\n' +
        '1. Send /pair to connect WhatsApp\n' +
        '2. Enter your phone number\n' +
        '3. Enter code in WhatsApp\n' +
        '4. Send any video!',
        { parse_mode: 'Markdown' }
    );
});

// /help command
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
        '*📖 Help Guide*\n\n' +
        '*Step 1:* Send /pair\n' +
        '*Step 2:* Enter phone number (e.g., 923001234567)\n' +
        '*Step 3:* Get 8-digit code\n' +
        '*Step 4:* Open WhatsApp → ⋮ → Linked Devices\n' +
        '*Step 5:* Tap "Link with phone number instead"\n' +
        '*Step 6:* Enter the code\n\n' +
        '*Example numbers:*\n' +
        '🇵🇰 Pakistan: `923001234567`\n' +
        '🇮🇳 India: `919876543210`\n' +
        '🇦🇪 UAE: `971501234567`',
        { parse_mode: 'Markdown' }
    );
});

// /status command
bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    const isConnected = whatsapp.info?.wid ? true : false;
    const status = isConnected ? '✅ *Connected*' : '❌ *Not Connected*';
    const number = isConnected ? whatsapp.info.wid.user : 'None';
    
    bot.sendMessage(chatId,
        `📊 *Connection Status*\n\n` +
        `WhatsApp: ${status}\n` +
        `Number: ${number}\n` +
        `Session: ${fs.existsSync(SESSION_DIR) ? '✅ Active' : '❌ None'}`,
        { parse_mode: 'Markdown' }
    );
});

// /pair command
bot.onText(/\/pair/, (msg) => {
    const chatId = msg.chat.id;
    
    userStates[chatId] = {
        step: 'waiting_for_number'
    };
    
    bot.sendMessage(chatId,
        '*📱 WhatsApp Pairing*\n\n' +
        'Please enter your phone number with country code:\n\n' +
        '*Example:* `923001234567`\n' +
        '_(Without + or 00)_',
        { parse_mode: 'Markdown' }
    );
});

// Handle all text messages
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    // Ignore commands
    if (text.startsWith('/')) return;
    
    // Handle pairing number input
    if (userStates[chatId] && userStates[chatId].step === 'waiting_for_number') {
        const phoneNumber = text.replace(/[^0-9]/g, '');
        
        if (phoneNumber.length < 10 || phoneNumber.length > 15) {
            bot.sendMessage(chatId,
                '❌ *Invalid number*\n\nPlease enter a valid phone number.\nExample: `923001234567`',
                { parse_mode: 'Markdown' }
            );
            return;
        }
        
        userStates[chatId] = {
            step: 'generating_code',
            phoneNumber: phoneNumber
        };
        
        bot.sendMessage(chatId,
            '⏳ *Generating 8-digit code...*\n\nPlease wait...',
            { parse_mode: 'Markdown' }
        );
        
        try {
            // Generate pairing code
            const pairingCode = await whatsapp.requestPairingCode(phoneNumber);
            
            userStates[chatId] = {
                step: 'waiting_for_connection',
                phoneNumber: phoneNumber,
                pairingCode: pairingCode
            };
            
            const message = 
                `🔐 *Your 8-Digit Code:* \`${pairingCode}\`\n\n` +
                `*📱 Steps:*\n` +
                `1️⃣ Open WhatsApp on your phone\n` +
                `2️⃣ Tap ⋮ Menu → Linked Devices\n` +
                `3️⃣ Tap "Link a Device"\n` +
                `4️⃣ Tap **"Link with phone number instead"**\n` +
                `5️⃣ Enter this code: *${pairingCode}*\n\n` +
                `⏱️ *Code expires in 5 minutes*`;
            
            bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            
            // Clear state after 5 minutes
            setTimeout(() => {
                if (userStates[chatId]?.step === 'waiting_for_connection') {
                    delete userStates[chatId];
                    bot.sendMessage(chatId,
                        '⏰ *Code expired*\n\nSend /pair to get new code.',
                        { parse_mode: 'Markdown' }
                    ).catch(() => {});
                }
            }, 5 * 60 * 1000);
            
        } catch (error) {
            console.error('Pairing error:', error);
            delete userStates[chatId];
            
            bot.sendMessage(chatId,
                `❌ *Error*\n\n${error.message}\n\nTry /pair again.`,
                { parse_mode: 'Markdown' }
            );
        }
    }
});

// ============= VIDEO HANDLER =============
bot.on('video', async (msg) => {
    const chatId = msg.chat.id;
    
    try {
        // Check WhatsApp connection
        if (!whatsapp.info || !whatsapp.info.wid) {
            bot.sendMessage(chatId,
                '❌ *WhatsApp not connected*\n\nUse /pair first!',
                { parse_mode: 'Markdown' }
            );
            return;
        }
        
        const statusMsg = await bot.sendMessage(chatId,
            '⏳ *Downloading video...* 0%',
            { parse_mode: 'Markdown' }
        );
        
        const video = msg.video;
        const fileId = video.file_id;
        
        // Check file size (64MB max)
        if (video.file_size > 64 * 1024 * 1024) {
            bot.editMessageText(
                '❌ *Video too large*\n\nMax size: 64MB',
                { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown' }
            );
            return;
        }
        
        // Get file URL
        const file = await bot.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;
        
        // Download to /tmp
        const fileName = `video_${Date.now()}.mp4`;
        const filePath = path.join('/tmp', fileName);
        
        const response = await axios({
            method: 'GET',
            url: fileUrl,
            responseType: 'stream'
        });
        
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);
        
        // Update progress
        let progress = 0;
        const interval = setInterval(() => {
            if (progress < 90) {
                progress += 10;
                bot.editMessageText(
                    `⏳ *Downloading...* ${progress}%`,
                    { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown' }
                ).catch(() => {});
            }
        }, 500);
        
        writer.on('finish', async () => {
            clearInterval(interval);
            
            try {
                await bot.editMessageText(
                    '⏳ *Sending to WhatsApp...*',
                    { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown' }
                );
                
                // Send to WhatsApp
                const media = MessageMedia.fromFilePath(filePath);
                await whatsapp.sendMessage(whatsapp.info.wid.user + '@c.us', media, {
                    caption: `📹 *Video from Telegram*\n\nFrom: ${msg.from.first_name || ''}`
                });
                
                await bot.editMessageText(
                    '✅ *Video sent to WhatsApp!*',
                    { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown' }
                );
                
                // Clean up
                fs.unlinkSync(filePath);
                
            } catch (error) {
                console.error('Send error:', error);
                bot.editMessageText(
                    `❌ *Error*\n\n${error.message}`,
                    { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown' }
                );
            }
        });
        
        writer.on('error', (error) => {
            clearInterval(interval);
            bot.editMessageText(
                `❌ *Error*\n\n${error.message}`,
                { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown' }
            );
        });
        
    } catch (error) {
        console.error('Video error:', error);
        bot.sendMessage(chatId,
            `❌ *Error*\n\n${error.message}`,
            { parse_mode: 'Markdown' }
        );
    }
});

// ============= START BOT =============
console.log('🤖 Starting WhatsApp client...');
whatsapp.initialize();

console.log('🤖 Telegram bot is running...');
console.log('✅ Bot ready! Send /pair to connect');

// Handle shutdown
process.on('SIGINT', async () => {
    console.log('\n📴 Shutting down...');
    try {
        await whatsapp.destroy();
    } catch (e) {}
    process.exit();
});
