const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');
const UserAgent = require('fake-useragent');

const app = express();
const SECRET_KEY = "nexus_v10_super_secret_key"; 
const DB_FILE = path.join(__dirname, 'users.json');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Khởi tạo Database người dùng
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({}));
}

function getUsers() { 
    try { return JSON.parse(fs.readFileSync(DB_FILE)); } 
    catch { return {}; } 
}

// Middleware xác thực JWT
function auth(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Vui lòng đăng nhập!' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Phiên đăng nhập hết hạn!' });
        req.user = user;
        next();
    });
}

const processes = {}; // Lưu trữ tiến trình trong RAM

function log(id, msg, type = 'info') {
    if (!processes[id]) return;
    const time = new Date().toLocaleTimeString('en-GB');
    if (processes[id].logs.length > 50) processes[id].logs.shift();
    processes[id].logs.push({ time, msg, type });
}

// --- API AUTH ---
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    const users = getUsers();
    if (users[username]) return res.json({ success: false, msg: 'Tài khoản đã tồn tại!' });
    
    users[username] = { password: bcrypt.hashSync(password, 8), created: Date.now() };
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
    res.json({ success: true, msg: 'Đăng ký thành công!' });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = getUsers();
    if (users[username] && bcrypt.compareSync(password, users[username].password)) {
        const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '7d' });
        res.json({ success: true, token, username });
    } else {
        res.json({ success: false, msg: 'Sai tài khoản hoặc mật khẩu!' });
    }
});

// --- API TOOL (Đã cô lập dữ liệu theo User) ---
app.get('/api/status', auth, (req, res) => {
    const myProcs = Object.values(processes).filter(p => p.owner === req.user.username);
    res.json(myProcs.map(p => ({
        id: p.id,
        mask: p.token.substring(0, 10) + '****************', // Bảo mật token
        running: p.running,
        stats: p.stats,
        logs: p.logs,
        config: { ...p.config, channels: p.config.channels.length }
    })));
});

app.post('/api/start', auth, (req, res) => {
    const { tokens, channels, message, delay, count, proxy } = req.body;
    const tokenList = tokens.split('\n').map(t => t.trim()).filter(t => t);
    const channelList = channels.split(/[\n,]+/).map(c => c.trim()).filter(c => c);

    tokenList.forEach(token => {
        const id = `${req.user.username}_${token.substring(0, 10)}`;
        if (processes[id] && processes[id].running) return;

        processes[id] = {
            id, owner: req.user.username, token,
            running: true, logs: [],
            stats: { sent: 0, fail: 0, uptime: Date.now() },
            config: { channels: channelList, delay, count, proxy }
        };
        runWorker(id, message);
    });
    res.json({ success: true, msg: `Đã khởi chạy ${tokenList.length} tài khoản!` });
});

app.post('/api/control', auth, (req, res) => {
    const { id, action } = req.body;
    if (action === 'stop_all') {
        Object.values(processes).forEach(p => { if (p.owner === req.user.username) p.running = false; });
    } else if (processes[id] && processes[id].owner === req.user.username) {
        processes[id].running = false;
        if (action === 'delete') delete processes[id];
    }
    res.json({ success: true });
});

// --- CORE WORKER ENGINE ---
async function runWorker(id, msgRaw) {
    const p = processes[id];
    const msgs = msgRaw.split('\n').filter(x => x);
    let agent = p.config.proxy ? new HttpsProxyAgent(p.config.proxy) : null;
    let ua = new UserAgent().toString();

    while (p.running) {
        for (const cid of p.config.channels) {
            if (!p.running) break;
            try {
                // Typing effect
                await axios.post(`https://discord.com/api/v9/channels/${cid}/typing`, {}, {
                    headers: { authorization: p.token, 'User-Agent': ua }, httpsAgent: agent
                }).catch(()=>{});
                
                await new Promise(r => setTimeout(r, 1500));

                const content = msgs[Math.floor(Math.random() * msgs.length)];
                await axios.post(`https://discord.com/api/v9/channels/${cid}/messages`, {
                    content, nonce: Date.now().toString()
                }, {
                    headers: { authorization: p.token, 'Content-Type': 'application/json', 'User-Agent': ua },
                    httpsAgent: agent
                });

                p.stats.sent++;
                log(id, `📤 Gửi thành công kênh ...${cid.slice(-4)}`, 'success');
            } catch (e) {
                p.stats.fail++;
                if (e.response?.status === 429) {
                    const wait = (e.response.data.retry_after || 5) * 1000;
                    log(id, `⏳ Rate Limit! Chờ ${wait/1000}s`, 'warning');
                    await new Promise(r => setTimeout(r, wait));
                }
            }
            await new Promise(r => setTimeout(r, 2000));
        }
        await new Promise(r => setTimeout(r, p.config.delay * 1000));
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ NEXUS v10 ONLINE: http://localhost:${PORT}`));
