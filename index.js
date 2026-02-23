const { TelegramBot } = require('telegram-node-bot');
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
    fs.mkdirSync(SESSION_DIR);
}

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

// ============= TELEGRAM BOT =============
const tg = new TelegramBot(TELEGRAM_TOKEN, {
    polling: {
        interval: 1000,
        params: {
            timeout: 10
        }
    }
});

// Store user states
const userStates = {};

// ============= WHATSAPP EVENTS =============
whatsapp.on('qr', (qr) => {
    console.log('QR Code generated (ignored - using pairing code)');
});

whatsapp.on('ready', () => {
    console.log('✅ WhatsApp Connected!');
    
    // Notify all users who were waiting
    Object.keys(userStates).forEach(chatId => {
        if (userStates[chatId].waitingForConnection) {
            tg.api.sendMessage({
                chat_id: chatId,
                text: '✅ *WhatsApp Connected!*\n\nYou can now send videos to forward!'
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
tg.on('text', async (msg) => {
    if (msg.text === '/start') {
        await tg.api.sendMessage({
            chat_id: msg.chat.id,
            text: '*🤖 WhatsApp Video Forwarder Bot*\n\n' +
                  'Commands:\n' +
                  '/pair - *Connect WhatsApp* (Get pairing code)\n' +
                  '/status - Check connection status\n' +
                  '/help - Show help\n\n' +
                  '📹 *How to use:*\n' +
                  '1. First use /pair to connect WhatsApp\n' +
                  '2. Then send any video to forward',
            parse_mode: 'Markdown'
        });
    }
    
    // /help command
    else if (msg.text === '/help') {
        await tg.api.sendMessage({
            chat_id: msg.chat.id,
            text: '*📖 Help Guide*\n\n' +
                  '*Step 1:* Use /pair to connect WhatsApp\n' +
                  '*Step 2:* Enter your phone number (with country code)\n' +
                  '*Step 3:* Enter the 8-digit code in WhatsApp\n' +
                  '*Step 4:* Send videos to forward\n\n' +
                  '*Example number:* 923001234567 (Pakistan)\n' +
                  '*Format:* Country code + number without + or 0',
            parse_mode: 'Markdown'
        });
    }
    
    // /status command
    else if (msg.text === '/status') {
        const isConnected = whatsapp.info?.wid ? true : false;
        const status = isConnected ? '✅ *Connected*' : '❌ *Not Connected*';
        const number = isConnected ? whatsapp.info.wid.user : 'None';
        
        await tg.api.sendMessage({
            chat_id: msg.chat.id,
            text: `📊 *Connection Status*\n\n` +
                  `WhatsApp: ${status}\n` +
                  `Number: ${number}\n` +
                  `Session: ${fs.existsSync(SESSION_DIR) ? '✅ Active' : '❌ None'}`,
            parse_mode: 'Markdown'
        });
    }
    
    // /pair command - Start pairing process
    else if (msg.text === '/pair') {
        userStates[msg.chat.id] = {
            step: 'waiting_for_number'
        };
        
        await tg.api.sendMessage({
            chat_id: msg.chat.id,
            text: '*📱 WhatsApp Pairing*\n\n' +
                  'Please enter your phone number with country code:\n\n' +
                  '*Examples:*\n' +
                  '• Pakistan: `923001234567`\n' +
                  '• India: `919876543210`\n' +
                  '• UAE: `971501234567`\n\n' +
                  '_(Without + or 00)_',
            parse_mode: 'Markdown'
        });
    }
    
    // Handle number input for pairing
    else if (userStates[msg.chat.id] && userStates[msg.chat.id].step === 'waiting_for_number') {
        const phoneNumber = msg.text.replace(/[^0-9]/g, '');
        
        // Validate phone number
        if (phoneNumber.length < 10 || phoneNumber.length > 15) {
            await tg.api.sendMessage({
                chat_id: msg.chat.id,
                text: '❌ *Invalid number*\n\nPlease enter a valid phone number with country code.\nExample: `923001234567`',
                parse_mode: 'Markdown'
            });
            return;
        }
        
        userStates[msg.chat.id] = {
            step: 'generating_code',
            phoneNumber: phoneNumber
        };
        
        await tg.api.sendMessage({
            chat_id: msg.chat.id,
            text: '⏳ *Generating pairing code...*\n\nPlease wait 10-15 seconds...',
            parse_mode: 'Markdown'
        });
        
        try {
            // Request pairing code from WhatsApp
            const pairingCode = await whatsapp.requestPairingCode(phoneNumber);
            
            userStates[msg.chat.id] = {
                step: 'waiting_for_connection',
                phoneNumber: phoneNumber,
                pairingCode: pairingCode
            };
            
            const message = `🔐 *Your 8-Digit Pairing Code*

\`${pairingCode}\`

*📱 Steps to Connect:*

1️⃣ *Open WhatsApp* on your phone
2️⃣ Tap *⋮ Menu* (3 dots)
3️⃣ Select *"Linked Devices"*
4️⃣ Tap *"Link a Device"*
5️⃣ Tap *"Link with phone number instead"*
6️⃣ Enter this code: *${pairingCode}*

⏱️ *Code expires in 5 minutes*

✅ After connecting, you'll get confirmation here!`;
            
            await tg.api.sendMessage({
                chat_id: msg.chat.id,
                text: message,
                parse_mode: 'Markdown'
            });
            
            // Set timeout to clear state after 5 minutes
            setTimeout(() => {
                if (userStates[msg.chat.id] && userStates[msg.chat.id].step === 'waiting_for_connection') {
                    delete userStates[msg.chat.id];
                    tg.api.sendMessage({
                        chat_id: msg.chat.id,
                        text: '⏰ *Code expired*\n\nUse /pair to get a new code.',
                        parse_mode: 'Markdown'
                    }).catch(() => {});
                }
            }, 5 * 60 * 1000);
            
        } catch (error) {
            console.error('Pairing error:', error);
            delete userStates[msg.chat.id];
            
            await tg.api.sendMessage({
                chat_id: msg.chat.id,
                text: `❌ *Error generating code*\n\n${error.message}\n\nPlease try /pair again.`,
                parse_mode: 'Markdown'
            });
        }
    }
    
    // Handle other messages (ignore)
    else {
        // Don't respond to random text
    }
});

// ============= VIDEO HANDLER =============
tg.on('video', async (msg) => {
    try {
        // Check if WhatsApp is connected
        if (!whatsapp.info || !whatsapp.info.wid) {
            await tg.api.sendMessage({
                chat_id: msg.chat.id,
                text: '❌ *WhatsApp not connected*\n\nUse /pair to connect first!',
                parse_mode: 'Markdown'
            });
            return;
        }
        
        // Send initial status
        const statusMsg = await tg.api.sendMessage({
            chat_id: msg.chat.id,
            text: '⏳ *Downloading video...* 0%',
            parse_mode: 'Markdown'
        });
        
        // Get video info
        const videoFile = msg.video;
        const fileId = videoFile.file_id;
        
        // Check file size (max 64MB for WhatsApp)
        if (videoFile.file_size > 64 * 1024 * 1024) {
            await tg.api.editMessageText({
                chat_id: msg.chat.id,
                message_id: statusMsg.message_id,
                text: '❌ *Video too large*\n\nMaximum size: 64MB',
                parse_mode: 'Markdown'
            });
            return;
        }
        
        // Get file URL
        const file = await tg.api.getFile({ file_id: fileId });
        const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;
        
        // Download video to /tmp (Heroku temp storage)
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
        const totalSize = videoFile.file_size;
        
        writer.on('pipe', () => {
            const interval = setInterval(() => {
                if (progress < 90) {
                    progress += 10;
                    tg.api.editMessageText({
                        chat_id: msg.chat.id,
                        message_id: statusMsg.message_id,
                        text: `⏳ *Downloading video...* ${progress}%`,
                        parse_mode: 'Markdown'
                    }).catch(() => {});
                }
            }, 500);
            
            writer.on('finish', () => {
                clearInterval(interval);
            });
        });
        
        writer.on('finish', async () => {
            try {
                await tg.api.editMessageText({
                    chat_id: msg.chat.id,
                    message_id: statusMsg.message_id,
                    text: '⏳ *Sending to WhatsApp...*',
                    parse_mode: 'Markdown'
                });
                
                // Send to WhatsApp
                const media = MessageMedia.fromFilePath(filePath);
                await whatsapp.sendMessage(whatsapp.info.wid.user + '@c.us', media, {
                    caption: `📹 *Video from Telegram*\n\n` +
                            `👤 From: ${msg.from.first_name || ''} ${msg.from.last_name || ''}\n` +
                            `📅 Date: ${new Date().toLocaleString()}`
                });
                
                await tg.api.editMessageText({
                    chat_id: msg.chat.id,
                    message_id: statusMsg.message_id,
                    text: '✅ *Video sent to WhatsApp successfully!*',
                    parse_mode: 'Markdown'
                });
                
                // Clean up
                fs.unlinkSync(filePath);
                
            } catch (error) {
                console.error('Send error:', error);
                await tg.api.editMessageText({
                    chat_id: msg.chat.id,
                    message_id: statusMsg.message_id,
                    text: `❌ *Error sending video*\n\n${error.message}`,
                    parse_mode: 'Markdown'
                });
            }
        });
        
        writer.on('error', async (error) => {
            await tg.api.editMessageText({
                chat_id: msg.chat.id,
                message_id: statusMsg.message_id,
                text: `❌ *Download error*\n\n${error.message}`,
                parse_mode: 'Markdown'
            });
        });
        
    } catch (error) {
        console.error('Video handler error:', error);
        await tg.api.sendMessage({
            chat_id: msg.chat.id,
            text: `❌ *Error*\n\n${error.message}`,
            parse_mode: 'Markdown'
        });
    }
});

// Handle photos (optional)
tg.on('photo', async (msg) => {
    if (whatsapp.info?.wid) {
        await tg.api.sendMessage({
            chat_id: msg.chat.id,
            text: '📸 *Only videos are supported*\n\nSend video files only!',
            parse_mode: 'Markdown'
        });
    }
});

// Handle documents (optional)
tg.on('document', async (msg) => {
    if (whatsapp.info?.wid && msg.document.mime_type?.startsWith('video/')) {
        // Treat as video
        msg.video = msg.document;
        tg.emit('video', msg);
    } else if (whatsapp.info?.wid) {
        await tg.api.sendMessage({
            chat_id: msg.chat.id,
            text: '📄 *Only video files are supported*\n\nSend MP4 videos only!',
            parse_mode: 'Markdown'
        });
    }
});

// ============= START BOT =============
console.log('🤖 Starting WhatsApp client...');
whatsapp.initialize();

console.log('🤖 Telegram bot is running...');
console.log('✅ Bot ready! Send /pair to connect WhatsApp');

// Handle process exit
process.on('SIGINT', async () => {
    console.log('\n📴 Shutting down...');
    try {
        await whatsapp.destroy();
    } catch (e) {}
    process.exit();
});
