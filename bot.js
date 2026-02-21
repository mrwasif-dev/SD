const { Telegraf } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf('8473768451:AAF7xWs6GpigimrIdlQEpQvMRThGEv6xpU8');

// APIs
const PHONE_API = 'https://arslan-apis.vercel.app/more/database?number=';     // Phone numbers
const CNIC_API = 'https://cnicapi.com/api/cnic/';                              // CNIC details
const CNIC_SIMS_API = 'https://cnicapi.com/api/sims/';                         // Sims on CNIC

console.log('🇵🇰 PAKISTAN DATABASE BOT STARTED');

function isCNIC(input) {
    let clean = input.replace(/\D/g, '');
    if (clean.length === 13) return true;
    if (input.includes('-')) {
        let parts = input.split('-');
        if (parts.length === 3 && parts.join('').length === 13) return true;
    }
    return false;
}

function formatPhone(input) {
    let num = input.replace(/\D/g, '');
    if (!num) return null;
    
    if (num.startsWith('03') && num.length === 11) return num.substring(1);
    if (num.startsWith('3') && num.length === 10) return num;
    if (num.startsWith('92') && num.length === 12) return num.substring(2);
    if (num.startsWith('0092') && num.length === 14) return num.substring(4);
    return null;
}

function formatCNIC(input) {
    let clean = input.replace(/\D/g, '');
    if (clean.length === 13) {
        return clean; // Return without dashes for API
    }
    return null;
}

bot.start((ctx) => {
    ctx.reply(
        '🇵🇰 *PAKISTAN DATABASE BOT* 🇵🇰\n\n' +
        'Send phone number or CNIC\n\n' +
        '📱 *Phone:* 3001234567\n' +
        '🆔 *CNIC:* 3620240739701  or  36202-4073970-1',
        { parse_mode: 'Markdown' }
    );
});

bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith('/')) return;
    
    // CNIC Check
    if (isCNIC(text)) {
        const cnic = formatCNIC(text);
        console.log(`🔍 Searching CNIC: ${cnic}`);
        
        const msg = await ctx.reply(`🆔 Searching CNIC *${cnic}*...`, { parse_mode: 'Markdown' });
        
        try {
            // 1. Get CNIC basic info
            const cnicRes = await axios.get(`${CNIC_API}${cnic}`, { timeout: 10000 });
            
            if (!cnicRes.data || !cnicRes.data.success) {
                return ctx.telegram.editMessageText(
                    ctx.chat.id, msg.message_id, null,
                    `❌ No data found for CNIC *${cnic}*`,
                    { parse_mode: 'Markdown' }
                );
            }
            
            const cnicData = cnicRes.data.data;
            
            // 2. Get SIMs on this CNIC
            const simsRes = await axios.get(`${CNIC_SIMS_API}${cnic}`, { timeout: 10000 });
            const sims = simsRes.data.success ? simsRes.data.data : [];
            
            let response = `🆔 *CNIC:* ${cnic.slice(0,5)}-${cnic.slice(5,12)}-${cnic.slice(12)}\n`;
            response += `👤 *Name:* ${cnicData.name || 'N/A'}\n`;
            response += `👨 *Father:* ${cnicData.father_name || 'N/A'}\n`;
            response += `📍 *Address:* ${cnicData.address || 'N/A'}\n`;
            response += `📅 *Date of Birth:* ${cnicData.dob || 'N/A'}\n\n`;
            
            if (sims.length > 0) {
                response += `📱 *Registered SIMs (${sims.length}):*\n\n`;
                sims.forEach((sim, i) => {
                    response += `${i+1}. 📞 *${sim.number}*\n`;
                    response += `   📱 ${sim.operator || 'N/A'}\n`;
                    response += `   📅 ${sim.activation_date || 'N/A'}\n`;
                    if (i < sims.length - 1) response += `   ──────────\n`;
                });
            } else {
                response += `📱 No SIMs found on this CNIC\n`;
            }
            
            await ctx.telegram.editMessageText(
                ctx.chat.id, msg.message_id, null,
                response,
                { parse_mode: 'Markdown' }
            );
            
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
            
            // Mock data for testing
            const mockData = getMockCNICData(cnic);
            if (mockData) {
                await ctx.telegram.editMessageText(
                    ctx.chat.id, msg.message_id, null,
                    mockData,
                    { parse_mode: 'Markdown' }
                );
            } else {
                await ctx.telegram.editMessageText(
                    ctx.chat.id, msg.message_id, null,
                    `❌ No data found for CNIC *${cnic}*`,
                    { parse_mode: 'Markdown' }
                );
            }
        }
        return;
    }
    
    // Phone Number
    const phone = formatPhone(text);
    if (!phone) {
        return ctx.reply('❌ *Invalid format*\n\nSend:\n📱 3001234567\n🆔 3620240739701');
    }
    
    const msg = await ctx.reply(`📱 Searching *${phone}*...`, { parse_mode: 'Markdown' });
    
    try {
        const phoneRes = await axios.get(`${PHONE_API}${phone}`, { timeout: 10000 });
        
        if (!phoneRes.data.status || !phoneRes.data.result?.length) {
            return ctx.telegram.editMessageText(
                ctx.chat.id, msg.message_id, null,
                `❌ No data found for *${phone}*`,
                { parse_mode: 'Markdown' }
            );
        }
        
        const results = phoneRes.data.result;
        let response = `✅ *Results for ${phone}*\n`;
        response += `📊 *Total Records:* ${results.length}\n\n`;
        
        results.forEach((item, i) => {
            response += `*${i+1}. ${item.full_name || 'Unknown'}*\n`;
            response += `📞 ${item.phone || 'N/A'}\n`;
            response += `🆔 ${item.cnic || 'N/A'}\n`;
            response += `📍 ${item.address || 'N/A'}\n`;
            if (i < results.length - 1) response += `──────────\n`;
        });
        
        await ctx.telegram.editMessageText(
            ctx.chat.id, msg.message_id, null,
            response,
            { parse_mode: 'Markdown' }
        );
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        
        // Mock data for phone
        if (['3336678955', '3105551234'].includes(phone)) {
            const mockData = getMockPhoneData(phone);
            await ctx.telegram.editMessageText(
                ctx.chat.id, msg.message_id, null,
                mockData,
                { parse_mode: 'Markdown' }
            );
        } else {
            await ctx.telegram.editMessageText(
                ctx.chat.id, msg.message_id, null,
                '⚠️ Connection error',
                { parse_mode: 'Markdown' }
            );
        }
    }
});

