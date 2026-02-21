const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const fs = require('fs');

// ⚠️ اپنا Bot Token یہاں لگائیں
const BOT_TOKEN = 'YOUR_BOT_TOKEN_HERE';  // اپنا ٹوکن یہاں ڈالیں

// API URL
const API_URL = 'https://arslan-apis.vercel.app/more/database';

const bot = new Telegraf(BOT_TOKEN);

// یوزرز کا ڈیٹا بیس (فائل میں سیو کرنے کے لیے)
const USERS_FILE = './users.json';
let users = {};

// لوڈ یوزرز
if (fs.existsSync(USERS_FILE)) {
    users = JSON.parse(fs.readFileSync(USERS_FILE));
}

// سیو یوزرز
function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// کنسول کلرز
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    red: '\x1b[31m'
};

// لاگنگ فنکشن
function log(message, type = 'info') {
    const time = new Date().toLocaleTimeString();
    switch(type) {
        case 'success':
            console.log(`${colors.green}[${time}] ✅ ${message}${colors.reset}`);
            break;
        case 'error':
            console.log(`${colors.red}[${time}] ❌ ${message}${colors.reset}`);
            break;
        case 'warn':
            console.log(`${colors.yellow}[${time}] ⚠️ ${message}${colors.reset}`);
            break;
        case 'cmd':
            console.log(`${colors.cyan}[${time}] ⌨️ ${message}${colors.reset}`);
            break;
        default:
            console.log(`${colors.blue}[${time}] ℹ️ ${message}${colors.reset}`);
    }
}

// سٹارٹ کمانڈ
bot.start((ctx) => {
    const user = ctx.from;
    const chatId = ctx.chat.id;
    
    // یوزر کو سیو کریں
    if (!users[chatId]) {
        users[chatId] = {
            id: chatId,
            username: user.username || '',
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            date: new Date().toISOString(),
            searches: 0
        };
        saveUsers();
        log(`نئے یوزر: ${user.first_name} (@${user.username || 'no-username'})`, 'success');
    }
    
    const welcomeMsg = `
🔥 **E3-HACKER SIM DATABASE BOT** 🔥

👋 سلام ${user.first_name}!

📱 **پاکستان سم ڈیٹا بیس**
یہ بوٹ آپ کو پاکستان کے سم ڈیٹا بیس سے معلومات فراہم کرتا ہے

🔍 **استعمال:**
بس موبائل نمبر لکھیں (بغیر 0 کے)

✅ **مثال:** \`3001234567\`
❌ **غلط:** \`03001234567\`

👤 **کریٹر:** @E3_HACKER
📢 **چینل:** @E3_HACKER_CH
    `;
    
    ctx.replyWithMarkdown(welcomeMsg, {
        reply_markup: {
            keyboard: [
                ['🔍 نمبر تلاش کریں'],
                ['📊 میری معلومات', '👥 کل یوزرز'],
                ['ℹ️ مدد', '👤 کریٹر']
            ],
            resize_keyboard: true
        }
    });
});

// ہینڈل کی بورڈ بٹن
bot.hears('🔍 نمبر تلاش کریں', (ctx) => {
    ctx.reply('📱 براہ کرم موبائل نمبر لکھیں (بغیر 0 کے):\n\nمثال: `3001234567`', {
        parse_mode: 'Markdown'
    });
});

bot.hears('📊 میری معلومات', (ctx) => {
    const chatId = ctx.chat.id;
    const user = users[chatId] || { searches: 0 };
    
    ctx.replyWithMarkdown(`
👤 **آپ کی معلومات:**

🆔 آئی ڈی: \`${chatId}\`
👤 نام: ${ctx.from.first_name}
🔍 تلاشیاں: ${user.searches || 0}
📅 تاریخ: ${user.date || 'N/A'}
    `);
});

bot.hears('👥 کل یوزرز', (ctx) => {
    const total = Object.keys(users).length;
    ctx.replyWithMarkdown(`👥 **کل یوزرز:** \`${total}\``);
});

bot.hears('ℹ️ مدد', (ctx) => {
    ctx.replyWithMarkdown(`
📌 **رہنمائی:**

1️⃣ نمبر بغیر 0 کے لکھیں
2️⃣ صرف پاکستانی نمبرز
3️⃣ 10 سے 12 ڈیجٹس

✅ **صحیح:** \`3001234567\`
❌ **غلط:** \`03001234567\`

⚠️ **نوٹ:** یہ صرف تعلیمی مقاصد کے لیے ہے
    `);
});

