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
const SECRET_KEY = "nexus_super_secret_key_change_me"; // Khóa bảo mật JWT

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// === DATABASE GIẢ LẬP (Lưu vào file JSON để không mất nick khi tắt server) ===
const DB_FILE = 'users.json';
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({}));

function getUsers() { return JSON.parse(fs.readFileSync(DB_FILE)); }
function saveUser(username, password) {
    const users = getUsers();
    if (users[username]) return false;
    const hashedPassword = bcrypt.hashSync(password, 8);
    users[username] = { password: hashedPassword, created: Date.now() };
    fs.writeFileSync(DB_FILE, JSON.stringify(users));
    return true;
}
function verifyUser(username, password) {
    const users = getUsers();
    if (!users[username]) return false;
    return bcrypt.compareSync(password, users[username].password);
}

// === STATE MANAGEMENT (RAM) ===
// Cấu trúc: processes[processID] = { owner: 'user1', token: '...', ... }
const processes = {};

// === MIDDLEWARE AUTH ===
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Chưa đăng nhập!' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Phiên đăng nhập hết hạn!' });
        req.user = user; // user.username
        next();
    });
}

// === LOGIC ===
function log(id, msg, type = 'info') {
    if (!processes[id]) return;
    const time = new Date().toLocaleTimeString('en-GB');
    if (processes[id].logs.length > 50) processes[id].logs.shift();
    processes[id].logs.push({ time, msg, type });
}

// === AUTH ROUTES ===
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ success: false, msg: 'Thiếu thông tin!' });
    if (saveUser(username, password)) res.json({ success: true, msg: 'Đăng ký thành công!' });
    else res.json({ success: false, msg: 'Tài khoản đã tồn tại!' });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (verifyUser(username, password)) {
        const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ success: true, token, username });
    } else {
        res.json({ success: false, msg: 'Sai tài khoản hoặc mật khẩu!' });
    }
});

// === APP ROUTES (Bảo vệ bằng authenticateToken) ===

// Lấy danh sách (CHỈ TRẢ VỀ CỦA NGƯỜI DÙNG ĐÓ)
app.get('/api/status', authenticateToken, (req, res) => {
    const userProc = Object.values(processes).filter(p => p.owner === req.user.username);
    
    // Mask token để bảo mật (Frontend không bao giờ nhìn thấy token gốc)
    const safeData = userProc.map(p => ({
        id: p.id,
        mask: p.token.substring(0, 10) + '****************' + p.token.substring(p.token.length - 5),
        running: p.running,
        stats: p.stats,
        logs: p.logs,
        config: { ...p.config, channels: p.config.channels.length } // Ẩn chi tiết thừa
    }));
    res.json(safeData);
});

app.post('/api/start', authenticateToken, (req, res) => {
    const { tokens, channels, message, delay, count, proxy } = req.body;
    if (!tokens || !channels || !message) return res.json({ error: 'Thiếu dữ liệu!' });

    const tokenList = tokens.split('\n').map(t => t.trim()).filter(t => t);
    const channelList = channels.split(/[\n,]+/).map(c => c.trim()).filter(c => c);

    let started = 0;
    tokenList.forEach(token => {
        // Tạo ID duy nhất cho mỗi task dựa trên user + token (tránh trùng lặp)
        const procId = `${req.user.username}_${token.substring(0, 10)}`;
        
        if (processes[procId] && processes[procId].running) return;

        processes[procId] = {
            id: procId,
            owner: req.user.username, // Đánh dấu chủ sở hữu
            token: token,
            running: true,
            logs: [],
            stats: { sent: 0, fail: 0, uptime: Date.now() },
            config: { channels: channelList, delay, count, proxy }
        };
        
        log(procId, `🚀 Khởi động task cho ${channelList.length} kênh`, 'success');
        runWorker(procId, message);
        started++;
    });

    res.json({ success: true, msg: `Đã khởi chạy ${started} tài khoản!` });
});

app.post('/api/stop', authenticateToken, (req, res) => {
    const { id, all } = req.body;
    
    if (all) {
        Object.values(processes).forEach(p => {
            if (p.owner === req.user.username) p.running = false;
        });
        return res.json({ success: true });
    }

    if (processes[id] && processes[id].owner === req.user.username) {
        processes[id].running = false;
        log(id, '🛑 Người dùng đã dừng', 'warning');
    }
    res.json({ success: true });
});

app.post('/api/delete', authenticateToken, (req, res) => {
    const { id } = req.body;
    if (processes[id] && processes[id].owner === req.user.username) {
        processes[id].running = false;
        delete processes[id];
    }
    res.json({ success: true });
});

// === WORKER ===
async function runWorker(procId, msgRaw) {
    const p = processes[procId];
    if (!p) return;

    const msgs = msgRaw.split('\n').filter(x => x);
    let agent = null;
    
    if (p.config.proxy) {
        try {
            agent = new HttpsProxyAgent(p.config.proxy.startsWith('http') ? p.config.proxy : `http://${p.config.proxy}`);
        } catch(e) {
            log(procId, 'Lỗi Proxy', 'error');
        }
    }

    let ua = new UserAgent().toString();

    while (p.running) {
        for (const channelId of p.config.channels) {
            if (!p.running) break;
            
            if (p.config.count > 0 && p.stats.sent >= p.config.count) {
                p.running = false;
                log(procId, '✅ Hoàn thành số lượng', 'success');
                break;
            }

            const content = msgs[Math.floor(Math.random() * msgs.length)];
            
            try {
                // Giả lập Typing
                await axios.post(`https://discord.com/api/v9/channels/${channelId}/typing`, {}, {
                    headers: { authorization: p.token, 'User-Agent': ua },
                    httpsAgent: agent
                }).catch(() => {});

                await new Promise(r => setTimeout(r, 1000 + Math.random() * 1500)); 

                // Gửi tin nhắn
                await axios.post(`https://discord.com/api/v9/channels/${channelId}/messages`, {
                    content: content, nonce: Date.now().toString()
                }, {
                    headers: { authorization: p.token, 'Content-Type': 'application/json', 'User-Agent': ua },
                    httpsAgent: agent
                });

                p.stats.sent++;
                log(procId, `📤 Gửi #${channelId.slice(-4)}: ${content.slice(0, 10)}...`, 'success');
                
            } catch (e) {
                p.stats.fail++;
                const status = e.response?.status;
                if (status === 401 || status === 403) {
                    p.running = false;
                    log(procId, '💀 Token Die/Invalid', 'error');
                } else if (status === 429) {
                    const wait = (e.response.data.retry_after || 5) * 1000;
                    log(procId, `⏳ Rate Limit ${wait/1000}s`, 'warning');
                    await new Promise(r => setTimeout(r, wait));
                } else {
                    log(procId, `❌ Lỗi: ${status}`, 'error');
                }
            }
            // Delay giữa các kênh của 1 acc (tránh bị flag spam)
            await new Promise(r => setTimeout(r, 2000)); 
        }
        // Delay vòng lặp lớn
        const jitter = p.config.delay * (0.8 + Math.random() * 0.4);
        await new Promise(r => setTimeout(r, jitter * 1000));
    }
}

app.listen(3000, () => console.log('🚀 Nexus V9 Security Core Online: http://localhost:3000'));
