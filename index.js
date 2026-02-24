 // ✅ CRITICAL FIX FOR HEROKU + BAILEYS
const nodeCrypto = require('crypto');
global.crypto = nodeCrypto;

// Required Libraries
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

/* ---------------- TELEGRAM ---------------- */

try {
    bot = new TelegramBot(telegramToken, { polling: true });
    console.log("✅ Telegram Bot Started");
} catch (err) {
    console.log("❌ Telegram Error:", err.message);
}

/* ---------------- MONGODB ---------------- */

async function connectDB() {
    try {
        const client = new MongoClient(mongoUrl);
        await client.connect();
        db = client.db("whatsapp_bot");
        console.log("✅ MongoDB Connected");
    } catch (err) {
        console.log("❌ MongoDB Error:", err.message);
    }
}

/* ---------------- START COMMAND ---------------- */

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(
        msg.chat.id,
        `👋 *Welcome!*\n\n` +
        `🔹 /pair 92XXXXXXXXXX - Connect WhatsApp\n` +
        `🔹 Send video/photo - Forward to WhatsApp`,
        { parse_mode: "Markdown" }
    );
});

/* ---------------- PAIR COMMAND ---------------- */

bot.onText(/\/pair (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    let phoneNumber = match[1].replace(/\D/g, "");

    if (phoneNumber.startsWith("0")) phoneNumber = phoneNumber.substring(1);
    if (!phoneNumber.startsWith("92")) phoneNumber = "92" + phoneNumber;

    await bot.sendMessage(chatId, "🔄 Generating pairing code...");

    try {
        const { state } = await useMultiFileAuthState("auth_info");

        const pairingSock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            browser: ["Chrome", "Linux", ""],
            logger: pino({ level: "silent" })
        });

        setTimeout(async () => {
            try {
                const code = await pairingSock.requestPairingCode(phoneNumber);

                const formatted = code.match(/.{1,4}/g)?.join("-") || code;

                await bot.sendMessage(
                    chatId,
                    `✅ *Pairing Code:*\n\n\`${formatted}\`\n\n` +
                    `Open WhatsApp → Linked Devices → Link with phone number`,
                    { parse_mode: "Markdown" }
                );

                sock = pairingSock;

                pairingSock.ev.on("connection.update", ({ connection }) => {
                    if (connection === "open") {
                        bot.sendMessage(chatId, "✅ WhatsApp Connected!");
                    }
                });

            } catch (err) {
                bot.sendMessage(chatId, `❌ Error: ${err.message}`);
            }
        }, 3000);

    } catch (err) {
        bot.sendMessage(chatId, `❌ Error: ${err.message}`);
    }
});

/* ---------------- MEDIA FORWARD ---------------- */

bot.on("message", async (msg) => {
    if (!sock) return;

    if (msg.video || msg.photo) {
        const chatId = msg.chat.id;

        try {
            const caption = msg.caption || "";
            const fileId = msg.video ? msg.video.file_id : msg.photo.pop().file_id;
            const fileLink = await bot.getFileLink(fileId);

            const response = await axios.get(fileLink, {
                responseType: "arraybuffer"
            });

            await sock.sendMessage(`${targetNumber}@s.whatsapp.net`, {
                [msg.video ? "video" : "image"]: Buffer.from(response.data),
                caption
            });

            bot.sendMessage(chatId, "✅ Sent!");

        } catch (err) {
            bot.sendMessage(chatId, `❌ Error: ${err.message}`);
        }
    }
});

/* ---------------- WEB SERVER ---------------- */

app.get("/", (req, res) => {
    res.send("🤖 Bot Running...");
});

connectDB();

app.listen(port, () => {
    console.log("🚀 Server Running");
});
