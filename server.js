const express = require('express');
const cors = require('cors');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const ytSearch = require('yt-search');
const ytdl = require('ytdl-core');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 5000;
const sessions = {};
const commandHistory = {};
const startTime = Date.now();
const antiLinkWarnings = {};

// ==================== MENU PHOTO ====================
const MENU_PHOTO_URL = "https://i.ibb.co/C3YC5VMc/file-00000000e7848211821e3506e356e373.png";

// ==================== OWNER CONFIG ====================
const OWNER_NUMBERS = [
    "917797725626",
    "41789013338"
];

// ==================== SESSION PERSISTENCE ====================
const SESSIONS_DIR = './sessions_data';
if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

function saveSessionData(sessionId, data) {
    try {
        fs.writeFileSync(`${SESSIONS_DIR}/${sessionId}.json`, JSON.stringify(data));
    } catch (e) {}
}

function loadSessionData(sessionId) {
    try {
        const file = `${SESSIONS_DIR}/${sessionId}.json`;
        if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file));
        }
    } catch (e) {}
    return null;
}

// ==================== TEMP DIRECTORIES ====================
const TEMP_DIRS = ['./temp_audio', './temp_videos', './temp_downloads'];
TEMP_DIRS.forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function cleanupTempFiles() {
    TEMP_DIRS.forEach(dir => {
        if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                if (file.endsWith('.mp3') || file.endsWith('.mp4')) {
                    try { fs.unlinkSync(path.join(dir, file)); } catch (e) {}
                }
            }
        }
    });
}
setInterval(cleanupTempFiles, 3600000);

// ==================== RECONNECT FUNCTION ====================
async function reconnectSocket(sessionId) {
    const session = sessions[sessionId];
    if (!session || session.connected) return;
    
    try {
        console.log(`🔄 Reconnecting ${session.phone}...`);
        const { state, saveCreds } = await useMultiFileAuthState(`auth_${sessionId}`);
        
        const newSock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['Ubuntu', 'Chrome', '20.0.04'],
            keepAliveIntervalMs: 30000,
            connectTimeoutMs: 60000,
        });
        
        sessions[sessionId].sock = newSock;
        
        newSock.ev.on('connection.update', (update) => {
            if (update.connection === 'open') {
                sessions[sessionId].connected = true;
                sessions[sessionId].jid = newSock.user?.id;
                console.log(`✅ Reconnected: ${session.phone}`);
            }
            if (update.connection === 'close') {
                sessions[sessionId].connected = false;
                console.log(`❌ Reconnection failed for ${session.phone}`);
            }
        });
        
        newSock.ev.on('creds.update', saveCreds);
        
    } catch (e) {
        console.log('❌ Reconnect failed:', e.message);
    }
}

// ==================== KEEP ALIVE ====================
setInterval(() => {
    Object.keys(sessions).forEach(async (sessionId) => {
        const session = sessions[sessionId];
        if (session && session.connected && session.sock) {
            try {
                await session.sock.sendPresenceUpdate('available');
                console.log(`💓 Ping sent to ${session.phone}`);
            } catch (e) {
                console.log(`⚠️ Ping failed: ${session.phone}`);
            }
        }
    });
}, 30000);

// ==================== OSINT API FUNCTIONS ====================

async function lookupNumber(mobile) {
    try {
        const url = `https://ethicaltabbo.in/api/lookup?key=RAIJEXO&mobile=${mobile}`;
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        return { error: error.message };
    }
}

async function lookupVehicle(reg) {
    try {
        const url = `https://nitin-api-free-user-1k-spacial.vercel.app/api?type=vehicle&search=${reg}`;
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        return { error: error.message };
    }
}

async function lookupIFSC(code) {
    try {
        const url = `https://ifsc.razorpay.com/${code}`;
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        return { error: error.message };
    }
}

async function lookupIP(ip) {
    try {
        const url = `https://nitin-apis-the-best.vercel.app/api?type=ip&ip=${ip}`;
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        return { error: error.message };
    }
}

async function lookupWeather(city) {
    try {
        const url = `https://nitin-wather-check-api.vercel.app/api?type=weather&search=${city}`;
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        return { error: error.message };
    }
}

