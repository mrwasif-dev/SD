// ===============================
// ✅ FINAL STABLE WHATSAPP BOT
// ===============================

// 🔥 CRITICAL FIX FOR HEROKU
const nodeCrypto = require("crypto");
global.crypto = nodeCrypto;

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const axios = require("axios");
const pino = require("pino");

const app = express();
const port = process.env.PORT || 5000;

const telegramToken = process.env.TELEGRAM_TOKEN;
const targetNumber = process.env.TARGET_NUMBER;

let bot = new TelegramBot(telegramToken, { polling: true });
let sock;

// ================= START COMMAND =================

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "👋 Welcome!\n\nUse:\n/pair 92XXXXXXXXXX"
  );
});

// ================= PAIR COMMAND =================

bot.onText(/\/pair (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;

  let phoneNumber = match[1].replace(/\D/g, "");
  if (phoneNumber.startsWith("0")) phoneNumber = phoneNumber.substring(1);
  if (!phoneNumber.startsWith("92")) phoneNumber = "92" + phoneNumber;

  await bot.sendMessage(chatId, "🔄 Connecting to WhatsApp...");

  try {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");
    const { version } = await fetchLatestBaileysVersion();

    const pairingSock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: "silent" }),
      browser: ["Chrome", "Linux", ""]
    });

    pairingSock.ev.on("creds.update", saveCreds);

    pairingSock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "connecting") {
        console.log("🔄 Connecting...");
      }

      if (connection === "open") {
        console.log("✅ Connected to WhatsApp");

        try {
          const code = await pairingSock.requestPairingCode(phoneNumber);

          if (!code) {
            return bot.sendMessage(chatId, "❌ Failed to generate pairing code");
          }

          const formatted = code.match(/.{1,4}/g)?.join("-") || code;

          await bot.sendMessage(
            chatId,
            `✅ Pairing Code:\n\n${formatted}\n\n` +
            `Open WhatsApp > Linked Devices > Link with phone number\n` +
            `Enter this code immediately.`,
          );

          sock = pairingSock;

        } catch (err) {
          bot.sendMessage(chatId, "❌ " + err.message);
        }
      }

      if (connection === "close") {
        const shouldReconnect =
          lastDisconnect?.error?.output?.statusCode !==
          DisconnectReason.loggedOut;

        console.log("❌ Connection Closed");

        if (shouldReconnect) {
          console.log("🔄 Reconnecting...");
        } else {
          console.log("🚫 Logged Out. Pair again.");
        }
      }
    });

  } catch (err) {
    bot.sendMessage(chatId, "❌ " + err.message);
  }
});

// ================= MEDIA FORWARD =================

bot.on("message", async (msg) => {
  if (!sock) return;

  if (msg.video || msg.photo) {
    const chatId = msg.chat.id;

    try {
      const caption = msg.caption || "";
      const fileId = msg.video
        ? msg.video.file_id
        : msg.photo.pop().file_id;

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
      bot.sendMessage(chatId, "❌ " + err.message);
    }
  }
});

// ================= WEB SERVER =================

app.get("/", (req, res) => {
  res.send("🤖 Bot Running");
});

app.listen(port, () => {
  console.log("🚀 Server Running");
});