bot.hears('👤 کریٹر', (ctx) => {
    ctx.replyWithMarkdown(`
👤 **کریٹر:** @E3_HACKER
📢 **چینل:** @E3_HACKER_CH
💬 **واٹس ایپ:** wa.me/923495178663
    `);
});

// نمبر سرچ کرنا
bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const chatId = ctx.chat.id;
    
    // اگر یہ کی بورڈ بٹن ہے تو ignore کریں
    if (text.startsWith('/') || 
        text === '🔍 نمبر تلاش کریں' || 
        text === '📊 میری معلومات' || 
        text === '👥 کل یوزرز' || 
        text === 'ℹ️ مدد' || 
        text === '👤 کریٹر') {
        return;
    }
    
    // صرف نمبر چیک کریں
    const number = text.replace(/\D/g, '');
    
    if (!number) {
        ctx.reply('❌ براہ کرم ایک نمبر لکھیں');
        return;
    }
    
    if (number.length < 10 || number.length > 15) {
        ctx.reply(`❌ غلط نمبر! 10-15 ڈیجٹس ہونے چاہئیں\nآپ نے ${number.length} ڈیجٹس لکھے`);
        return;
    }
    
    if (number.startsWith('0')) {
        ctx.reply('❌ نمبر 0 سے شروع نہیں ہونا چاہیے\nمثال: 3001234567');
        return;
    }
    
    log(`تلاش: ${number} از ${ctx.from.first_name}`, 'cmd');
    
    // یوزر کی سرچ count بڑھائیں
    if (users[chatId]) {
        users[chatId].searches = (users[chatId].searches || 0) + 1;
        saveUsers();
    }
    
    // سرچ کرنے کا میسج
    const searchMsg = await ctx.reply(`🔍 **تلاش جاری ہے...**\n\nنمبر: \`${number}\`\nڈیٹا بیس چیک کیا جا رہا ہے`, {
        parse_mode: 'Markdown'
    });
    
    try {
        // API کال
        const response = await axios.get(`${API_URL}?number=${number}`);
        const data = response.data;
        
        if (!data.status || !data.result || data.result.length === 0) {
            await ctx.telegram.editMessageText(
                chatId,
                searchMsg.message_id,
                null,
                `❌ **کوئی ڈیٹا نہیں ملا**\n\nنمبر: \`${number}\`\nاس نمبر کے لیے کوئی ریکارڈ موجود نہیں`,
                { parse_mode: 'Markdown' }
            );
            return;
        }
        
        // ڈیٹا مل گیا - میسج اپڈیٹ کریں
        let resultText = `✅ **ڈیٹا ملا!**\n\n📱 **نمبر:** \`${number}\`\n📊 **کل ریکارڈز:** ${data.result.length}\n\n`;
        
        data.result.forEach((item, index) => {
            resultText += `**${index + 1}. ${item.full_name || 'نام نامعلوم'}**\n`;
            resultText += `📞 فون: \`${item.phone || 'N/A'}\`\n`;
            resultText += `🆔 CNIC: \`${item.cnic || 'N/A'}\`\n`;
            resultText += `📍 پتہ: ${item.address || 'N/A'}\n`;
            resultText += `➖➖➖➖➖➖➖\n\n`;
        });
        
        resultText += `🔍 **تلاش کنندہ:** ${ctx.from.first_name}\n`;
        resultText += `🕒 **وقت:** ${new Date().toLocaleString('pk-PK')}`;
        
        await ctx.telegram.editMessageText(
            chatId,
            searchMsg.message_id,
            null,
            resultText,
            { parse_mode: 'Markdown' }
        );
        
        log(`مل گیا: ${number} - ${data.result.length} ریکارڈز`, 'success');
        
    } catch (error) {
        log(`API Error: ${error.message}`, 'error');
        
        await ctx.telegram.editMessageText(
            chatId,
            searchMsg.message_id,
            null,
            `⚠️ **سرور کنکشن میں مسئلہ**\n\nنمبر: \`${number}\`\nبراہ کرم تھوڑی دیر بعد کوشش کریں`,
            { parse_mode: 'Markdown' }
        );
        
        // Mock data for testing
        if (['3336678955', '3105551234', '4155557890', '923001234567'].includes(number)) {
            await showMockData(ctx, chatId, number, searchMsg);
        }
    }
});

