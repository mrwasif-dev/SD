const { TelegramBot } = require('telegram-node-bot');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ============= کانفیگریشن =============
const TELEGRAM_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN_HERE'; // اپنا ٹوکن لگائیں
const TARGET_WHATSAPP_NUMBER = '923001234567@c.us'; // اپنا نمبر +@c.us کے ساتھ

// ============= وٹس ایپ کلائنٹ (پئیر کوڈ کے ساتھ) =============
const whatsapp = new Client({
    authStrategy: new LocalAuth({
        clientId: 'telegram-bot-pairing'
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ]
    }
});

// پئیر کوڈ جنریٹ کرنے کا فنکشن
async function getPairingCode(phoneNumber) {
    try {
        console.log(`📱 پئیر کوڈ حاصل کیا جا رہا ہے...`);
        
        // پہلے ریڈی ہونے کا انتظار کریں
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // پئیر کوڈ حاصل کریں
        const pairingCode = await whatsapp.requestPairingCode(phoneNumber);
        
        console.log('\n🔐 آپ کا پئیر کوڈ:');
        console.log('=================================');
        console.log(`   ${pairingCode}   `);
        console.log('=================================');
        console.log('\n📱 وٹس ایپ میں جائیں:');
        console.log('1️⃣ تھری ڈاٹ مینو (⋮) پر کلک کریں');
        console.log('2️⃣ "Linked Devices" منتخب کریں');
        console.log('3️⃣ "Link a Device" پر کلک کریں');
        console.log('4️⃣ **"Link with phone number instead"** پر کلک کریں');
        console.log('5️⃣ اوپر دیا گیا 8 ہندسوں کا کوڈ درج کریں\n');
        
        return pairingCode;
    } catch (error) {
        console.error('❌ پئیر کوڈ حاصل کرنے میں خرابی:', error);
        return null;
    }
}

// وٹس ایپ ریڈی ہو جائے
whatsapp.on('ready', async () => {
    console.log('✅ وٹس ایپ کنیکٹ ہو گیا!');
    
    // بوٹ چلانے والے کو پیغام
    console.log('\n🎉 اب آپ ٹیلیگرام پر ویڈیوز بھیج سکتے ہیں!');
});

// وٹس ایپ کی حالت
whatsapp.on('authenticated', () => {
    console.log('✅ وٹس ایپ تصدیق مکمل');
});

whatsapp.on('auth_failure', msg => {
    console.error('❌ تصدیق ناکام:', msg);
});

whatsapp.on('disconnected', (reason) => {
    console.log('⚠️ وٹس ایپ ڈسکنیکٹ:', reason);
    console.log('🔄 دوبارہ کنیکٹ ہو رہا ہے...');
});

// پئیر کوڈ کے لیے اضافی ایونٹ
whatsapp.on('qr', (qr) => {
    // QR کوڈ کو نظر انداز کریں، صرف پئیر کوڈ استعمال کریں
    console.log('⏳ پئیر کوڈ کا انتظار ہے...');
});

// ============= ٹیلیگرام بوٹ =============
const tg = new TelegramBot(TELEGRAM_TOKEN, {
    polling: {
        interval: 1000,
        params: {
            timeout: 10
        }
    }
});

// بوٹ ریڈی ہو جائے
tg.on('master', () => {
    console.log('✅ ٹیلیگرام بوٹ شروع ہو گیا!');
});

// اسٹارٹ کمانڈ
tg.on('text', async (msg) => {
    if (msg.text === '/start') {
        await tg.api.sendMessage({
            chat_id: msg.chat.id,
            text: '👋 السلام علیکم!\n\n📹 مجھے کوئی بھی ویڈیو بھیجیں، میں اسے وٹس ایپ پر بھیج دوں گا۔\n\n⚠️ نوٹ: پہلے وٹس ایپ پئیر کوڈ سے کنیکٹ کرنا ہوگا۔'
        });
    }
    
    // پئیر کوڈ کمانڈ
    if (msg.text === '/pair') {
        await tg.api.sendMessage({
            chat_id: msg.chat.id,
            text: '⏳ پئیر کوڈ حاصل کیا جا رہا ہے... براہ کرم انتظار کریں۔'
        });
        
        // پئیر کوڈ حاصل کریں
        const phoneNumber = TARGET_WHATSAPP_NUMBER.replace('@c.us', '');
        const pairingCode = await getPairingCode(phoneNumber);
        
        if (pairingCode) {
            await tg.api.sendMessage({
                chat_id: msg.chat.id,
                text: `🔐 *آپ کا پئیر کوڈ:* \`${pairingCode}\`\n\n📱 وٹس ایپ میں جائیں:\n1️⃣ تھری ڈاٹ مینو (⋮) پر کلک کریں\n2️⃣ "Linked Devices" منتخب کریں\n3️⃣ "Link a Device" پر کلک کریں\n4️⃣ **"Link with phone number instead"** منتخب کریں\n5️⃣ یہ 8 ہندسوں کا کوڈ درج کریں`,
                parse_mode: 'Markdown'
            });
        } else {
            await tg.api.sendMessage({
                chat_id: msg.chat.id,
                text: '❌ پئیر کوڈ حاصل کرنے میں خرابی۔ دوبارہ کوشش کریں۔'
            });
        }
    }
});

