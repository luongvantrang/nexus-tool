const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname)); // Phục vụ file trong thư mục public

// ... Code cũ ...
app.use(express.static('public'));

// === THÊM ĐOẠN NÀY VÀO ===
app.get('/', (req, res) => {
    // Kiểm tra xem file index.html nằm ở đâu
    // Trường hợp 1: Nếu bạn để trong thư mục public (khuyên dùng)
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
    
    // Trường hợp 2: Nếu bạn lỡ để index.html ngay bên ngoài (cùng cấp server.js)
    // Thì đổi dòng trên thành: res.sendFile(path.join(__dirname, 'index.html'));
});
// ==========================

// ... Các API khác giữ nguyên ...

// ============ STATE MANAGEMENT ============
// Lưu trữ trạng thái các tiến trình đang chạy
const activeProcesses = {}; 

// Hàm khởi tạo dữ liệu cho một token mới
function initProcess(token) {
    if (!activeProcesses[token]) {
        activeProcesses[token] = {
            running: false,
            paused: false,
            startTime: null,
            sent: 0,
            failed: 0,
            logs: [],
            stats: {
                rateLimit: 0,
                lastMessage: "Chưa gửi tin nào",
                uptime: 0
            }
        };
    }
}

// Hàm ghi log
function addLog(token, msg, type = 'info') {
    if (!activeProcesses[token]) return;
    const timestamp = new Date().toLocaleTimeString();
    
    // Giữ lại tối đa 20 log gần nhất để tránh tràn bộ nhớ
    if (activeProcesses[token].logs.length > 20) {
        activeProcesses[token].logs.shift();
    }
    
    activeProcesses[token].logs.push({ time: timestamp, msg, type });
    console.log(`[${token.slice(0, 5)}...] ${msg}`);
}

// ============ API ENDPOINTS ============

// 1. Lấy danh sách tiến trình để hiển thị lên Web
app.get('/api/processes', (req, res) => {
    const processList = [];
    for (const [token, data] of Object.entries(activeProcesses)) {
        // Tính toán uptime
        const uptime = data.startTime ? Math.floor((Date.now() - data.startTime) / 1000) : 0;
        
        processList.push({
            token: token,
            displayToken: token.slice(0, 15) + '...', // Che bớt token
            running: data.running,
            paused: data.paused,
            stats: {
                sent: data.sent,
                failed: data.failed,
                rateLimit: data.stats.rateLimit,
                uptime: uptime
            },
            logs: data.logs
        });
    }
    res.json({ processes: processList });
});

// 2. Bắt đầu Spam
app.post('/api/start', (req, res) => {
    const { token, channelId, message, delay, count, mode } = req.body;

    if (!token || !channelId || !message) {
        return res.status(400).json({ status: 'error', msg: 'Thiếu thông tin bắt buộc!' });
    }

    initProcess(token);

    if (activeProcesses[token].running) {
        return res.json({ status: 'error', msg: 'Tiến trình này đang chạy rồi!' });
    }

    // Reset trạng thái
    activeProcesses[token].running = true;
    activeProcesses[token].paused = false;
    activeProcesses[token].startTime = Date.now();
    activeProcesses[token].sent = 0;
    activeProcesses[token].failed = 0;
    activeProcesses[token].stats.rateLimit = 0;

    addLog(token, `🚀 Bắt đầu spam. Delay: ${delay}s. Mode: ${mode}`, 'info');
    res.json({ status: 'success', msg: 'Đã khởi chạy thành công!' });

    // Gọi hàm xử lý spam (Chạy ngầm)
    runSpamLoop(token, channelId, message, delay, count, mode);
});

// 3. Dừng Spam
app.post('/api/stop', (req, res) => {
    const { token } = req.body;
    if (activeProcesses[token]) {
        activeProcesses[token].running = false;
        addLog(token, '🛑 Đã nhận lệnh dừng.', 'warning');
        return res.json({ status: 'success', msg: 'Đã dừng tiến trình.' });
    }
    res.json({ status: 'error', msg: 'Không tìm thấy tiến trình.' });
});

