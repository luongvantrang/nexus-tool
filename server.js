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
const SECRET_KEY = "nexus_v10_super_secret_key"; // Key bảo mật
const DB_FILE = path.join(__dirname, 'users.json');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// === DATABASE SYSTEM (Tự động tạo file nếu thiếu) ===
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({}));
    console.log("Creating new users database...");
}

function getUsers() { 
    try { return JSON.parse(fs.readFileSync(DB_FILE)); } 
    catch { return {}; } 
}

function saveUser(username, password) {
    const users = getUsers();
    if (users[username]) return false; // User đã tồn tại
    
    const hashedPassword = bcrypt.hashSync(password, 8);
    users[username] = { password: hashedPassword, created: Date.now() };
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
    return true;
}

function verifyUser(username, password) {
    const users = getUsers();
    if (!users[username]) return false;
    return bcrypt.compareSync(password, users[username].password);
}

// === STATE ===
const processes = {}; // Lưu tiến trình đang chạy

// === AUTH MIDDLEWARE ===
function auth(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Vui lòng đăng nhập!' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token hết hạn, hãy đăng nhập lại!' });
        req.user = user;
        next();
    });
}

function log(id, msg, type = 'info') {
    if (!processes[id]) return;
    const time = new Date().toLocaleTimeString('en-GB');
    if (processes[id].logs.length > 50) processes[id].logs.shift();
    processes[id].logs.push({ time, msg, type });
}

// === AUTH API ===
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ success: false, msg: 'Thiếu tài khoản/mật khẩu!' });
    
    if (saveUser(username, password)) {
        res.json({ success: true, msg: 'Đăng ký thành công! Hãy đăng nhập.' });
    } else {
        res.json({ success: false, msg: 'Tài khoản đã tồn tại!' });
    }
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (verifyUser(username, password)) {
        const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '7d' });
        res.json({ success: true, token, username });
    } else {
        res.json({ success: false, msg: 'Sai tài khoản hoặc mật khẩu!' });
    }
});

// === APP API (Protected) ===
app.get('/api/status', auth, (req, res) => {
    // Chỉ trả về tiến trình của User hiện tại
    const myProcs = Object.values(processes).filter(p => p.owner === req.user.username);
    
    const list = myProcs.map(p => ({
        id: p.id,
        mask: p.token.substring(0, 10) + '****************',
        running: p.running,
        stats: p.stats,
        logs: p.logs,
        config: { ...p.config, channels: p.config.channels.length }
    }));
    res.json(list);
});

app.post('/api/start', auth, (req, res) => {
    const { tokens, channels, message, delay, count, proxy } = req.body;
    if (!tokens || !channels || !message) return res.json({ error: 'Thiếu dữ liệu!' });

    const tokenList = tokens.split('\n').map(t => t.trim()).filter(t => t);
    const channelList = channels.split(/[\n,]+/).map(c => c.trim()).filter(c => c);
    let started = 0;

    tokenList.forEach(token => {
        const id = `${req.user.username}_${token.substring(0, 10)}`; // ID gắn với User
        if (processes[id] && processes[id].running) return;

        processes[id] = {
            id, owner: req.user.username, token,
            running: true, logs: [],
            stats: { sent: 0, fail: 0, uptime: Date.now() },
            config: { channels: channelList, delay, count, proxy }
        };
        
        log(id, `🚀 Khởi chạy ${channelList.length} kênh`, 'success');
        runWorker(id, message);
        started++;
    });

    res.json({ success: true, msg: `Đã chạy ${started} token!` });
});

app.post('/api/control', auth, (req, res) => {
    const { id, action } = req.body;
    
    if (action === 'stop_all') {
        Object.values(processes).forEach(p => {
            if (p.owner === req.user.username) p.running = false;
        });
        return res.json({ success: true });
    }

    if (processes[id] && processes[id].owner === req.user.username) {
        if (action === 'delete') {
            processes[id].running = false;
            delete processes[id];
        } else if (action === 'stop') {
            processes[id].running = false;
            log(id, '🛑 Đã dừng thủ công', 'warning');
        }
    }
    res.json({ success: true });
});

// === WORKER ENGINE ===
async function runWorker(id, msgRaw) {
    const p = processes[id];
    if(!p) return;

    const msgs = msgRaw.split('\n').filter(x => x);
    let agent = null;
    if (p.config.proxy) {
        try {
            agent = new HttpsProxyAgent(p.config.proxy.startsWith('http') ? p.config.proxy : `http://${p.config.proxy}`);
        } catch(e) { log(id, 'Lỗi Proxy', 'error'); }
    }
    let ua = new UserAgent().toString();

    while (p.running) {
        for (const cid of p.config.channels) {
            if (!p.running) break;
            
            if (p.config.count > 0 && p.stats.sent >= p.config.count) {
                p.running = false;
                log(id, '✅ Hoàn thành', 'success');
                break;
            }

            const content = msgs[Math.floor(Math.random() * msgs.length)];
            try {
                // Typing
                await axios.post(`https://discord.com/api/v9/channels/${cid}/typing`, {}, {
                    headers: { authorization: p.token, 'User-Agent': ua }, httpsAgent: agent
                }).catch(()=>{});
                
                await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));

                // Send
                await axios.post(`https://discord.com/api/v9/channels/${cid}/messages`, {
                    content, nonce: Date.now().toString()
                }, {
                    headers: { authorization: p.token, 'Content-Type': 'application/json', 'User-Agent': ua },
                    httpsAgent: agent
                });

                p.stats.sent++;
                log(id, `📤 Gửi #${cid.slice(-4)}: ${content.slice(0, 10)}...`, 'success');
            } catch (e) {
                p.stats.fail++;
                const s = e.response?.status;
                if (s === 401 || s === 403) {
                    p.running = false;
                    log(id, '💀 Token Die', 'error');
                } else if (s === 429) {
                    const wait = (e.response.data.retry_after || 5) * 1000;
                    log(id, `⏳ Rate Limit ${wait/1000}s`, 'warning');
                    await new Promise(r => setTimeout(r, wait));
                } else {
                    log(id, `❌ Lỗi ${s}`, 'error');
                }
            }
            await new Promise(r => setTimeout(r, 1500)); // Delay kênh
        }
        const jitter = p.config.delay * (0.8 + Math.random() * 0.4);
        await new Promise(r => setTimeout(r, jitter * 1000));
    }
}

app.listen(3000, () => console.log('✅ SERVER ONLINE: http://localhost:3000'));
