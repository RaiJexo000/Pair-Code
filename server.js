const express = require('express');
const cors = require('cors');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 5000;
const sessions = {};
const commandHistory = {};

// ==================== MENU PHOTO ====================
const MENU_PHOTO_URL = "https://i.ibb.co/C3YC5VMc/file-00000000e7848211821e3506e356e373.png";

// ==================== OSINT API FUNCTIONS ====================

// 1. Number Lookup - Tabbo API
async function lookupNumber(mobile) {
    try {
        const url = `https://ethicaltabbo.in/api/lookup?key=RAIJEXO&mobile=${mobile}`;
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        return { error: error.message };
    }
}

// 2. Vehicle Lookup - Nitin API
async function lookupVehicle(reg) {
    try {
        const url = `https://nitin-api-free-user-1k-spacial.vercel.app/api?type=vehicle&search=${reg}`;
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        return { error: error.message };
    }
}

// 3. IFSC Lookup - Razorpay API
async function lookupIFSC(code) {
    try {
        const url = `https://ifsc.razorpay.com/${code}`;
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        return { error: error.message };
    }
}

// 4. IP Lookup - Nitin API
async function lookupIP(ip) {
    try {
        const url = `https://nitin-apis-the-best.vercel.app/api?type=ip&ip=${ip}`;
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        return { error: error.message };
    }
}

// 5. Weather Lookup - Nitin API
async function lookupWeather(city) {
    try {
        const url = `https://nitin-wather-check-api.vercel.app/api?type=weather&search=${city}`;
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        return { error: error.message };
    }
}

// 6. PIN Lookup - Nitin API
async function lookupPIN(pin) {
    try {
        const url = `https://nitin-api-free-user-1k-spacial.vercel.app/api?type=pincode&search=${pin}`;
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        return { error: error.message };
    }
}

// 7. Snapchat Lookup - RJ Studio API
async function lookupSnapchat(username) {
    try {
        const url = `https://snapchat-api-six.vercel.app/lookup?username=${username}&api_key=rjstudio`;
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        return { error: error.message };
    }
}

// 8. Aadhaar Lookup - Markplace API
async function lookupAadhaar(aadhaar) {
    try {
        const url = `https://markplace.site/api.php?key=raijexooff_12c49a30ba39f95e&type=aadhaar&aadhaar=${aadhaar}`;
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        return { error: error.message };
    }
}

// 9. Movie Lookup - OMDb API
const OMDB_KEY = 'cf30df24';
async function lookupMovie(title) {
    try {
        const url = `http://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${OMDB_KEY}&plot=short`;
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        return { error: error.message };
    }
}