// ============= ویڈیو ہینڈلر =============
tg.on('video', async (msg) => {
    try {
        console.log('📹 ویڈیو موصول ہوئی...');
        
        // چیک کریں کہ وٹس ایپ کنیکٹ ہے یا نہیں
        if (!whatsapp.info || !whatsapp.info.wid) {
            await tg.api.sendMessage({
                chat_id: msg.chat.id,
                text: '⚠️ وٹس ایپ کنیکٹ نہیں ہے۔ پہلے /pair کمانڈ سے کنیکٹ کریں۔'
            });
            return;
        }
        
        // صارف کو پیغام
        const statusMsg = await tg.api.sendMessage({
            chat_id: msg.chat.id,
            text: '⏳ ویڈیو ڈاؤن لوڈ ہو رہی ہے... 0%'
        });
        
        // ویڈیو ڈاؤن لوڈ کریں
        const videoFile = msg.video;
        const fileId = videoFile.file_id;
        
        // فائل کا لنک حاصل کریں
        const file = await tg.api.getFile({ file_id: fileId });
        const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;
        
        // فائل ڈاؤن لوڈ کریں
        const response = await axios({
            method: 'GET',
            url: fileUrl,
            responseType: 'stream',
            onDownloadProgress: (progressEvent) => {
                const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                // Progress اپ ڈیٹ کریں
                tg.api.editMessageText({
                    chat_id: msg.chat.id,
                    message_id: statusMsg.message_id,
                    text: `⏳ ویڈیو ڈاؤن لوڈ ہو رہی ہے... ${percent}%`
                }).catch(() => {});
            }
        });
        
        // فائل سیو کریں
        const fileName = `video_${Date.now()}.mp4`;
        const filePath = path.join(__dirname, 'downloads', fileName);
        
        // downloads فولڈر بنائیں اگر نہیں ہے
        if (!fs.existsSync('downloads')) {
            fs.mkdirSync('downloads');
        }
        
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);
        
        writer.on('finish', async () => {
            try {
                console.log('✅ ویڈیو ڈاؤن لوڈ ہو گئی');
                
                // Progress اپ ڈیٹ
                await tg.api.editMessageText({
                    chat_id: msg.chat.id,
                    message_id: statusMsg.message_id,
                    text: '⏳ وٹس ایپ پر بھیجا جا رہا ہے...'
                });
                
                // وٹس ایپ پر بھیجیں
                const media = MessageMedia.fromFilePath(filePath);
                await whatsapp.sendMessage(TARGET_WHATSAPP_NUMBER, media, {
                    caption: `📹 ویڈیو ٹیلیگرام سے موصول ہوئی\n📅 تاریخ: ${new Date().toLocaleString('ur-PK')}\n👤 بھیجنے والا: ${msg.from.first_name || ''} ${msg.from.last_name || ''}`
                });
                
                console.log('✅ ویڈیو وٹس ایپ پر بھیج دی گئی');
                
                // صارف کو کامیابی کا پیغام
                await tg.api.editMessageText({
                    chat_id: msg.chat.id,
                    message_id: statusMsg.message_id,
                    text: '✅ ویڈیو کامیابی سے وٹس ایپ پر بھیج دی گئی!'
                });
                
                // فائل ڈیلیٹ کریں
                fs.unlinkSync(filePath);
                
            } catch (whatsappError) {
                console.error('❌ وٹس ایپ ایرر:', whatsappError);
                await tg.api.editMessageText({
                    chat_id: msg.chat.id,
                    message_id: statusMsg.message_id,
                    text: `❌ وٹس ایپ پر بھیجتے ہوئے خرابی: ${whatsappError.message}`
                });
            }
        });
        
        writer.on('error', async (err) => {
            console.error('❌ فائل سیو کرتے ہوئے خرابی:', err);
            await tg.api.editMessageText({
                chat_id: msg.chat.id,
                message_id: statusMsg.message_id,
                text: '❌ ویڈیو ڈاؤن لوڈ کرتے ہوئے خرابی۔'
            });
        });
        
    } catch (error) {
        console.error('❌ خرابی:', error);
        await tg.api.sendMessage({
            chat_id: msg.chat.id,
            text: `❌ ویڈیو پروسیس کرتے ہوئے خرابی: ${error.message}`
        });
    }
});

// ============= وٹس ایپ کو پئیر کوڈ سے شروع کریں =============
async function startWithPairingCode() {
    console.log('🤖 بوٹ شروع ہو رہا ہے...');
    console.log('📱 وٹس ایپ پئیر کوڈ موڈ میں شروع ہو رہا ہے...');
    
    // وٹس ایپ شروع کریں
    await whatsapp.initialize();
    
    // پئیر کوڈ کے لیے ریڈی ہونے کا انتظار
    setTimeout(async () => {
        const phoneNumber = TARGET_WHATSAPP_NUMBER.replace('@c.us', '');
        await getPairingCode(phoneNumber);
    }, 10000); // 10 سیکنڈ بعد پئیر کوڈ جنریٹ کریں
}

// ============= پروسیس ہینڈلنگ =============
process.on('SIGINT', async () => {
    console.log('\n📴 بوٹ بند ہو رہا ہے...');
    try {
        await whatsapp.destroy();
    } catch (error) {
        // اگنور
    }
    process.exit();
});

// بوٹ شروع کریں
startWithPairingCode();