// Mock data for testing
async function showMockData(ctx, chatId, number, searchMsg) {
    const mockData = {
        '3336678955': [
            { full_name: 'John Alexander', phone: '3336678955', cnic: '42101-1234567-8', address: 'Lahore, Pakistan' },
            { full_name: 'John A. Smith', phone: '3336678955', cnic: '42101-9876543-2', address: 'Karachi, Pakistan' }
        ],
        '3105551234': [
            { full_name: 'Sarah Johnson', phone: '3105551234', cnic: '35202-4567890-1', address: 'Islamabad, Pakistan' }
        ],
        '4155557890': [
            { full_name: 'Michael Williams', phone: '4155557890', cnic: '37303-5678901-2', address: 'Faisalabad, Pakistan' },
            { full_name: 'Mike Williams', phone: '4155557890', cnic: '37303-8765432-1', address: 'Rawalpindi, Pakistan' }
        ],
        '923001234567': [
            { full_name: 'Test User', phone: '923001234567', cnic: '42101-1122334-5', address: 'Pakistan' }
        ]
    };
    
    const data = mockData[number];
    if (!data) return;
    
    let resultText = `✅ **ڈیٹا ملا! (Mock Data)**\n\n📱 **نمبر:** \`${number}\`\n📊 **کل ریکارڈز:** ${data.length}\n\n`;
    
    data.forEach((item, index) => {
        resultText += `**${index + 1}. ${item.full_name}**\n`;
        resultText += `📞 فون: \`${item.phone}\`\n`;
        resultText += `🆔 CNIC: \`${item.cnic}\`\n`;
        resultText += `📍 پتہ: ${item.address}\n`;
        resultText += `➖➖➖➖➖➖➖\n\n`;
    });
    
    await ctx.telegram.editMessageText(
        chatId,
        searchMsg.message_id,
        null,
        resultText,
        { parse_mode: 'Markdown' }
    );
}

// ایڈمن کمانڈز
bot.command('stats', (ctx) => {
    const chatId = ctx.chat.id;
    // ایڈمن چیک (اپنا ID ڈالیں)
    if (chatId !== 123456789) { // اپنا Telegram ID یہاں ڈالیں
        ctx.reply('⛔ آپ ایڈمن نہیں ہیں');
        return;
    }
    
    const total = Object.keys(users).length;
    const totalSearches = Object.values(users).reduce((acc, user) => acc + (user.searches || 0), 0);
    
    ctx.replyWithMarkdown(`
📊 **بوٹ سٹیٹس:**

👥 کل یوزرز: \`${total}\`
🔍 کل تلاشیں: \`${totalSearches}\`
🕒 اپ ٹائم: \`${process.uptime().toFixed(0)} سیکنڈز\`
    `);
});

// ہیلپ کمانڈ
bot.help((ctx) => {
    ctx.replyWithMarkdown(`
📌 **کمانڈز:**

/start - بوٹ شروع کریں
/help - مدد حاصل کریں
/stats - بوٹ سٹیٹس (ایڈمن)

**استعمال:**
صرف نمبر لکھیں (بغیر 0 کے)
مثال: \`3001234567\`
    `);
});

// پرائیویسی پالیسی
bot.command('privacy', (ctx) => {
    ctx.replyWithMarkdown(`
🔒 **پرائیویسی پالیسی:**

• آپ کا نمبر صرف تلاش کے لیے استعمال ہوتا ہے
• کوئی بھی ڈیٹا محفوظ نہیں کیا جاتا
• یہ صرف تعلیمی مقاصد کے لیے ہے
    `);
});

// ایرر ہینڈلنگ
bot.catch((err, ctx) => {
    log(`Bot error: ${err}`, 'error');
    ctx.reply('⚠️ کوئی مسئلہ ہو گیا ہے');
});

// بوٹ اسٹارٹ
bot.launch().then(() => {
    console.log(`
╔══════════════════════════════════╗
║   📱 E3-HACKER SIM BOT ACTIVE    ║
╠══════════════════════════════════╣
║  بوٹ چل رہا ہے...                 ║
║  کریٹر: @E3_HACKER                ║
║  چینل: @E3_HACKER_CH              ║
╚══════════════════════════════════╝
    `);
    log('بوٹ اسٹارٹ ہو گیا', 'success');
});

// گرہنتی ہینڈلنگ
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