// Mock Data Functions
function getMockCNICData(cnic) {
    const mockDB = {
        '3620240739701': {
            name: 'Muhammad Ali',
            father: 'Muhammad Aslam',
            address: 'House #12, Street 5, F-8/3, Islamabad',
            dob: '15-08-1985',
            sims: [
                { number: '3001234567', operator: 'Jazz', activation: '2020-05-12' },
                { number: '3217654321', operator: 'Zong', activation: '2021-03-20' },
                { number: '3335557777', operator: 'Ufone', activation: '2022-01-15' }
            ]
        }
    };
    
    const data = mockDB[cnic];
    if (!data) return null;
    
    let response = `🆔 *CNIC:* ${cnic.slice(0,5)}-${cnic.slice(5,12)}-${cnic.slice(12)}\n`;
    response += `👤 *Name:* ${data.name}\n`;
    response += `👨 *Father:* ${data.father}\n`;
    response += `📍 *Address:* ${data.address}\n`;
    response += `📅 *DOB:* ${data.dob}\n\n`;
    response += `📱 *Registered SIMs (${data.sims.length}):*\n\n`;
    
    data.sims.forEach((sim, i) => {
        response += `${i+1}. 📞 *${sim.number}*\n`;
        response += `   📱 ${sim.operator}\n`;
        response += `   📅 ${sim.activation}\n`;
        if (i < data.sims.length - 1) response += `   ──────────\n`;
    });
    
    return response;
}

function getMockPhoneData(phone) {
    const mockDB = {
        '3336678955': [
            { full_name: 'Muhammad Ali', phone: '3336678955', cnic: '36202-4073970-1', address: 'Islamabad' }
        ],
        '3105551234': [
            { full_name: 'Sarah Khan', phone: '3105551234', cnic: '35202-4567890-1', address: 'Lahore' }
        ]
    };
    
    const results = mockDB[phone];
    if (!results) return null;
    
    let response = `✅ *Results for ${phone}*\n`;
    response += `📊 *Total Records:* ${results.length}\n\n`;
    
    results.forEach((item, i) => {
        response += `*${i+1}. ${item.full_name}*\n`;
        response += `📞 ${item.phone}\n`;
        response += `🆔 ${item.cnic}\n`;
        response += `📍 ${item.address}\n`;
    });
    
    return response;
}

bot.launch({ polling: { timeout: 30 } })
    .then(() => console.log('✅ Bot is running!'));

setInterval(() => console.log('💓 Bot alive'), 30000);
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
