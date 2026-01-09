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
const SECRET_KEY = "nexus_v10_super_secret_key"; // Key bảo mật JWT
const DB_FILE = path.join(__dirname, 'users.json');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// === DATABASE SYSTEM ===
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({}));
}

function getUsers() { 
    try { return JSON.parse(fs.readFileSync(DB_FILE)); } catch { return {}; } 
}

// === AUTH MIDDLEWARE ===
function auth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Vui lòng đăng nhập!' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Phiên đăng nhập hết hạn!' });
        req.user = user;
        next();
    });
}

// === CÁC API GIỮ NGUYÊN LOGIC CỦA BẠN ===
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

// Giữ nguyên các API: /api/status, /api/start, /api/control và hàm runWorker của bạn...
// [Phần code logic worker và xử lý spam đa luồng của bạn nằm ở đây]

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ SERVER ONLINE: http://localhost:${PORT}`));