// 10. Anime Lookup - Jikan API (No Key)
async function lookupAnime(query) {
    try {
        const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=1`;
        const response = await fetch(url);
        const data = await response.json();
        return data.data?.[0] || null;
    } catch (error) {
        return { error: error.message };
    }
}

// ==================== FORMAT OUTPUT FUNCTIONS ====================

function formatNumberOutput(data, query) {
    if (data.error) return `❌ Error: ${data.error}`;
    if (!data.status) return '❌ No data found.';
    const recs = data.data || [];
    const total = data.total_records || 0;
    let txt = `📞 Number: ${query}\n📊 Total Records: ${total}\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    recs.slice(0, 3).forEach((r, i) => {
        txt += `👤 Record #${i+1}\n• Name: ${r.name || 'N/A'}\n• Father: ${r.father_name || 'N/A'}\n• Address: ${(r.address || '').slice(0, 60)}...\n• Circle: ${r.circle || 'N/A'}\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    });
    if (total > 3) txt += `... and ${total - 3} more records.\n\n`;
    txt += '━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo';
    return txt;
}

function formatVehicleOutput(data, query) {
    if (data.error) return `❌ Error: ${data.error}`;
    if (!data.regNo) return '❌ No data found.';
    const r = data.response || {};
    return `🚗 Vehicle: ${query}\n━━━━━━━━━━━━━━━━━━━━━━\n• RTO: ${r.rtoCode || 'N/A'}\n• Manufacturer: ${r.manufacturer || 'N/A'}\n• Model: ${r.vehicle || 'N/A'}\n• Fuel: ${r.fuelType || 'N/A'}\n• Insurance: ${r.insuranceUpto || 'N/A'}\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo`;
}

function formatIFSCOutput(data, query) {
    if (data.error) return `❌ Error: ${data.error}`;
    if (!data.IFSC) return '❌ Invalid IFSC.';
    return `🏦 IFSC: ${query}\n━━━━━━━━━━━━━━━━━━━━━━\n• Bank: ${data.BANK || 'N/A'}\n• Branch: ${data.BRANCH || 'N/A'}\n• City: ${data.CITY || 'N/A'}\n• State: ${data.STATE || 'N/A'}\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo`;
}

function formatIPOutput(data, query) {
    if (data.error) return `❌ Error: ${data.error}`;
    if (!data.success) return '❌ Invalid IP.';
    return `🌐 IP: ${query}\n━━━━━━━━━━━━━━━━━━━━━━\n• City: ${data.city || 'N/A'}\n• Region: ${data.region || 'N/A'}\n• Country: ${data.country || 'N/A'}\n• ISP: ${data.isp || 'N/A'}\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo`;
}

function formatWeatherOutput(data, query) {
    if (data.error) return `❌ Error: ${data.error}`;
    if (!data.success) return '❌ City not found.';
    const cur = data.data?.current || {};
    const t = cur.temperature || {};
    return `🌤️ Weather: ${query}\n━━━━━━━━━━━━━━━━━━━━━━\n• Temp: ${t.actual_c || 'N/A'}°C (feels ${t.feels_like_c || 'N/A'}°C)\n• Humidity: ${cur.atmosphere?.humidity_percent || 'N/A'}%\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo`;
}

function formatPINOutput(data, query) {
    if (data.error) return `❌ Error: ${data.error}`;
    if (data.status !== 'success') return '❌ Invalid PIN.';
    const recs = data.records || [];
    const first = recs[0] || {};
    return `📮 PIN: ${query}\n━━━━━━━━━━━━━━━━━━━━━━\n• District: ${first.Districtname || 'N/A'}\n• State: ${first.statename || 'N/A'}\n• Total: ${recs.length} records\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo`;
}

function formatSnapchatOutput(data, query) {
    if (data.error) return `❌ Error: ${data.error}`;
    if (data.status !== 'success') return '❌ User not found.';
    return `📸 Snapchat\n━━━━━━━━━━━━━━━━━━━━━━\n• Username: ${data.username || 'N/A'}\n• Phone: ${data.number || 'N/A'}\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo`;
}

function formatAadhaarOutput(data, query) {
    if (data.error) return `❌ Error: ${data.error}`;
    if (data.status === 'error') return `❌ ${data.message || 'Invalid Aadhaar'}`;
    const result = data.result || [];
    let txt = `🆔 Aadhaar: ${query}\n📊 Records: ${result.length}\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    result.slice(0, 3).forEach((r, i) => {
        txt += `👤 Record #${i+1}\n• Name: ${r.name || 'N/A'}\n• Father: ${r.fname || 'N/A'}\n• Mobile: ${r.num || 'N/A'}\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    });
    txt += '━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo';
    return txt;
}

function formatMovieOutput(data, query) {
    if (data.error) return `❌ Error: ${data.error}`;
    if (!data.Title) return `❌ No movie found.`;
    return `🎬 ${data.Title} (${data.Year})\n━━━━━━━━━━━━━━━━━━━━━━\n⭐ IMDb: ${data.imdbRating || 'N/A'}\n📋 Genre: ${data.Genre || 'N/A'}\n📝 Plot: ${(data.Plot || '').slice(0, 100)}...\n👨‍🎤 Director: ${data.Director || 'N/A'}\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo`;
}

function formatAnimeOutput(data, query) {
    if (!data) return `❌ No anime found.`;
    if (data.error) return `❌ ${data.error}`;
    return `🎌 ${data.title || 'N/A'}\n━━━━━━━━━━━━━━━━━━━━━━\n⭐ Score: ${data.score || 'N/A'}\n📋 Type: ${data.type || 'N/A'}\n📺 Episodes: ${data.episodes || 'N/A'}\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo`;
}

// ==================== FUN COMMANDS ====================

function getJoke() {
    const jokes = [
        "Why do programmers prefer dark mode? Because light attracts bugs!",
        "What do you call a fake noodle? An impasta!",
        "Why don't scientists trust atoms? Because they make up everything!",
        "What do you call a bear with no teeth? A gummy bear!"
    ];
    return jokes[Math.floor(Math.random() * jokes.length)];
}

function getQuote() {
    const quotes = [
        "The only way to do great work is to love what you do. - Steve Jobs",
        "In the middle of difficulty lies opportunity. - Albert Einstein",
        "Success is not final, failure is not fatal. - Winston Churchill",
        "Believe you can and you're halfway there. - Theodore Roosevelt"
    ];
    return quotes[Math.floor(Math.random() * quotes.length)];
}

function getFact() {
    const facts = [
        "Honey never spoils. Archaeologists found 3000-year-old honey in Egyptian tombs!",
        "A day on Venus is longer than a year on Venus.",
        "The human nose can remember 50,000 different scents.",
        "There are more stars in the universe than grains of sand on all beaches."
    ];
    return facts[Math.floor(Math.random() * facts.length)];
}

// ==================== PROCESS COMMAND ====================

async function processCommand(command) {
    const cmd = command.trim();

    // ==================== MENU ====================
    if (cmd === '.menu') {
        return {
            type: 'menu',
            photo: MENU_PHOTO_URL,
            message: `╔═══════════════════════════════════════════╗
║  🕵️ OSINT TOOLBOX  v2.0                  ║
╚═══════════════════════════════════════════╝

👋 Welcome To OSINT TOOLBOX
BY : Kishor (RaiJexo)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 OSINT:
.num 9876543210 - Phone lookup
.vehicle RJ14CV0002 - Vehicle details
.ifsc KKBK0000261 - IFSC lookup
.ip 8.8.8.8 - IP geolocation
.weather Delhi - Weather forecast
.pin 411001 - Pincode info
.snap username - Snapchat lookup
.aadhaar 123456789012 - Aadhaar lookup

📌 FUN:
.joke - Random joke
.quote - Motivational quote
.fact - Random fact

📌 MOVIES & ANIME:
.movie Inception - Movie details
.anime Naruto - Anime details

📌 OWNER:
.owner - Bot owner info
.about - About bot
.source - Bot source

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Type any command to get started!
━━━━━━━━━━━━━━━━━━━━━━
BY @RaiJexo`
        };
    }

    // ==================== OSINT COMMANDS ====================

    if (cmd.startsWith('.num ')) {
        const query = cmd.slice(5).trim();
        if (!query) return { message: '❌ Please provide a number.' };
        const data = await lookupNumber(query);
        return { message: formatNumberOutput(data, query) };
    }

    if (cmd.startsWith('.vehicle ')) {
        const query = cmd.slice(9).trim();
        if (!query) return { message: '❌ Please provide a vehicle number.' };
        const data = await lookupVehicle(query);
        return { message: formatVehicleOutput(data, query) };
    }

    if (cmd.startsWith('.ifsc ')) {
        const query = cmd.slice(6).trim();
        if (!query) return { message: '❌ Please provide an IFSC code.' };
        const data = await lookupIFSC(query);
        return { message: formatIFSCOutput(data, query) };
    }

    if (cmd.startsWith('.ip ')) {
        const query = cmd.slice(4).trim();
        if (!query) return { message: '❌ Please provide an IP address.' };
        const data = await lookupIP(query);
        return { message: formatIPOutput(data, query) };
    }

    if (cmd.startsWith('.weather ')) {
        const query = cmd.slice(9).trim();
        if (!query) return { message: '❌ Please provide a city name.' };
        const data = await lookupWeather(query);
        return { message: formatWeatherOutput(data, query) };
    }

    if (cmd.startsWith('.pin ')) {
        const query = cmd.slice(5).trim();
        if (!query) return { message: '❌ Please provide a pincode.' };
        const data = await lookupPIN(query);
        return { message: formatPINOutput(data, query) };
    }

    if (cmd.startsWith('.snap ')) {
        const query = cmd.slice(6).trim();
        if (!query) return { message: '❌ Please provide a username.' };
        const data = await lookupSnapchat(query);
        return { message: formatSnapchatOutput(data, query) };
    }

    if (cmd.startsWith('.aadhaar ')) {
        const query = cmd.slice(9).trim();
        if (!query) return { message: '❌ Please provide an Aadhaar number.' };
        const data = await lookupAadhaar(query);
        return { message: formatAadhaarOutput(data, query) };
    }

    // ==================== FUN COMMANDS ====================

    if (cmd === '.joke') {
        return { message: `😂 Random Joke\n━━━━━━━━━━━━━━━━━━━━━━\n${getJoke()}\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo` };
    }

    if (cmd === '.quote') {
        return { message: `💬 Motivational Quote\n━━━━━━━━━━━━━━━━━━━━━━\n${getQuote()}\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo` };
    }

    if (cmd === '.fact') {
        return { message: `🔍 Random Fact\n━━━━━━━━━━━━━━━━━━━━━━\n${getFact()}\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo` };
    }

    // ==================== MOVIES & ANIME ====================

    if (cmd.startsWith('.movie ')) {
        const query = cmd.slice(7).trim();
        if (!query) return { message: '❌ Please provide a movie name.' };
        const data = await lookupMovie(query);
        return { message: formatMovieOutput(data, query) };
    }

    if (cmd.startsWith('.anime ')) {
        const query = cmd.slice(7).trim();
        if (!query) return { message: '❌ Please provide an anime name.' };
        const data = await lookupAnime(query);
        return { message: formatAnimeOutput(data, query) };
    }

    // ==================== OWNER COMMANDS ====================

    if (cmd === '.owner') {
        return { message: `👑 Bot Owner\n━━━━━━━━━━━━━━━━━━━━━━\n🧑‍💻 Name: Kishor (RaiJexo)\n🔗 GitHub: https://github.com/RaiJexo000\n📱 Telegram: @RaiJexo\n📧 Email: raijexo000@gmail.com\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo` };
    }

    if (cmd === '.about') {
        return { message: `🤖 About OSINT TOOLBOX\n━━━━━━━━━━━━━━━━━━━━━━\n🕵️ OSINT TOOLBOX v2.0\n📌 WhatsApp OSINT Bot\n\nFeatures:\n• 8+ OSINT Lookups\n• Movies & Anime\n• Fun Commands\n\n👨‍💻 Developed by: Kishor (RaiJexo)\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo` };
    }

    if (cmd === '.source') {
        return { message: `📌 Bot Source\n━━━━━━━━━━━━━━━━━━━━━━\n🔗 Source: @ApiMarket1_bot\n👨‍💻 Developer: Kishor (RaiJexo)\n📱 Telegram: @RaiJexo\n\nAPIs: Tabbo, Nitin, Razorpay, OMDb, Jikan\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo` };
    }

    return { message: `❌ Unknown command. Type .menu for help.` };
}

// ==================== WHATSAPP CONNECTION ====================

app.post('/api/generate_pair', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.json({ success: false, message: 'Phone required' });

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 8 || cleanPhone.length > 15) {
        return res.json({ success: false, message: 'Invalid phone number length' });
    }
    const finalPhone = cleanPhone.startsWith('0') ? cleanPhone.slice(1) : cleanPhone;
    console.log(`📱 Request for: ${finalPhone}`);

    try {
        const sessionId = `session_${Date.now()}`;
        const { state, saveCreds } = await useMultiFileAuthState(`auth_${sessionId}`);

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['Ubuntu', 'Chrome', '20.0.04']
        });

        sessions[sessionId] = { sock, saveCreds, phone: finalPhone, connected: false };

        // Pairing Code Method
        console.log('📱 Requesting pairing code...');
        let pairCode = null;
        try {
            pairCode = await sock.requestPairingCode(finalPhone);
            console.log(`✅ Pairing code: ${pairCode}`);
        } catch (err) {
            console.log('❌ Pairing code failed:', err.message);
            return res.json({ success: false, message: 'Pairing code failed: ' + err.message });
        }

        sock.ev.on('connection.update', (update) => {
            if (update.connection === 'open') {
                console.log(`✅ WhatsApp connected for ${finalPhone}`);
                sessions[sessionId].connected = true;
            }
            if (update.connection === 'close') {
                console.log(`❌ Connection closed for ${finalPhone}`);
                sessions[sessionId].connected = false;
            }
        });

        sock.ev.on('creds.update', saveCreds);

        return res.json({
            success: true,
            code: pairCode,
            phone: finalPhone,
            sessionId: sessionId,
            message: 'Pairing code generated. Enter it in WhatsApp.'
        });

    } catch (error) {
        console.error('❌ Error:', error);
        return res.json({ success: false, message: 'Failed: ' + error.message });
    }
});

app.get('/api/status/:sessionId', (req, res) => {
    const session = sessions[req.params.sessionId];
    if (!session) return res.json({ success: false, connected: false });
    res.json({ success: true, connected: session.connected || false, phone: session.phone });
});

app.post('/api/send', async (req, res) => {
    const { sessionId, command } = req.body;
    const session = sessions[sessionId];
    if (!session || !session.connected) {
        return res.json({ success: false, message: 'WhatsApp not connected' });
    }
    const result = await processCommand(command);
    if (!commandHistory[sessionId]) commandHistory[sessionId] = [];
    commandHistory[sessionId].push({ command, response: result.message, time: new Date().toISOString() });
    
    // If result has photo, send with photo
    if (result.photo) {
        return res.json({ success: true, result: { message: result.message, photo: result.photo, type: result.type } });
    }
    res.json({ success: true, result });
});

// ==================== WEB UI ====================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Send POST to /api/generate_pair with { "phone": "41789013338" }`);
});
