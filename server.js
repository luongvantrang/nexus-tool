const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');
const UserAgent = require('fake-useragent');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ============ STATE MANAGEMENT ============
const activeProcesses = {}; 

function initProcess(token) {
    if (!activeProcesses[token]) {
        activeProcesses[token] = {
            running: false,
            paused: false,
            startTime: null,
            sent: 0,
            failed: 0,
            logs: [],
            stats: { rateLimit: 0, lastMessage: "Ready", uptime: 0 }
        };
    }
}

function addLog(token, msg, type = 'info') {
    if (!activeProcesses[token]) return;
    const timestamp = new Date().toLocaleTimeString('en-GB');
    if (activeProcesses[token].logs.length > 50) activeProcesses[token].logs.shift();
    activeProcesses[token].logs.push({ time: timestamp, msg, type });
}

// ============ API ENDPOINTS ============

app.get('/api/processes', (req, res) => {
    const processList = [];
    for (const [token, data] of Object.entries(activeProcesses)) {
        const uptime = data.startTime ? Math.floor((Date.now() - data.startTime) / 1000) : 0;
        processList.push({
            token: token,
            displayToken: token.substring(0, 8) + '...' + token.substring(token.length - 4),
            running: data.running,
            paused: data.paused,
            stats: { ...data.stats, sent: data.sent, failed: data.failed, uptime },
            logs: data.logs
        });
    }
    res.json({ processes: processList });
});

app.post('/api/start', (req, res) => {
    // channelIds nhận vào là 1 mảng hoặc chuỗi cách nhau bởi dấu phẩy
    let { token, channelIds, message, delay, count, mode, proxy } = req.body;

    if (!token || !channelIds || !message) {
        return res.status(400).json({ status: 'error', msg: 'Thiếu Token, Channel hoặc Message!' });
    }

    // Xử lý danh sách channel
    let channels = [];
    if (Array.isArray(channelIds)) {
        channels = channelIds;
    } else {
        channels = channelIds.split(/[\n,]+/).map(id => id.trim()).filter(id => id);
    }

    if (channels.length === 0) return res.status(400).json({ status: 'error', msg: 'Không có ID kênh hợp lệ!' });

    initProcess(token);
    if (activeProcesses[token].running) {
        return res.json({ status: 'error', msg: 'Token này đang chạy!' });
    }

    // Reset state
    activeProcesses[token].running = true;
    activeProcesses[token].paused = false;
    activeProcesses[token].startTime = Date.now();
    activeProcesses[token].sent = 0;
    activeProcesses[token].failed = 0;
    activeProcesses[token].stats.rateLimit = 0;

    const proxyMsg = proxy ? ` | 🌐 Proxy` : '';
    addLog(token, `🚀 Chạy ${channels.length} kênh. Delay: ${delay}s${proxyMsg}`, 'info');
    res.json({ status: 'success', msg: 'Đã khởi chạy đa luồng!' });

    runSpamLoop(token, channels, message, delay, count, mode, proxy);
});

app.post('/api/control', (req, res) => {
    const { token, action } = req.body;
    
    if (!activeProcesses[token] && action !== 'stop_all') return res.json({ status: 'error', msg: 'Token không tồn tại.' });

    if (action === 'stop') {
        activeProcesses[token].running = false;
        addLog(token, '🛑 Đã dừng.', 'warning');
    } else if (action === 'pause') {
        activeProcesses[token].paused = !activeProcesses[token].paused;
        addLog(token, activeProcesses[token].paused ? '⏸️ Tạm dừng' : '▶️ Tiếp tục', 'warning');
    } else if (action === 'delete') {
        if (activeProcesses[token].running) return res.json({ status: 'error', msg: 'Hãy dừng trước khi xóa!' });
        delete activeProcesses[token];
    } else if (action === 'stop_all') {
        for (const t in activeProcesses) {
            activeProcesses[t].running = false;
            addLog(t, '🛑 Dừng tất cả.', 'warning');
        }
    }

    res.json({ status: 'success' });
});

// ============ CORE LOGIC (MULTI-CHANNEL) ============

async function runSpamLoop(token, channels, messageRaw, delay, limit, mode, proxyUrl) {
    const messages = messageRaw.split('\n').filter(m => m.trim() !== '');
    const processData = activeProcesses[token];
    let msgIndex = 0;
    
    // Proxy config
    let httpsAgent = null;
    if (proxyUrl) {
        try {
            const formattedProxy = proxyUrl.startsWith('http') ? proxyUrl : `http://${proxyUrl}`;
            httpsAgent = new HttpsProxyAgent(formattedProxy);
        } catch (e) {
            addLog(token, `❌ Lỗi Proxy: ${e.message}`, 'error');
            processData.running = false;
            return;
        }
    }

    const userAgent = new UserAgent().toString();

    while (processData.running) {
        // Xử lý từng kênh trong danh sách (Round-Robin)
        for (let i = 0; i < channels.length; i++) {
            const channelId = channels[i];

            // Kiểm tra trạng thái
            while (processData.paused && processData.running) await new Promise(r => setTimeout(r, 1000));
            if (!processData.running) break;

            // Kiểm tra giới hạn
            if (limit > 0 && processData.sent >= limit) {
                addLog(token, '✅ Đã hoàn thành chỉ tiêu.', 'success');
                processData.running = false;
                break;
            }

            const content = mode === 'random' ? messages[Math.floor(Math.random() * messages.length)] : messages[msgIndex++ % messages.length];

            try {
                // 1. Typing (Tùy chọn, giúp giống người thật hơn)
                // await axios.post(`https://discord.com/api/v9/channels/${channelId}/typing`, {}, {
                //     headers: { authorization: token, 'User-Agent': userAgent },
                //     httpsAgent: httpsAgent
                // }).catch(() => {});

                // 2. Gửi tin nhắn
                await axios.post(`https://discord.com/api/v9/channels/${channelId}/messages`, {
                    content: content,
                    nonce: Date.now().toString()
                }, {
                    headers: { 
                        authorization: token, 
                        'Content-Type': 'application/json',
                        'User-Agent': userAgent 
                    },
                    httpsAgent: httpsAgent
                });

                processData.sent++;
                processData.stats.lastMessage = content;
                // Chỉ hiện 4 ký tự cuối của Channel ID để log gọn hơn
                const chShort = channelId.slice(-4);
                addLog(token, `📤 [Kênh ...${chShort}] Sent: ${content.substring(0, 15)}...`, 'success');

                // Delay nhỏ giữa các kênh của cùng 1 acc để tránh spam quá nhanh (1-2s)
                if (channels.length > 1) await new Promise(r => setTimeout(r, 1500));

            } catch (error) {
                const status = error.response?.status;
                if (status === 401 || status === 403) {
                    addLog(token, '❌ Token Die/Kicked!', 'error');
                    processData.running = false;
                    break; 
                } else if (status === 429) {
                    const retry = (error.response.data.retry_after || 5) * 1000;
                    processData.stats.rateLimit++;
                    addLog(token, `⏳ Rate Limit: ${retry/1000}s`, 'warning');
                    await new Promise(r => setTimeout(r, retry));
                } else {
                    processData.failed++;
                    addLog(token, `❌ Lỗi [Kênh ...${channelId.slice(-4)}]: ${status}`, 'error');
                }
            }
        }
        
        if (!processData.running) break;

        // Delay chính sau khi quay vòng hết 1 lượt kênh
        const jitter = delay * (0.8 + Math.random() * 0.4); // Random +/- 20%
        await new Promise(r => setTimeout(r, jitter * 1000));
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server Multi-Target chạy tại http://localhost:${PORT}`));
