const express = require("express");
const cors = require("cors");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const fs = require("fs");

const app = express();

// ===== CONFIG =====
const SECRET_KEY = process.env.SECRET_KEY || "nexus_v10_super_secret_key";
const DB_FILE = path.join(__dirname, "users.json");
const PUBLIC_DIR = path.join(__dirname, "public");

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(PUBLIC_DIR));

// Fix Cannot GET /
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// Healthcheck for Render
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, ts: Date.now() });
});

// ===== DB (users.json) =====
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

// ===== AUTH =====
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

// ===== IN-MEM JOBS (DEMO ENGINE) =====
const jobs = {};

function addLog(id, msg, type = "info") {
  const j = jobs[id];
  if (!j) return;
  const time = new Date().toLocaleTimeString("en-GB");
  j.logs.push({ time, msg, type });
  if (j.logs.length > 120) j.logs.shift();
}

function createJob(owner, name) {
  const id = `${owner}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  jobs[id] = {
    id,
    owner,
    name: name || "demo-job",
    running: true,
    stats: { ok: 0, fail: 0, uptime: Date.now() },
    logs: []
  };
  addLog(id, "✅ Job created", "success");
  return jobs[id];
}

function startDemoLoop(id) {
  const j = jobs[id];
  if (!j) return;

  const tick = () => {
    const job = jobs[id];
    if (!job) return; // deleted
    if (!job.running) return; // stopped

    job.stats.ok++;
    addLog(id, `✅ Tick #${job.stats.ok}`, "success");

    // schedule next tick
    setTimeout(tick, 1500);
  };

  setTimeout(tick, 800);
}

// ===== API =====
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

app.get("/api/status", auth, (req, res) => {
  const my = Object.values(jobs).filter((j) => j.owner === req.user.username);

  res.json(
    my.map((j) => ({
      id: j.id,
      name: j.name,
      running: j.running,
      stats: j.stats,
      logs: j.logs
    }))
  );
});

app.post("/api/start", auth, (req, res) => {
  const { name } = req.body || {};
  const j = createJob(req.user.username, name);
  addLog(j.id, "ℹ️ Demo loop started", "info");
  startDemoLoop(j.id);

  res.json({ success: true, msg: "Đã chạy job demo!", id: j.id });
});

app.post("/api/control", auth, (req, res) => {
  const { id, action } = req.body || {};
  const j = jobs[id];

  if (action === "stop_all") {
    Object.values(jobs).forEach((x) => {
      if (x.owner === req.user.username) x.running = false;
    });
    return res.json({ success: true });
  }

  if (!j || j.owner !== req.user.username) return res.json({ success: false });

  if (action === "stop") {
    j.running = false;
    addLog(id, "🛑 Stopped", "warning");
    return res.json({ success: true });
  }

  if (action === "delete") {
    j.running = false;
    delete jobs[id];
    return res.json({ success: true });
  }

  return res.json({ success: false });
});

// ===== START (Render PORT) =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ SERVER ONLINE on port ${PORT}`);
});
