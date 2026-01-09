const express = require("express");
const cors = require("cors");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const fs = require("fs");

const app = express();

// ====== CONFIG ======
const SECRET_KEY = process.env.SECRET_KEY || "nexus_v10_super_secret_key";
const DB_FILE = path.join(__dirname, "users.json");
const PUBLIC_DIR = path.join(__dirname, "public");

// ====== MIDDLEWARE ======
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Serve static UI
app.use(express.static(PUBLIC_DIR));

// Fix "Cannot GET /"
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// Health check (Render friendly)
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, ts: Date.now() });
});

// ====== DB ======
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({}, null, 2));
  console.log("✅ Created users.json");
}

function getUsers() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveUser(username, password) {
  const users = getUsers();
  if (users[username]) return false;

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

// ====== AUTH MIDDLEWARE ======
function auth(req, res, next) {
  const raw = req.headers["authorization"] || "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : "";

  if (!token) return res.status(401).json({ error: "Vui lòng đăng nhập!" });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: "Token hết hạn, hãy đăng nhập lại!" });
    req.user = user;
    next();
  });
}

// ====== SIMPLE IN-MEM STATE (demo) ======
// NOTE: Đây chỉ là khung trạng thái để UI hiển thị.
// Mình không triển khai “worker gửi Discord” vì lý do an toàn/chính sách.
const processes = {};

function createProc(owner, name) {
  const id = `${owner}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  processes[id] = {
    id,
    owner,
    name: name || "job",
    running: true,
    logs: [{ time: new Date().toLocaleTimeString("en-GB"), msg: "✅ Started", type: "success" }],
    stats: { ok: 0, fail: 0, uptime: Date.now() }
  };
  return processes[id];
}

function addLog(id, msg, type = "info") {
  if (!processes[id]) return;
  const time = new Date().toLocaleTimeString("en-GB");
  processes[id].logs.push({ time, msg, type });
  if (processes[id].logs.length > 80) processes[id].logs.shift();
}

// ====== AUTH API ======
app.post("/api/register", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.json({ success: false, msg: "Thiếu tài khoản/mật khẩu!" });

  if (saveUser(username, password)) {
    return res.json({ success: true, msg: "Đăng ký thành công! Hãy đăng nhập." });
  }
  return res.json({ success: false, msg: "Tài khoản đã tồn tại!" });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.json({ success: false, msg: "Thiếu tài khoản/mật khẩu!" });

  if (verifyUser(username, password)) {
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: "7d" });
    return res.json({ success: true, token, username });
  }
  return res.json({ success: false, msg: "Sai tài khoản hoặc mật khẩu!" });
});

// ====== APP API (Protected) ======
app.get("/api/status", auth, (req, res) => {
  const my = Object.values(processes).filter((p) => p.owner === req.user.username);
  res.json(
    my.map((p) => ({
      id: p.id,
      running: p.running,
      stats: p.stats,
      logs: p.logs,
      name: p.name
    }))
  );
});

// Start a demo job (placeholder)
app.post("/api/start", auth, (req, res) => {
  const { name } = req.body || {};
  const p = createProc(req.user.username, name);

  // Simulate doing something
  addLog(p.id, "ℹ️ Job is running (demo mode)", "info");
  setTimeout(() => {
    if (!processes[p.id]) return;
    processes[p.id].stats.ok++;
    addLog(p.id, "✅ Demo tick", "success");
  }, 1200);

  res.json({ success: true, msg: "Đã khởi chạy job demo!", id: p.id });
});

app.post("/api/control", auth, (req, res) => {
  const { id, action } = req.body || {};
  const p = processes[id];

  if (action === "stop_all") {
    Object.values(processes).forEach((x) => {
      if (x.owner === req.user.username) x.running = false;
    });
    return res.json({ success: true });
  }

  if (!p || p.owner !== req.user.username) return res.json({ success: false });

  if (action === "delete") {
    p.running = false;
    delete processes[id];
    return res.json({ success: true });
  }

  if (action === "stop") {
    p.running = false;
    addLog(id, "🛑 Stopped", "warning");
    return res.json({ success: true });
  }

  return res.json({ success: false });
});

// ====== START (Render PORT FIX) ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ SERVER ONLINE: http://localhost:${PORT}`);
});