async function lookupPIN(pin) {
    try {
        const url = `https://nitin-api-free-user-1k-spacial.vercel.app/api?type=pincode&search=${pin}`;
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        return { error: error.message };
    }
}

async function lookupSnapchat(username) {
    try {
        const url = `https://snapchat-api-six.vercel.app/lookup?username=${username}&api_key=rjstudio`;
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        return { error: error.message };
    }
}

async function lookupAadhaar(aadhaar) {
    try {
        const url = `https://markplace.site/api.php?key=raijexooff_12c49a30ba39f95e&type=aadhaar&aadhaar=${aadhaar}`;
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        return { error: error.message };
    }
}

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

// ==================== SONG FUNCTIONS ====================

async function getSongLyrics(songName) {
    try {
        const encodedSong = encodeURIComponent(songName);
        const response = await fetch(`https://api.lyrics.ovh/suggest/${encodedSong}`);
        const data = await response.json();
        if (!data.data || data.data.length === 0) {
            return { error: 'No songs found' };
        }
        const song = data.data[0];
        const lyricsResponse = await fetch(`https://api.lyrics.ovh/v1/${song.artist.name}/${song.title}`);
        const lyricsData = await lyricsResponse.json();
        return {
            title: song.title,
            artist: song.artist.name,
            album: song.album?.title || 'N/A',
            duration: song.duration || 'N/A',
            lyrics: lyricsData.lyrics || 'Lyrics not available'
        };
    } catch (error) {
        return { error: error.message };
    }
}

async function downloadSongWithThumbnail(songName) {
    try {
        const searchResult = await ytSearch(songName);
        const video = searchResult.videos[0];
        if (!video) return { error: 'No song found' };
        const audioPath = await downloadMP3(video.url, video.title);
        const fileSize = fs.existsSync(audioPath) ? fs.statSync(audioPath).size / (1024 * 1024) : 'N/A';
        return {
            title: video.title,
            author: video.author?.name || 'Unknown',
            duration: video.duration || 'N/A',
            thumbnail: video.thumbnail || null,
            audioPath: audioPath,
            fileSize: typeof fileSize === 'number' ? fileSize.toFixed(2) : 'N/A'
        };
    } catch (error) {
        return { error: error.message };
    }
}

async function downloadMP3(videoUrl, title) {
    const outputPath = path.join('./temp_audio', `${title.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`);
    return new Promise((resolve, reject) => {
        const stream = ytdl(videoUrl, { quality: 'highestaudio', filter: 'audioonly' });
        const writeStream = fs.createWriteStream(outputPath);
        stream.pipe(writeStream);
        writeStream.on('finish', () => resolve(outputPath));
        writeStream.on('error', reject);
        stream.on('error', reject);
    });
}

// ==================== DOWNLOAD FUNCTIONS ====================

async function downloadVideoFile(videoUrl, title) {
    const outputPath = path.join('./temp_downloads', `${title.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`);
    return new Promise((resolve, reject) => {
        const stream = ytdl(videoUrl, { quality: '18', filter: 'videoandaudio' });
        const writeStream = fs.createWriteStream(outputPath);
        stream.pipe(writeStream);
        writeStream.on('finish', () => resolve(outputPath));
        writeStream.on('error', reject);
        stream.on('error', reject);
    });
}

async function downloadByUrl(url) {
    try {
        const apiUrl = `https://vkrdownloader.org/server/?api_key=vkrdownloader&vkr=${encodeURIComponent(url)}`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        if (!data || !data.url) return { error: 'No video found' };
        let platform = 'Unknown';
        if (url.includes('instagram.com')) platform = 'Instagram';
        else if (url.includes('youtube.com')) platform = 'YouTube';
        else if (url.includes('twitter.com')) platform = 'Twitter/X';
        else if (url.includes('facebook.com')) platform = 'Facebook';
        else if (url.includes('tiktok.com')) platform = 'TikTok';
        return {
            title: data.title || 'Video',
            platform: platform,
            duration: data.duration || 'N/A',
            thumbnail: data.thumbnail || null,
            videoUrl: data.url,
            quality: data.quality || '720p',
            fileSize: data.filesize || 'N/A'
        };
    } catch (error) {
        return { error: error.message };
    }
}