// 4. Tạm dừng / Tiếp tục
app.post('/api/pause', (req, res) => {
    const { token } = req.body;
    if (activeProcesses[token]) {
        activeProcesses[token].paused = !activeProcesses[token].paused;
        const status = activeProcesses[token].paused ? 'Tạm dừng' : 'Tiếp tục';
        addLog(token, `⏯️ Đã ${status}`, 'warning');
        return res.json({ status: 'success', msg: `Đã ${status}` });
    }
    res.json({ status: 'error', msg: 'Không tìm thấy tiến trình.' });
});

// 5. Xóa tiến trình khỏi danh sách
app.post('/api/delete', (req, res) => {
    const { token } = req.body;
    if (activeProcesses[token]) {
        if (activeProcesses[token].running) {
            return res.json({ status: 'error', msg: 'Hãy dừng tiến trình trước khi xóa!' });
        }
        delete activeProcesses[token];
        return res.json({ status: 'success', msg: 'Đã xóa tiến trình.' });
    }
    res.json({ status: 'error', msg: 'Không tìm thấy.' });
});

// ============ SPAM LOGIC (CORE) ============

async function runSpamLoop(token, channelId, messageRaw, delay, limit, mode) {
    // Chuẩn bị danh sách tin nhắn
    const messages = messageRaw.split('\n').filter(m => m.trim() !== '');
    if (messages.length === 0) return;

    let messageIndex = 0;
    const processData = activeProcesses[token];

    while (processData.running) {
        // 1. Kiểm tra Tạm dừng
        while (processData.paused && processData.running) {
            await new Promise(r => setTimeout(r, 1000));
        }
        if (!processData.running) break;

        // 2. Kiểm tra giới hạn số lượng
        if (limit > 0 && processData.sent >= limit) {
            addLog(token, `✅ Đã gửi đủ ${limit} tin nhắn.`, 'success');
            processData.running = false;
            break;
        }

        // 3. Chọn nội dung tin nhắn
        let content = "";
        if (mode === 'random') {
            content = messages[Math.floor(Math.random() * messages.length)];
        } else {
            content = messages[messageIndex % messages.length];
            messageIndex++;
        }

        // Thêm ký tự ẩn để tránh Discord chặn tin nhắn trùng lặp
        // content += ' \u200B'; 

        try {
            // A. Giả lập Typing (User-like behavior)
            await axios.post(`https://discord.com/api/v9/channels/${channelId}/typing`, {}, {
                headers: { authorization: token }
            }).catch(() => {}); // Bỏ qua lỗi typing

            // B. Gửi tin nhắn
            await axios.post(`https://discord.com/api/v9/channels/${channelId}/messages`, {
                content: content,
                nonce: Date.now().toString() // Nonce để tránh trùng lặp request
            }, {
                headers: { 
                    authorization: token,
                    'Content-Type': 'application/json'
                }
            });

            // Cập nhật trạng thái thành công
            processData.sent++;
            processData.stats.lastMessage = content;
            addLog(token, `📤 Sent: ${content.substring(0, 30)}...`, 'success');

        } catch (error) {
            const status = error.response?.status;
            
            if (status === 401) {
                addLog(token, '❌ Token không hợp lệ hoặc đã chết!', 'error');
                processData.running = false; // Dừng luôn
                break;
            } else if (status === 429) {
                // Rate Limit - Quan trọng
                const retryAfter = error.response.data.retry_after;
                processData.stats.rateLimit++;
                addLog(token, `⏳ Rate Limit! Đợi ${retryAfter}s...`, 'warning');
                await new Promise(r => setTimeout(r, retryAfter * 1000));
            } else {
                processData.failed++;
                addLog(token, `❌ Lỗi ${status}: ${error.message}`, 'error');
            }
        }

        // 4. Delay thông minh (Random Jitter)
        // Delay gốc + random 0-20% để tránh bị bot detect
        const baseDelay = delay * 1000;
        const jitter = Math.random() * (baseDelay * 0.2);
        const actualDelay = baseDelay + jitter;

        await new Promise(r => setTimeout(r, actualDelay));
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`));
