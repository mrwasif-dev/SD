const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const { MongoClient } = require('mongodb');
const pino = require('pino');

const app = express();
const port = process.env.PORT || 5000;

// Environment Variables
const telegramToken = process.env.TELEGRAM_TOKEN;
const targetNumber = process.env.TARGET_NUMBER;
const mongoUrl = process.env.MONGODB_URL;

let bot;
let sock = null;
let db = null;

// Initialize Telegram Bot
bot = new TelegramBot(telegramToken, { polling: true });
console.log('✅ Telegram Bot Started');

// Connect to MongoDB
async function connectDB() {
    try {
        const client = new MongoClient(mongoUrl);
        await client.connect();
        db = client.db('whatsapp_bot');
        console.log('✅ MongoDB Connected');
        await loadSession();
    } catch (error) {
        console.log('❌ MongoDB Error:', error.message);
    }
}

// Load Session
async function loadSession() {
    try {
        const savedSession = await db?.collection('sessions')?.findOne({ userId: 'master' });
        
        if (savedSession?.session) {
            console.log('📂 Loading WhatsApp session...');
            
            const { state } = await useMultiFileAuthState('auth_info');
            state.creds = JSON.parse(savedSession.session);
            
            sock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                browser: ['Chrome', 'Linux', ''],
                logger: pino({ level: 'silent' })
            });

            sock.ev.on('creds.update', async () => {
                try {
                    const creds = JSON.stringify(state.creds);
                    await db?.collection('sessions')?.updateOne(
                        { userId: 'master' },
                        { $set: { session: creds, lastActive: new Date() } }
                    );
                } catch (err) {}
            });

            console.log('✅ Session loaded');
        }
    } catch (error) {
        console.log('❌ Load error:', error.message);
    }
}

// /start command
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 
        `👋 *Welcome to WhatsApp Bot!*\n\n` +
        `*Commands:*\n` +
        `🔹 /pair 923001234567 - Connect WhatsApp\n` +
        `🔹 Send video/photo - Forward to WhatsApp\n\n` +
        `_Made with ❤️_`,
        { parse_mode: 'Markdown' }
    );
});

// /pair command - FIXED VERSION
bot.onText(/\/pair (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    let phoneNumber = match[1].replace(/\D/g, ''); // Remove non-digits
    
    // Format phone number (remove leading 0 if any)
    if (phoneNumber.startsWith('0')) {
        phoneNumber = phoneNumber.substring(1);
    }
    
    // Add country code if missing (default 92 for Pakistan)
    if (!phoneNumber.startsWith('92')) {
        phoneNumber = '92' + phoneNumber;
    }
    
    await bot.sendMessage(chatId, `🔄 *Generating pairing code for +${phoneNumber}...*`, { parse_mode: 'Markdown' });
    
    try {
        // Create new auth state
        const { state, saveCreds } = await useMultiFileAuthState(`auth_${Date.now()}`);
        
        // Create socket
        const pairingSock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            browser: ['Chrome', 'Linux', ''],
            logger: pino({ level: 'silent' })
        });

        // Wait for socket to be ready
        setTimeout(async () => {
            try {
                // Request pairing code
                const pairingCode = await pairingSock.requestPairingCode(phoneNumber);
                
                if (pairingCode) {
                    // Format code nicely
                    const formattedCode = pairingCode.match(/.{1,4}/g)?.join('-') || pairingCode;
                    
                    await bot.sendMessage(chatId, 
                        `✅ *Pairing Code Generated!*\n\n` +
                        `📱 *Phone:* +${phoneNumber}\n` +
                        `🔢 *Code:* \`${formattedCode}\`\n\n` +
                        `*How to connect:*\n` +
                        `1️⃣ Open WhatsApp on your phone\n` +
                        `2️⃣ Tap Menu (⋮) → Linked Devices\n` +
                        `3️⃣ Tap "Link with phone number"\n` +
                        `4️⃣ Enter this code: *${formattedCode}*\n\n` +
                        `_Code expires in 5 minutes_`,
                        { parse_mode: 'Markdown' }
                    );
                    
                    // Save socket for later use
                    sock = pairingSock;
                    
                    // Save session to MongoDB when connected
                    pairingSock.ev.on('creds.update', async () => {
                        try {
                            const creds = JSON.stringify(state.creds);
                            await db?.collection('sessions')?.updateOne(
                                { userId: 'master' },
                                { $set: { session: creds, phoneNumber: phoneNumber } },
                                { upsert: true }
                            );
                            console.log('💾 Session saved to MongoDB');
                        } catch (err) {}
                    });
                    
                    // Notify when connected
                    pairingSock.ev.on('connection.update', (update) => {
                        const { connection } = update;
                        if (connection === 'open') {
                            bot.sendMessage(chatId, 
                                '✅ *WhatsApp Connected Successfully!*\n\nNow send any video/photo to forward!',
                                { parse_mode: 'Markdown' }
                            );
                        }
                    });
                    
                } else {
                    throw new Error('No code received');
                }
                
            } catch (error) {
                console.log('Pairing error:', error.message);
                await bot.sendMessage(chatId, 
                    `❌ *Failed to generate code*\n\n` +
                    `*Reason:* ${error.message}\n\n` +
                    `*Try:*\n` +
                    `• Check phone number format\n` +
                    `• Use /pair 923001234567\n` +
                    `• Try again in 1 minute`,
                    { parse_mode: 'Markdown' }
                );
            }
        }, 2000);
        
    } catch (error) {
        await bot.sendMessage(chatId, 
            `❌ *Error:* ${error.message}`,
            { parse_mode: 'Markdown' }
        );
    }
});

// Handle media
bot.on('message', async (msg) => {
    if (msg.video || msg.photo) {
        const chatId = msg.chat.id;
        
        if (!sock) {
            return bot.sendMessage(chatId, 
                '❌ *WhatsApp not connected!*\nUse /pair first',
                { parse_mode: 'Markdown' }
            );
        }
        
        try {
            await bot.sendMessage(chatId, '⏳ *Sending to WhatsApp...*', { parse_mode: 'Markdown' });
            
            const caption = msg.caption || '';
            const fileId = msg.video ? msg.video.file_id : msg.photo.pop().file_id;
            const fileLink = await bot.getFileLink(fileId);
            
            const response = await axios.get(fileLink, { 
                responseType: 'arraybuffer',
                timeout: 30000
            });
            
            await sock.sendMessage(targetNumber + '@s.whatsapp.net', {
                [msg.video ? 'video' : 'image']: Buffer.from(response.data),
                caption: caption
            });
            
            await bot.sendMessage(chatId, '✅ *Sent to WhatsApp!*', { parse_mode: 'Markdown' });
            
        } catch (error) {
            await bot.sendMessage(chatId, 
                `❌ *Error:* ${error.message}`,
                { parse_mode: 'Markdown' }
            );
        }
    }
});

// Web server
app.get('/', (req, res) => {
    res.send('🤖 Bot is running!');
});

// Start
connectDB();
app.listen(port, () => {
    console.log(`🚀 Server on port ${port}`);
});
