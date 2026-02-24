// ✅ سب سے پہلے crypto import کریں
const crypto = require('crypto');
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

// /pair command - FINAL FIXED VERSION
bot.onText(/\/pair (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    let phoneNumber = match[1].replace(/\D/g, '');
    
    // Format number
    if (phoneNumber.startsWith('0')) {
        phoneNumber = phoneNumber.substring(1);
    }
    if (!phoneNumber.startsWith('92')) {
        phoneNumber = '92' + phoneNumber;
    }
    
    await bot.sendMessage(chatId, `🔄 *Generating pairing code for +${phoneNumber}...*`, { parse_mode: 'Markdown' });
    
    try {
        // ✅ FIX: Proper auth state
        const { state, saveCreds } = await useMultiFileAuthState(`auth_${Date.now()}`);
        
        // ✅ Create socket
        const pairingSock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            browser: ['Chrome', 'Linux', ''],
            logger: pino({ level: 'silent' })
        });

        // ✅ Wait and generate code
        setTimeout(async () => {
            try {
                // ✅ Request pairing code
                const pairingCode = await pairingSock.requestPairingCode(phoneNumber);
                
                if (pairingCode) {
                    const formattedCode = pairingCode.match(/.{1,4}/g)?.join('-') || pairingCode;
                    
                    await bot.sendMessage(chatId, 
                        `✅ *SUCCESS!*\n\n` +
                        `🔢 *Code:* \`${formattedCode}\`\n` +
                        `📱 *Phone:* +${phoneNumber}\n\n` +
                        `*Steps:*\n` +
                        `1. Open WhatsApp > Menu > Linked Devices\n` +
                        `2. Tap "Link with phone number"\n` +
                        `3. Enter code: *${formattedCode}*`,
                        { parse_mode: 'Markdown' }
                    );
                    
                    sock = pairingSock;
                    
                    // Save session
                    pairingSock.ev.on('creds.update', async () => {
                        try {
                            const creds = JSON.stringify(state.creds);
                            await db?.collection('sessions')?.updateOne(
                                { userId: 'master' },
                                { $set: { session: creds, phoneNumber: phoneNumber } },
                                { upsert: true }
                            );
                        } catch (err) {}
                    });
                    
                    // Connection success
                    pairingSock.ev.on('connection.update', (update) => {
                        const { connection } = update;
                        if (connection === 'open') {
                            bot.sendMessage(chatId, 
                                '✅ *WhatsApp Connected!*\n\nNow send videos/photos!',
                                { parse_mode: 'Markdown' }
                            );
                        }
                    });
                    
                }
            } catch (error) {
                console.log('Pairing error:', error);
                await bot.sendMessage(chatId, 
                    `❌ *Error:* ${error.message}\n\n` +
                    `Try: /pair 92XXXXXXXXXX`,
                    { parse_mode: 'Markdown' }
                );
            }
        }, 3000);
        
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
            await bot.sendMessage(chatId, '⏳ *Sending...*', { parse_mode: 'Markdown' });
            
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
            
            await bot.sendMessage(chatId, '✅ *Sent!*', { parse_mode: 'Markdown' });
            
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