async function downloadByTitle(title) {
    try {
        const searchResult = await ytSearch(title);
        const video = searchResult.videos[0];
        if (!video) return { error: 'No video found' };
        const videoPath = await downloadVideoFile(video.url, video.title);
        const fileSize = fs.existsSync(videoPath) ? fs.statSync(videoPath).size / (1024 * 1024) : 'N/A';
        return {
            title: video.title,
            platform: 'YouTube',
            author: video.author?.name || 'Unknown',
            duration: video.duration || 'N/A',
            thumbnail: video.thumbnail || null,
            videoPath: videoPath,
            fileSize: typeof fileSize === 'number' ? fileSize.toFixed(2) : 'N/A',
            quality: '720p'
        };
    } catch (error) {
        return { error: error.message };
    }
}

function isUrl(text) {
    return text.startsWith('http://') || text.startsWith('https://');
}

// ==================== FORMAT OUTPUT FUNCTIONS ====================

function formatNumberOutput(data, query) {
    if (data.error) return `❌ Error: ${data.error}`;
    if (!data.status) return '❌ No data found.';
    const recs = data.data || [];
    const total = data.total_records || 0;
    let txt = `📞 Number: ${query}\n📊 Total Records: ${total}\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    recs.slice(0, 3).forEach((r, i) => {
        txt += `👤 Record #${i+1}\n• Name: ${r.name || 'N/A'}\n• Father: ${r.father_name || 'N/A'}\n• Address: ${(r.address || '').slice(0, 60)}...\n• Circle: ${r.circle || 'N/A'}\n• ID: ${r.id || 'N/A'}\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
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

// ==================== GROUP ADMIN FUNCTIONS ====================

async function isGroupAdmin(sock, groupId, senderJid) {
    try {
        const groupMetadata = await sock.groupMetadata(groupId);
        const admins = groupMetadata.participants
            .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
            .map(p => p.id);
        return admins.includes(senderJid);
    } catch (e) {
        return false;
    }
}

function isOwner(senderJid) {
    const senderNumber = senderJid.split('@')[0];
    return OWNER_NUMBERS.includes(senderNumber);
}

// ==================== FUN COMMANDS ====================

async function getJoke() {
    try {
        const response = await axios.get('https://official-joke-api.appspot.com/random_joke');
        return `${response.data.setup}\n\n${response.data.punchline}`;
    } catch {
        return "Why do programmers prefer dark mode? Because light attracts bugs!";
    }
}

async function getQuote() {
    try {
        const response = await axios.get('https://api.quotable.io/random');
        return `"${response.data.content}"\n— ${response.data.author}`;
    } catch {
        return "The only way to do great work is to love what you do. - Steve Jobs";
    }
}

async function translateText(text) {
    try {
        const response = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|hi`);
        return response.data.responseData.translatedText || text;
    } catch {
        return text;
    }
}

// ==================== PROCESS COMMAND ====================

async function processCommand(command, sessionId, sock, jid) {
    const cmd = command.trim();

    if (cmd === '.menu') {
        return {
            type: 'menu',
            photo: MENU_PHOTO_URL,
            message: `╔═══════════════════════════════════════════╗\n║  🕵️ OSINT TOOLBOX  v2.0                  ║\n╚═══════════════════════════════════════════╝\n\n👋 Welcome To OSINT TOOLBOX\nBY : Kishor (RaiJexo) \n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📌 OSINT:\n.num 9876543210 - Phone lookup\n.vehicle RJ14CV0002 - Vehicle details\n.ifsc KKBK0000261 - IFSC lookup\n.ip 8.8.8.8 - IP geolocation\n.weather Delhi - Weather forecast\n.pin 411001 - Pincode info\n.snap username - Snapchat lookup\n.aadhaar 123456789012 - Aadhaar lookup\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📌 MOVIES & ANIME:\n.movie name - Movie details + full video\n.anime name - Anime details + full episode\n.download url/title - Download any video/reel\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📌 SONG:\n.song name - Download MP3 with thumbnail\n.lyrics name - Get lyrics + MP3 voice\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📌 FUN & UTILITY:\n.joke - Random joke\n.quote - Motivational quote\n.translate text - Hindi translate\n.ping - Check bot speed\n.uptime - Bot running time\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📌 STICKER:\n.sticker - Reply to image/video\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📌 GROUP AUTO-REPLY: (Admin + Owner only)\n.autoemoji on - Enable auto emoji reply\n.autoemoji off - Disable auto emoji reply\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📌 GROUP ADMIN: (Admin + Owner only)\n.tagall - Tag all members\n.kick @user - Remove member\n.promote @user - Make admin\n.demote @user - Remove admin\n.mute - Only admins can send\n.unmute - Everyone can send\n.groupinfo - Group details\n.profile - Profile picture\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📌 OWNER: (Owner only)\n.owner - Bot owner info\n.about - About bot\n.source - Bot source\n.broadcast msg - Send to all chats\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 Type any command to get started!\n\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo`
        };
    }

    if (cmd === '.autoemoji on' || cmd === '.autoemoji off') {
        const isAdmin = await isGroupAdmin(sock, jid, jid);
        const isOwnerUser = isOwner(jid);
        if (!isAdmin && !isOwnerUser) {
            return { message: '❌ Only group admins and owner can use this command.' };
        }
        const status = cmd === '.autoemoji on' ? 'enabled' : 'disabled';
        if (!sessions[sessionId].settings) sessions[sessionId].settings = {};
        sessions[sessionId].settings.autoEmoji = cmd === '.autoemoji on';
        return { message: `✅ Auto-emoji reply ${status} in groups!` };
    }

    // OSINT COMMANDS
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

    // MOVIES & ANIME
    if (cmd.startsWith('.movie ')) {
        const query = cmd.slice(7).trim();
        if (!query) return { message: '❌ Please provide a movie name.' };
        const data = await lookupMovie(query);
        return { message: `🎬 ${data.Title} (${data.Year})\n━━━━━━━━━━━━━━━━━━━━━━\n⭐ IMDb: ${data.imdbRating || 'N/A'}\n📋 Genre: ${data.Genre || 'N/A'}\n📝 Plot: ${(data.Plot || '').slice(0, 150)}...\n👨‍🎤 Director: ${data.Director || 'N/A'}\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo` };
    }
    if (cmd.startsWith('.anime ')) {
        const query = cmd.slice(7).trim();
        if (!query) return { message: '❌ Please provide an anime name.' };
        const data = await lookupAnime(query);
        if (!data) return { message: '❌ No anime found.' };
        return { message: `🎌 ${data.title}\n━━━━━━━━━━━━━━━━━━━━━━\n⭐ Score: ${data.score || 'N/A'}\n📋 Type: ${data.type || 'N/A'}\n📺 Episodes: ${data.episodes || 'N/A'}\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo` };
    }

    // SONG
    if (cmd.startsWith('.song ')) {
        const query = cmd.slice(6).trim();
        if (!query) return { message: '❌ Please provide a song name.' };
        const result = await downloadSongWithThumbnail(query);
        if (result.error) return { message: `❌ ${result.error}` };
        const duration = typeof result.duration === 'number' ? `${Math.floor(result.duration/60)}m ${Math.floor(result.duration%60)}s` : result.duration;
        return {
            type: 'song',
            thumbnail: result.thumbnail,
            title: result.title,
            author: result.author,
            duration: duration,
            fileSize: result.fileSize,
            audioPath: result.audioPath,
            message: `🎵 ${result.title}\n━━━━━━━━━━━━━━━━━━━━━━\n👨‍🎤 Artist: ${result.author}\n⏱️ Duration: ${duration}\n📁 Size: ${result.fileSize} MB\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo`
        };
    }
    if (cmd.startsWith('.lyrics ')) {
        const query = cmd.slice(8).trim();
        if (!query) return { message: '❌ Please provide a song name.' };
        const result = await getSongLyrics(query);
        if (result.error) return { message: `❌ ${result.error}` };
        return { message: `🎵 ${result.title}\n━━━━━━━━━━━━━━━━━━━━━━\n👨‍🎤 Artist: ${result.artist}\n💿 Album: ${result.album}\n⏱️ Duration: ${result.duration}\n\n📝 Lyrics:\n${result.lyrics.slice(0, 3000)}${result.lyrics.length > 3000 ? '\n\n... (lyrics trimmed)' : ''}\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo` };
    }

    // DOWNLOAD
    if (cmd.startsWith('.download ')) {
        const query = cmd.slice(10).trim();
        if (!query) return { message: '❌ Please provide a URL or title.' };
        let result;
        if (isUrl(query)) {
            result = await downloadByUrl(query);
        } else {
            result = await downloadByTitle(query);
        }
        if (result.error) return { message: `❌ ${result.error}` };
        return {
            type: 'download',
            thumbnail: result.thumbnail,
            title: result.title,
            platform: result.platform,
            duration: result.duration,
            fileSize: result.fileSize,
            quality: result.quality,
            videoPath: result.videoPath,
            videoUrl: result.videoUrl,
            message: `🎬 ${result.title}\n━━━━━━━━━━━━━━━━━━━━━━\n📺 Platform: ${result.platform}\n⏱️ Duration: ${result.duration}\n📁 Size: ${result.fileSize} MB\n📊 Quality: ${result.quality}\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo`
        };
    }

    // FUN & UTILITY
    if (cmd === '.joke') {
        const joke = await getJoke();
        return { message: `😂 Random Joke\n━━━━━━━━━━━━━━━━━━━━━━\n${joke}\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo` };
    }
    if (cmd === '.quote') {
        const quote = await getQuote();
        return { message: `💬 Motivational Quote\n━━━━━━━━━━━━━━━━━━━━━━\n${quote}\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo` };
    }
    if (cmd === '.ping') {
        return { message: `🏓 Pong!\n━━━━━━━━━━━━━━━━━━━━━━\nBot is running fine.\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo` };
    }
    if (cmd === '.uptime') {
        const diff = Math.floor((Date.now() - startTime) / 1000);
        const days = Math.floor(diff / 86400);
        const hours = Math.floor((diff % 86400) / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;
        return { message: `⏱️ Uptime\n━━━━━━━━━━━━━━━━━━━━━━\n${days}d ${hours}h ${minutes}m ${seconds}s\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo` };
    }
    if (cmd.startsWith('.translate ')) {
        const text = cmd.slice(10).trim();
        if (!text) return { message: '❌ Please provide text to translate.' };
        const translated = await translateText(text);
        return { message: `🌐 Translation\n━━━━━━━━━━━━━━━━━━━━━━\nOriginal: ${text}\nHindi: ${translated}\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo` };
    }
    if (cmd === '.sticker' || cmd === '.s') {
        return { type: 'sticker', message: '🔄 Send image/video to create sticker' };
    }

    // GROUP ADMIN
    if (cmd === '.tagall') return { type: 'tagall', message: '📢 Tagging all members...' };
    if (cmd.startsWith('.kick ')) {
        const user = cmd.slice(6).trim();
        if (!user) return { message: '❌ Please mention a user to kick.' };
        return { type: 'kick', user };
    }
    if (cmd.startsWith('.promote ')) {
        const user = cmd.slice(8).trim();
        if (!user) return { message: '❌ Please mention a user to promote.' };
        return { type: 'promote', user };
    }
    if (cmd.startsWith('.demote ')) {
        const user = cmd.slice(8).trim();
        if (!user) return { message: '❌ Please mention a user to demote.' };
        return { type: 'demote', user };
    }
    if (cmd === '.mute') return { type: 'mute', message: '🔇 Muting group...' };
    if (cmd === '.unmute') return { type: 'unmute', message: '🔊 Unmuting group...' };
    if (cmd === '.groupinfo') return { type: 'groupinfo', message: '📋 Getting group info...' };
    if (cmd === '.profile') return { type: 'profile', message: '📸 Getting profile picture...' };

    // OWNER
    if (cmd === '.owner') {
        return { message: `👑 Bot Owners\n━━━━━━━━━━━━━━━━━━━━━━\n🧑‍💻 Owner 1: Kishor (RaiJexo)\n📱 +91 7797725626\n\n🧑‍💻 Owner 2: \n📱 +41 78 901 33 38\n\n🔗 GitHub: https://github.com/RaiJexo000\n📧 Email: raijexo000@gmail.com\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo` };
    }
    if (cmd === '.about') {
        return { message: `🤖 About OSINT TOOLBOX\n━━━━━━━━━━━━━━━━━━━━━━\n🕵️ OSINT TOOLBOX v2.0\n📌 WhatsApp OSINT Bot\n\nFeatures:\n• 8+ OSINT Lookups\n• Movies & Anime\n• Song & Lyrics\n• Sticker Maker\n• Group Admin Tools\n• Auto-Reply with Emojis\n• Broadcast\n\n👨‍💻 Developed by: Kishor (RaiJexo)\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo` };
    }
    if (cmd === '.source') {
        return { message: `📌 Bot Source\n━━━━━━━━━━━━━━━━━━━━━━\n🔗 Source: @ApiMarket1_bot\n👨‍💻 Developer: Kishor (RaiJexo)\n📱 Telegram: @RaiJexo\n\nAPIs: Tabbo, Nitin, Razorpay, OMDb, Jikan\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo` };
    }
    if (cmd.startsWith('.broadcast ')) {
        const text = cmd.slice(11).trim();
        if (!text) return { message: '❌ Please provide a message to broadcast.' };
        return { type: 'broadcast', message: text };
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

    try {
        const sessionId = `session_${Date.now()}`;
        const { state, saveCreds } = await useMultiFileAuthState(`auth_${sessionId}`);

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['Ubuntu', 'Chrome', '20.0.04'],
            keepAliveIntervalMs: 30000,
            connectTimeoutMs: 60000,
            qrTimeout: 120000,
        });

        sessions[sessionId] = { 
            sock, 
            saveCreds, 
            phone: finalPhone, 
            connected: false, 
            jid: null,
            reconnectAttempts: 0,
            settings: {}
        };

        let pairCode = null;
        try {
            pairCode = await sock.requestPairingCode(finalPhone);
            console.log(`✅ Pairing code: ${pairCode}`);
        } catch (err) {
            return res.json({ success: false, message: 'Pairing code failed: ' + err.message });
        }

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            console.log(`📡 Connection update: ${connection}`);
            
            if (connection === 'open') {
                console.log(`✅ WhatsApp connected for ${finalPhone}`);
                sessions[sessionId].connected = true;
                sessions[sessionId].jid = sock.user?.id || 'status@broadcast';
                sessions[sessionId].reconnectAttempts = 0;
            }
            
            if (connection === 'close') {
                console.log(`❌ Connection closed for ${finalPhone}`);
                sessions[sessionId].connected = false;
                
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(`📊 Status code: ${statusCode}`);
                
                if (statusCode !== 401 && statusCode !== 403) {
                    const attempts = sessions[sessionId].reconnectAttempts || 0;
                    if (attempts < 5) {
                        console.log(`🔄 Reconnect attempt ${attempts + 1}/5...`);
                        sessions[sessionId].reconnectAttempts = attempts + 1;
                        setTimeout(() => {
                            reconnectSocket(sessionId);
                        }, 5000 * (attempts + 1));
                    }
                }
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
    if (!session) {
        return res.json({ 
            success: false, 
            connected: false,
            message: 'Session not found'
        });
    }
    res.json({ 
        success: true, 
        connected: session.connected || false, 
        phone: session.phone,
        jid: session.jid,
        reconnectAttempts: session.reconnectAttempts || 0,
        timestamp: new Date().toISOString()
    });
});

// ==================== SEND COMMAND ====================

app.post('/api/send', async (req, res) => {
    const { sessionId, command } = req.body;
    const session = sessions[sessionId];
    if (!session || !session.connected) {
        return res.json({ success: false, message: 'WhatsApp not connected' });
    }

    const sock = session.sock;
    const jid = session.jid;
    const senderJid = jid;

    if (!sock || !jid) {
        return res.json({ success: false, message: 'Session not ready.' });
    }

    // Processing message
    let subject = command;
    if (command.includes(' ')) {
        subject = command.split(' ').slice(1).join(' ');
    }
    if (!command.startsWith('.menu')) {
        try {
            await sock.sendMessage(jid, { text: `⏳ Processing For ${subject || command}...` });
        } catch (e) {}
    }

    const result = await processCommand(command, sessionId, sock, jid);

    // GROUP ADMIN VERIFICATION
    const isAdmin = await isGroupAdmin(sock, jid, senderJid);
    const isOwnerUser = isOwner(senderJid);
    const isAdminOrOwner = isAdmin || isOwnerUser;

    // Group Admin commands
    if (result.type === 'tagall') {
        if (!isAdminOrOwner) return res.json({ success: false, message: '❌ Only group admins and owner can use this command.' });
        try {
            const metadata = await sock.groupMetadata(jid);
            const participants = metadata.participants.map(p => p.id);
            let text = '📢 *Tag All Members*\n\n';
            participants.forEach(p => { text += `@${p.split('@')[0]} `; });
            await sock.sendMessage(jid, { text, mentions: participants });
            return res.json({ success: true, result: { message: '✅ Tagged all members!' } });
        } catch (e) {
            return res.json({ success: false, message: '❌ Failed: ' + e.message });
        }
    }

    if (result.type === 'kick') {
        if (!isAdminOrOwner) return res.json({ success: false, message: '❌ Only group admins and owner can use this command.' });
        try {
            const user = result.user.replace('@', '') + '@s.whatsapp.net';
            await sock.groupParticipantsUpdate(jid, [user], 'remove');
            return res.json({ success: true, result: { message: `✅ ${result.user} removed!` } });
        } catch (e) {
            return res.json({ success: false, message: '❌ Failed: ' + e.message });
        }
    }

    if (result.type === 'promote') {
        if (!isAdminOrOwner) return res.json({ success: false, message: '❌ Only group admins and owner can use this command.' });
        try {
            const user = result.user.replace('@', '') + '@s.whatsapp.net';
            await sock.groupParticipantsUpdate(jid, [user], 'promote');
            return res.json({ success: true, result: { message: `✅ ${result.user} promoted!` } });
        } catch (e) {
            return res.json({ success: false, message: '❌ Failed: ' + e.message });
        }
    }

    if (result.type === 'demote') {
        if (!isAdminOrOwner) return res.json({ success: false, message: '❌ Only group admins and owner can use this command.' });
        try {
            const user = result.user.replace('@', '') + '@s.whatsapp.net';
            await sock.groupParticipantsUpdate(jid, [user], 'demote');
            return res.json({ success: true, result: { message: `✅ ${result.user} demoted!` } });
        } catch (e) {
            return res.json({ success: false, message: '❌ Failed: ' + e.message });
        }
    }

    if (result.type === 'mute') {
        if (!isAdminOrOwner) return res.json({ success: false, message: '❌ Only group admins and owner can use this command.' });
        try {
            await sock.groupSettingUpdate(jid, 'announcement');
            return res.json({ success: true, result: { message: '🔇 Group muted! Only admins can send.' } });
        } catch (e) {
            return res.json({ success: false, message: '❌ Failed: ' + e.message });
        }
    }

    if (result.type === 'unmute') {
        if (!isAdminOrOwner) return res.json({ success: false, message: '❌ Only group admins and owner can use this command.' });
        try {
            await sock.groupSettingUpdate(jid, 'not_announcement');
            return res.json({ success: true, result: { message: '🔊 Group unmuted! Everyone can send.' } });
        } catch (e) {
            return res.json({ success: false, message: '❌ Failed: ' + e.message });
        }
    }

    if (result.type === 'groupinfo') {
        if (!isAdminOrOwner) return res.json({ success: false, message: '❌ Only group admins and owner can use this command.' });
        try {
            const metadata = await sock.groupMetadata(jid);
            const info = `📋 Group Info\n━━━━━━━━━━━━━━━━━━━━━━\nName: ${metadata.subject}\nMembers: ${metadata.participants.length}\nCreated: ${new Date(metadata.creation).toLocaleDateString()}\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo`;
            return res.json({ success: true, result: { message: info } });
        } catch (e) {
            return res.json({ success: false, message: '❌ Failed: ' + e.message });
        }
    }

    if (result.type === 'profile') {
        if (!isAdminOrOwner) return res.json({ success: false, message: '❌ Only group admins and owner can use this command.' });
        try {
            const ppUrl = await sock.profilePictureUrl(jid, 'image');
            return res.json({ success: true, result: { message: '📸 Profile Picture', photo: ppUrl } });
        } catch (e) {
            return res.json({ success: false, message: '❌ No profile picture found.' });
        }
    }

    // BROADCAST (Owner only)
    if (result.type === 'broadcast') {
        if (!isOwnerUser) {
            return res.json({ success: false, message: '❌ Only bot owner can use broadcast command.' });
        }
        try {
            const chats = await sock.chats();
            let sent = 0, failed = 0;
            for (const chat of chats) {
                try {
                    await sock.sendMessage(chat.id, { text: `📢 *Broadcast*\n\n${result.message}\n\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo` });
                    sent++;
                } catch (e) { failed++; }
            }
            return res.json({ success: true, result: { message: `📢 Broadcast Complete!\n━━━━━━━━━━━━━━━━━━━━━━\n✅ Sent: ${sent}\n❌ Failed: ${failed}\n━━━━━━━━━━━━━━━━━━━━━━\nBY @RaiJexo` } });
        } catch (e) {
            return res.json({ success: false, message: '❌ Broadcast failed: ' + e.message });
        }
    }

    // SONG with thumbnail + audio
    if (result.type === 'song') {
        try {
            if (result.thumbnail) {
                const thumbBuffer = await fetch(result.thumbnail).then(r => r.buffer());
                await sock.sendMessage(jid, { image: thumbBuffer, caption: result.message });
            } else {
                await sock.sendMessage(jid, { text: result.message });
            }
            if (result.audioPath && fs.existsSync(result.audioPath)) {
                await sock.sendMessage(jid, {
                    audio: { url: result.audioPath },
                    mimetype: 'audio/mpeg',
                    fileName: `${result.title}.mp3`
                });
                try { fs.unlinkSync(result.audioPath); } catch (e) {}
            }
            return res.json({ success: true, result: { message: '✅ Song sent!' } });
        } catch (e) {
            return res.json({ success: false, message: '❌ Failed: ' + e.message });
        }
    }

    // DOWNLOAD with thumbnail + video
    if (result.type === 'download') {
        try {
            if (result.thumbnail) {
                const thumbBuffer = await fetch(result.thumbnail).then(r => r.buffer());
                await sock.sendMessage(jid, { image: thumbBuffer, caption: result.message });
            } else {
                await sock.sendMessage(jid, { text: result.message });
            }
            let videoPath = result.videoPath;
            if (!videoPath && result.videoUrl) {
                videoPath = await downloadVideoFile(result.videoUrl, result.title);
            }
            if (videoPath && fs.existsSync(videoPath)) {
                await sock.sendMessage(jid, { video: { url: videoPath }, caption: `🎬 ${result.title}` });
                try { fs.unlinkSync(videoPath); } catch (e) {}
            }
            return res.json({ success: true, result: { message: '✅ Video sent!' } });
        } catch (e) {
            return res.json({ success: false, message: '❌ Failed: ' + e.message });
        }
    }

    // MENU with photo
    if (result.type === 'menu') {
        try {
            if (result.photo) {
                const photoBuffer = await fetch(result.photo).then(r => r.buffer());
                await sock.sendMessage(jid, { image: photoBuffer, caption: result.message });
            } else {
                await sock.sendMessage(jid, { text: result.message });
            }
            return res.json({ success: true, result: { message: '✅ Menu sent!' } });
        } catch (e) {
            return res.json({ success: false, message: '❌ Failed: ' + e.message });
        }
    }

    // Normal response
    if (result.photo) {
        try {
            const photoBuffer = await fetch(result.photo).then(r => r.buffer());
            await sock.sendMessage(jid, { image: photoBuffer, caption: result.message });
        } catch (e) {
            await sock.sendMessage(jid, { text: result.message });
        }
        return res.json({ success: true, result: { message: result.message } });
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
