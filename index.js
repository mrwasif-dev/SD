const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const { MongoClient } = require('mongodb');
const app = express();

// Environment Variables
const telegramToken = process.env.TELEGRAM_TOKEN;
const targetNumber = process.env.TARGET_NUMBER;
const mongoUrl = process.env.MONGODB_URL;

const bot = new TelegramBot(telegramToken, { polling: true });
let sock = null;
let db = null;

// Connect to MongoDB
MongoClient.connect(mongoUrl).then(client => {
  db = client.db('whatsapp_bot');
  console.log('✅ MongoDB connected');
});

// /pair command
bot.onText(/\/pair (.+)/, async (msg, match) => {
  const phoneNumber = match[1];
  const chatId = msg.chat.id;
  
  try {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false
    });

    // Save session to MongoDB
    sock.ev.on('creds.update', async () => {
      const creds = JSON.stringify(state);
      await db.collection('sessions').updateOne(
        { userId: chatId },
        { $set: { session: creds } },
        { upsert: true }
      );
    });

    setTimeout(async () => {
      const code = await sock.requestPairingCode(phoneNumber);
      bot.sendMessage(chatId, `🔢 Your pairing code: ${code}\nEnter this code in WhatsApp > Linked Devices`);
    }, 2000);

    sock.ev.on('connection.update', (update) => {
      const { connection } = update;
      if (connection === 'open') {
        bot.sendMessage(chatId, '✅ WhatsApp connected successfully!');
      }
    });

  } catch (error) {
    bot.sendMessage(chatId, '❌ Error: ' + error.message);
  }
});

// Handle videos/photos
bot.on('message', async (msg) => {
  if ((msg.video || msg.photo) && sock) {
    try {
      const caption = msg.caption || '';
      const fileId = msg.video ? msg.video.file_id : msg.photo.pop().file_id;
      const fileLink = await bot.getFileLink(fileId);
      
      // Download file
      const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
      
      // Send to WhatsApp
      await sock.sendMessage(targetNumber + '@s.whatsapp.net', {
        [msg.video ? 'video' : 'image']: Buffer.from(response.data),
        caption: caption
      });
      
      bot.sendMessage(msg.chat.id, '✅ Sent to WhatsApp!');
    } catch (error) {
      bot.sendMessage(msg.chat.id, '❌ Error: ' + error.message);
    }
  }
});

// Simple status page
app.get('/', (req, res) => res.send('🤖 WhatsApp Bot is running'));
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));
