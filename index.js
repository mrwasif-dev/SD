// =============================
// ✅ WHATSAPP BOT FINAL VERSION
// =============================

// 🔥 HEROKU CRYPTO FIX
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
const appUrl = process.env.APP_URL;

let bot = new TelegramBot(telegramToken, { polling: true });
let sock;

/* ================= KEEP HEROKU ALIVE ================= */

setInterval(() => {
  if (appUrl) {
    require("https").get(appUrl).on("error", () => {});
  }
}, 20 * 60 * 1000);

/* ================= WHATSAPP CONNECT ================= */

async function startWhatsApp(authFolder = "auth_info") {
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    browser: ["Chrome", "Linux", ""],
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 15000
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    console.log("Connection:", connection);

    if (connection === "open") {
      console.log("✅ WhatsApp Connected");
    }

    if (connection === "close") {
      const status =
        lastDisconnect?.error?.output?.statusCode;

      console.log("❌ Closed:", status);

      if (status !== 401) {
        console.log("🔄 Reconnecting...");
        setTimeout(() => startWhatsApp(authFolder), 5000);
      } else {
        console.log("🚫 Logged Out");
      }
    }
  });
}

/* ================= TELEGRAM COMMANDS ================= */

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "👋 Bot Ready\n\nUse:\n/pair 92XXXXXXXXXX"
  );
});

/* ================= PAIR COMMAND ================= */

bot.onText(/\/pair (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;

  let phoneNumber = match[1].replace(/\D/g, "");

  if (phoneNumber.startsWith("0"))
    phoneNumber = phoneNumber.substring(1);

  if (!phoneNumber.startsWith("92"))
    phoneNumber = "92" + phoneNumber;

  await bot.sendMessage(chatId, "🔄 Connecting to WhatsApp...");

  try {
    const { state } = await useMultiFileAuthState("auth_info");
    const { version } = await fetchLatestBaileysVersion();

    const pairingSock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: "silent" }),
      browser: ["Chrome", "Linux", ""],
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 15000
    });

    pairingSock.ev.on("connection.update", async (update) => {
      const { connection } = update;

      if (connection === "open") {
        try {
          const code =
            await pairingSock.requestPairingCode(phoneNumber);

          if (!code) {
            return bot.sendMessage(
              chatId,
              "❌ Failed to generate pairing code"
            );
          }

          const formatted =
            code.match(/.{1,4}/g)?.join("-") || code;

          await bot.sendMessage(
            chatId,
            `✅ Pairing Code:\n\n${formatted}\n\n` +
              `Open WhatsApp → Linked Devices → Link with phone number`
          );
        } catch (err) {
          bot.sendMessage(chatId, "❌ " + err.message);
        }
      }
    });

  } catch (err) {
    bot.sendMessage(chatId, "❌ " + err.message);
  }
});

/* ================= MEDIA FORWARD ================= */

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

      await sock.sendMessage(
        `${targetNumber}@s.whatsapp.net`,
        {
          [msg.video ? "video" : "image"]:
            Buffer.from(response.data),
          caption
        }
      );

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
  console.log("🚀 Server Started");
});

// 🔥 Auto Start WhatsApp
startWhatsApp();
