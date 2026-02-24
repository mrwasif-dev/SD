// ===============================
// ✅ HEROKU + BAILEYS FULL FIX
// ===============================

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
const { MongoClient } = require("mongodb");
const pino = require("pino");

const app = express();
const port = process.env.PORT || 5000;

const telegramToken = process.env.TELEGRAM_TOKEN;
const targetNumber = process.env.TARGET_NUMBER;
const mongoUrl = process.env.MONGODB_URL;

let bot;
let sock = null;
let db = null;

/* ================= TELEGRAM ================= */

bot = new TelegramBot(telegramToken, { polling: true });
console.log("✅ Telegram Started");

/* ================= MONGODB ================= */

async function connectDB() {
  const client = new MongoClient(mongoUrl);
  await client.connect();
  db = client.db("whatsapp_bot");
  console.log("✅ MongoDB Connected");
}
connectDB();

/* ================= WHATSAPP CONNECT ================= */

async function startWhatsApp(authFolder = "auth_info") {
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    browser: ["Chrome", "Linux", ""]
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log("✅ WhatsApp Connected");
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;

      console.log("❌ Connection Closed");

      if (shouldReconnect) {
        console.log("🔄 Reconnecting...");
        startWhatsApp(authFolder);
      } else {
        console.log("🚫 Logged out. Scan again.");
      }
    }
  });
}

/* ================= COMMANDS ================= */

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "👋 Welcome!\n\n/pair 92XXXXXXXXXX - Connect WhatsApp"
  );
});

bot.onText(/\/pair (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  let phoneNumber = match[1].replace(/\D/g, "");

  if (phoneNumber.startsWith("0")) phoneNumber = phoneNumber.substring(1);
  if (!phoneNumber.startsWith("92")) phoneNumber = "92" + phoneNumber;

  await bot.sendMessage(chatId, "🔄 Generating pairing code...");

  try {
    const { state } = await useMultiFileAuthState("auth_info");
    const { version } = await fetchLatestBaileysVersion();

    const pairingSock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: "silent" }),
      browser: ["Chrome", "Linux", ""]
    });

    setTimeout(async () => {
      try {
        const code = await pairingSock.requestPairingCode(phoneNumber);
        const formatted = code.match(/.{1,4}/g)?.join("-");

        await bot.sendMessage(
          chatId,
          `✅ Pairing Code:\n\n${formatted}\n\nOpen WhatsApp > Linked Devices > Link with phone number`
        );

        sock = pairingSock;

        pairingSock.ev.on("creds.update", async () => {
          console.log("💾 Session Saved");
        });

      } catch (err) {
        bot.sendMessage(chatId, "❌ " + err.message);
      }
    }, 4000);

  } catch (err) {
    bot.sendMessage(chatId, "❌ " + err.message);
  }
});

/* ================= MEDIA ================= */

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

/* ================= SERVER ================= */

app.get("/", (req, res) => {
  res.send("🤖 Bot Running");
});

app.listen(port, () => {
  console.log("🚀 Server Running on port", port);
});
