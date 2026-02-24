const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const { MongoClient } = require('mongodb');
const fs = require('fs');

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
        
        // Load saved session
        await loadSession();
    } catch (error) {
        console.log('❌ MongoDB Error:', error.message);
    }
}

// Load Session from MongoDB
async function loadSession() {
    try {
        const savedSession = await db.collection('sessions').findOne({ userId: 'master' });
        
        if (savedSession) {
            console.log('📂 Loading WhatsApp session...');
            
            const { state, saveCreds } = await useMultiFileAuthState('auth_info');
            
            // Restore session
            if (savedSession.session) {
                state.creds = JSON.parse(savedSession.session);
            }
            
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
                        { $set: { session: creds, lastActive: new Date() } },
                        { upsert: true }
                    );
                    console.log('💾 Session saved');
                } catch (err) {
                    console.log('Save error:', err.message);
                }
            });

            sock.ev.on('connection.update', (update) => {
                const { connection, lastDisconnect } = update;
                
                if (connection === 'open') {
                    console.log('✅ WhatsApp Connected!');
                }
                
                if (connection === 'close') {
                    console.log('❌ WhatsApp Disconnected');
                }
            });

            console.log('✅ Session loaded');
        } else {
            console.log('⚠️ No session found');
        }
    } catch (error) {
        console.log('❌ Load error:', error.message);
    }
}

// /pair command
bot.onText(/\/pair (.+)/, async (msg, match) => {
    const phoneNumber = match[1].replace(/[^0-9]/g, '');
    const chatId = msg.chat.id;
    
    try {
        await bot.sendMessage(chatId, '⏳ Generating pairing code...');
        
        const { state, saveCreds } = await useMultiFileAuthState('auth_info');
        
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
                    { $set: { session: creds, phoneNumber: phoneNumber, createdAt: new Date() } },
                    { upsert: true }
                );
            } catch (err) {}
        });

        // Generate pairing code
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phoneNumber);
                await bot.sendMessage(chatId, 
                    `🔢 *Your Pairing Code:* \`${code}\`\n\n` +
                    `1. Open WhatsApp on phone\n` +
                    `2. Menu → Linked Devices\n` +
                    `3. Tap "Link with phone number"\n` +
                    `4. Enter this 8-digit code`
                );
            } catch (err) {
                bot.sendMessage(chatId, '❌ Failed to generate code');
            }
        }, 3000);

        // Connection update
        sock.ev.on('connection.update', (update) => {
            const { connection } = update;
            if (connection === 'open') {
                bot.sendMessage(chatId, '✅ *WhatsApp Connected!*\nNow send any video/photo');
            }
        });

    } catch (error) {
        bot.sendMessage(chatId, '❌ Error: ' + error.message);
    }
});

// Handle media messages
bot.on('message', async (msg) => {
    if (!sock) return;
    
    try {
        if (msg.video || msg.photo) {
            const caption = msg.caption || '';
            const chatId = msg.chat.id;
            
            await bot.sendMessage(chatId, '⏳ Sending to WhatsApp...');
            
            // Get file
            const fileId = msg.video ? msg.video.file_id : msg.photo.pop().file_id;
            const fileLink = await bot.getFileLink(fileId);
            
            // Download file
            const response = await axios.get(fileLink, { 
                responseType: 'arraybuffer',
                timeout: 30000
            });
            
            // Send to WhatsApp
            await sock.sendMessage(targetNumber + '@s.whatsapp.net', {
                [msg.video ? 'video' : 'image']: Buffer.from(response.data),
                caption: caption,
                mimetype: msg.video ? 'video/mp4' : 'image/jpeg'
            });
            
            await bot.sendMessage(chatId, '✅ *Sent to WhatsApp!*');
        }
    } catch (error) {
        console.log('Media error:', error.message);
    }
});

// Web server
app.get('/', (req, res) => {
    res.send('🤖 Bot is running!');
});

// Start everything
connectDB();
app.listen(port, () => {
    console.log(`🚀 Server on port ${port}`);
});
