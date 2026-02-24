const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const { MongoClient } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

// Environment Variables
const telegramToken = process.env.TELEGRAM_TOKEN;
const targetNumber = process.env.TARGET_NUMBER;
const mongoUrl = process.env.MONGODB_URL;

let bot;
let sock = null;
let db = null;
let isConnecting = false;

// Initialize Telegram Bot
try {
    bot = new TelegramBot(telegramToken, { polling: true });
    console.log('✅ Telegram Bot Started');
} catch (error) {
    console.log('❌ Telegram Error:', error.message);
}

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

// Load Session from MongoDB
async function loadSession() {
    try {
        const savedSession = await db.collection('sessions').findOne({ userId: 'master' });
        
        if (savedSession && savedSession.session) {
            console.log('📂 Loading WhatsApp session...');
            
            const { state, saveCreds } = await useMultiFileAuthState('auth_info');
            state.creds = JSON.parse(savedSession.session);
            
            sock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                browser: ['Chrome', 'Linux', '']
            });

            // Save session updates
            sock.ev.on('creds.update', async () => {
                try {
                    const creds = JSON.stringify(state.creds);
                    await db.collection('sessions').updateOne(
                        { userId: 'master' },
                        { $set: { session: creds, lastActive: new Date() } }
                    );
                } catch (err) {}
            });

            sock.ev.on('connection.update', (update) => {
                const { connection } = update;
                if (connection === 'open') {
                    console.log('✅ WhatsApp Connected!');
                }
            });

            console.log('✅ Session loaded');
        }
    } catch (error) {
        console.log('❌ Load error:', error.message);
    }
}

// Handle all messages
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    // Ignore empty messages
    if (!text && !msg.video && !msg.photo) return;
    
    try {
        // Reply to /start command
        if (text === '/start') {
            return bot.sendMessage(chatId, 
                `👋 *Welcome to WhatsApp Bot!*\n\n` +
                `*Commands:*\n` +
                `🔹 /pair 923001234567 - Get WhatsApp pairing code\n` +
                `🔹 Send any video/photo - Forward to WhatsApp\n\n` +
                `_Bot is ready to use!_`
            , { parse_mode: 'Markdown' });
        }
        
        // Reply to /pair command
        if (text && text.startsWith('/pair')) {
            if (isConnecting) {
                return bot.sendMessage(chatId, '⏳ Already processing a request...');
            }
            
            const phoneNumber = text.split(' ')[1];
            if (!phoneNumber) {
                return bot.sendMessage(chatId, 
                    '❌ *Please provide phone number*\nExample: `/pair 923001234567`', 
                    { parse_mode: 'Markdown' }
                );
            }
            
            isConnecting = true;
            await bot.sendMessage(chatId, '🔄 *Generating pairing code...*', { parse_mode: 'Markdown' });
            
            try {
                const { state } = await useMultiFileAuthState('auth_info');
                
                sock = makeWASocket({
                    auth: state,
                    printQRInTerminal: false,
                    browser: ['Chrome', 'Linux', '']
                });

                // Save session
                sock.ev.on('creds.update', async () => {
                    try {
                        const creds = JSON.stringify(state.creds);
                        await db.collection('sessions').updateOne(
                            { userId: 'master' },
                            { $set: { session: creds, phoneNumber: phoneNumber } },
                            { upsert: true }
                        );
                    } catch (err) {}
                });

                // Generate pairing code
                setTimeout(async () => {
                    try {
                        const code = await sock.requestPairingCode(phoneNumber);
                        await bot.sendMessage(chatId, 
                            `✅ *Pairing Code Generated!*\n\n` +
                            `🔢 *Code:* \`${code}\`\n\n` +
                            `*Steps:*\n` +
                            `1️⃣ Open WhatsApp on phone\n` +
                            `2️⃣ Menu → Linked Devices\n` +
                            `3️⃣ Tap "Link with phone number"\n` +
                            `4️⃣ Enter this code\n\n` +
                            `_Code expires in 5 minutes_`
                        , { parse_mode: 'Markdown' });
                    } catch (err) {
                        bot.sendMessage(chatId, '❌ *Failed to generate code*', { parse_mode: 'Markdown' });
                    }
                    isConnecting = false;
                }, 2000);

                // Connection success
                sock.ev.on('connection.update', (update) => {
                    const { connection } = update;
                    if (connection === 'open') {
                        bot.sendMessage(chatId, 
                            '✅ *WhatsApp Connected Successfully!*\n\nNow send any video/photo to forward!',
                            { parse_mode: 'Markdown' }
                        );
                    }
                });

            } catch (error) {
                bot.sendMessage(chatId, `❌ *Error:* ${error.message}`, { parse_mode: 'Markdown' });
                isConnecting = false;
            }
            
            return;
        }
        
        // Handle videos/photos
        if (msg.video || msg.photo) {
            if (!sock) {
                return bot.sendMessage(chatId, 
                    '❌ *WhatsApp not connected!*\nUse /pair command first',
                    { parse_mode: 'Markdown' }
                );
            }
            
            await bot.sendMessage(chatId, '⏳ *Processing...*', { parse_mode: 'Markdown' });
            
            try {
                const caption = msg.caption || '';
                const fileId = msg.video ? msg.video.file_id : msg.photo.pop().file_id;
                const fileLink = await bot.getFileLink(fileId);
                
                const response = await axios.get(fileLink, { 
                    responseType: 'arraybuffer',
                    timeout: 30000
                });
                
                await sock.sendMessage(targetNumber + '@s.whatsapp.net', {
                    [msg.video ? 'video' : 'image']: Buffer.from(response.data),
                    caption: caption,
                    mimetype: msg.video ? 'video/mp4' : 'image/jpeg'
                });
                
                await bot.sendMessage(chatId, 
                    '✅ *Sent to WhatsApp successfully!*',
                    { parse_mode: 'Markdown' }
                );
                
            } catch (error) {
                await bot.sendMessage(chatId, 
                    `❌ *Failed to send:* ${error.message}`,
                    { parse_mode: 'Markdown' }
                );
            }
            
            return;
        }
        
        // Reply to any other text
        if (text && !text.startsWith('/')) {
            await bot.sendMessage(chatId, 
                `🤖 *Bot is active!*\n\n` +
                `Use /start to see commands`,
                { parse_mode: 'Markdown' }
            );
        }
        
    } catch (error) {
        console.log('Message error:', error.message);
    }
});

// Web server
app.get('/', (req, res) => {
    res.send('🤖 WhatsApp Bot is running!');
});

// Start everything
connectDB();
app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});
