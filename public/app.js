const API_DATA = "/api/data";
const API_NOTE = "/api/note";
const API_AVATAR = "/api/avatar?userid=";

let allAccounts = {};
let allNotes = {};

function isOnline(acc) {
  return Date.now() - new Date(acc.lastRaw || 0).getTime() < 65000;
}

function fmtNum(n) {
  if (!n) return "0";
  const num = parseFloat(String(n).replace(/,/g, "")) || 0;
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(1) + "K";
  return String(Math.floor(num));
}

function esc(s) {
  const div = document.createElement("div");
  div.textContent = s ?? "";
  return div.innerHTML;
}

function showToast(type, title, msg) {
  const toast = document.getElementById("toast");
  toast.className = `toast show ${type}`;
  document.getElementById("toastTitle").textContent = title;
  document.getElementById("toastMsg").textContent = msg;

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2300);
}

function updateOverview(accounts) {
  const list = Object.values(accounts);
  const online = list.filter(isOnline).length;

  let beli = 0, frag = 0, heart = 0, scroll = 0;

  list.forEach(a => {
    beli += parseFloat(String(a.beli || "0").replace(/,/g, "")) || 0;
    frag += parseFloat(String(a.frag || "0").replace(/,/g, "")) || 0;
    heart += parseInt(a.heart || 0);
    scroll += parseInt(a.mythic || 0) + parseInt(a.legend || 0);
  });

  document.getElementById("ov-online").textContent = `${online} / ${list.length}`;
  document.getElementById("ov-beli").textContent = fmtNum(beli);
  document.getElementById("ov-frag").textContent = fmtNum(frag);
  document.getElementById("ov-heart").textContent = heart;
  document.getElementById("ov-scroll").textContent = scroll;
  document.getElementById("total-count").textContent = list.length;
}

function sortAccounts(accounts) {
  return Object.values(accounts).sort((a, b) => {
    const oa = isOnline(a);
    const ob = isOnline(b);
    if (oa !== ob) return ob - oa;
    return (b.level || 0) - (a.level || 0);
  });
}

function renderTable(accounts) {
  const tbody = document.getElementById("tableBody");
  const list = sortAccounts(accounts);

  if (!list.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="padding:60px;text-align:center;color:#94a3b8;">
          Không tìm thấy tài khoản nào
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map((acc, idx) => {
    const online = isOnline(acc);
    const note = esc((allNotes[acc.userid] || "").slice(0, 100));

    return `
      <tr>
        <td><b>${idx + 1}</b></td>

        <td>
          <div class="acc">
            <img class="avatar" loading="lazy"
              src="${API_AVATAR}${esc(acc.userid)}"
              onerror="this.src='https://placehold.co/46x46'">

            <div>
              <div class="acc-name">
                <span class="dot ${online ? "online" : "offline"}"></span>
                ${esc(acc.player || "Unknown")}
              </div>
              <div class="acc-id">ID: ${esc(acc.userid)}</div>
              <div class="acc-id">${esc(acc.executor || "")}</div>
            </div>
          </div>
        </td>

        <td>
          <div class="mini-list">
            <div class="mini">LV ${esc(acc.level || 0)}</div>
            <div class="mini mini-money">$ ${fmtNum(acc.beli)}</div>
            <div class="mini mini-frag">F ${fmtNum(acc.frag)}</div>
          </div>
        </td>

        <td>
          <div class="mini-list">
            <div class="mini">Fruit: ${esc(acc.fruit || "Không")}</div>
            <div class="mini">Sword: ${esc(acc.sword || "Không")}</div>
            <div class="mini">Fighting: ${esc(acc.fighting || "Không")}</div>
          </div>
        </td>

        <td>
          <div class="mini-list">
            <div class="mini mini-heart">Heart ${esc(acc.heart || 0)}</div>
            <div class="mini mini-scale">Scale ${esc(acc.scale || 0)}</div>
          </div>
        </td>

        <td>
          <div class="scroll-box">
            <div class="scroll-item scroll-mythic">
              <span>Mythic</span>
              <b>${esc(acc.mythic || 0)}</b>
            </div>
            <div class="scroll-item scroll-legend">
              <span>Legendary</span>
              <b>${esc(acc.legend || 0)}</b>
            </div>
          </div>
        </td>

        <td>
          <div class="mini-list">
            <div class="mini">FPS ${esc(acc.fps || 0)}</div>
            <div class="mini">Ping ${esc(acc.ping || 0)}ms</div>
            <div class="mini">${online ? "🟢 Online" : "⚫ Offline"}</div>
            <div class="mini">Treo ${esc(acc.treo || "00:00")}</div>
          </div>
        </td>

        <td>
          <div class="note-wrap">
            <input class="note" id="note-${esc(acc.userid)}"
              value="${note}"
              placeholder="Ghi chú..."
              onkeydown="if(event.key==='Enter') saveNote('${esc(acc.userid)}')">

            <button class="save" onclick="saveNote('${esc(acc.userid)}')">
              <i class="fa-solid fa-floppy-disk"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderMobile(accounts) {
  const box = document.getElementById("mobileList");
  if (!box) return;

  const list = sortAccounts(accounts);

  if (!list.length) {
    box.innerHTML = `<div class="mobile-card">Không tìm thấy tài khoản nào</div>`;
    return;
  }

  box.innerHTML = list.map(acc => {
    const online = isOnline(acc);
    const note = esc((allNotes[acc.userid] || "").slice(0, 100));

    return `
      <div class="mobile-card">
        <div class="mobile-top">
          <img class="mobile-avatar" loading="lazy"
            src="${API_AVATAR}${esc(acc.userid)}"
            onerror="this.src='https://placehold.co/52x52'">

          <div>
            <div class="mobile-name">${online ? "🟢" : "⚫"} ${esc(acc.player || "Unknown")}</div>
            <div class="mobile-id">ID: ${esc(acc.userid)}</div>
          </div>
        </div>

        <div class="mobile-grid">
          <div class="mobile-box"><span>Level</span><b>${esc(acc.level || 0)}</b></div>
          <div class="mobile-box"><span>Beli</span><b>${fmtNum(acc.beli)}</b></div>
          <div class="mobile-box"><span>Fragment</span><b>${fmtNum(acc.frag)}</b></div>
          <div class="mobile-box"><span>Heart</span><b>${esc(acc.heart || 0)}</b></div>
        </div>

        <div class="scroll-box">
          <div class="scroll-item scroll-mythic"><span>Mythic Scroll</span><b>${esc(acc.mythic || 0)}</b></div>
          <div class="scroll-item scroll-legend"><span>Legendary Scroll</span><b>${esc(acc.legend || 0)}</b></div>
        </div>

        <div class="mobile-grid">
          <div class="mobile-box"><span>Fruit</span><b>${esc(acc.fruit || "Không")}</b></div>
          <div class="mobile-box"><span>Sword</span><b>${esc(acc.sword || "Không")}</b></div>
          <div class="mobile-box"><span>FPS</span><b>${esc(acc.fps || 0)}</b></div>
          <div class="mobile-box"><span>Ping</span><b>${esc(acc.ping || 0)}ms</b></div>
        </div>

        <div class="mobile-note">
          <input id="mobile-note-${esc(acc.userid)}"
            value="${note}"
            placeholder="Ghi chú..."
            onkeydown="if(event.key==='Enter') saveMobileNote('${esc(acc.userid)}')">

          <button onclick="saveMobileNote('${esc(acc.userid)}')">
            <i class="fa-solid fa-floppy-disk"></i>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

async function saveNote(userid) {
  const input = document.getElementById(`note-${userid}`);
  if (!input) return;

  const note = input.value.trim();
  allNotes[userid] = note;

  try {
    const res = await fetch(`${API_NOTE}?userid=${userid}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note })
    });

    if (res.ok) {
      showToast("success", "Đã lưu", note || "Note trống");
    } else {
      showToast("error", "Lỗi", "Server không nhận note");
    }
  } catch {
    showToast("error", "Lỗi", "Không lưu được");
  }
}

function saveMobileNote(userid) {
  const mobileInput = document.getElementById(`mobile-note-${userid}`);
  const pcInput = document.getElementById(`note-${userid}`);

  if (mobileInput && pcInput) {
    pcInput.value = mobileInput.value;
  }

  if (pcInput) {
    saveNote(userid);
    return;
  }

  if (mobileInput) {
    const note = mobileInput.value.trim();
    allNotes[userid] = note;

    fetch(`${API_NOTE}?userid=${userid}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note })
    }).then(() => showToast("success", "Đã lưu", note || "Note trống"))
      .catch(() => showToast("error", "Lỗi", "Không lưu được"));
  }
}

function filterAccounts() {
  const keyword = document.getElementById("searchInput").value.toLowerCase();

  return keyword
    ? Object.fromEntries(
        Object.entries(allAccounts).filter(([, a]) =>
          (a.player || "").toLowerCase().includes(keyword) ||
          (allNotes[a.userid] || "").toLowerCase().includes(keyword)
        )
      )
    : allAccounts;
}

async function loadData() {
  try {
    const res = await fetch(API_DATA);
    if (!res.ok) {
      console.error("API_DATA lỗi:", res.status);
      return;
    }

    const result = await res.json();

    allAccounts = result.accounts || {};
    allNotes = result.notes || {};

    const filtered = filterAccounts();

    updateOverview(allAccounts);
    renderTable(filtered);
    renderMobile(filtered);
  } catch (e) {
    console.error("Load error:", e);
  }
}

document.getElementById("searchInput").addEventListener("input", () => {
  const filtered = filterAccounts();
  renderTable(filtered);
  renderMobile(filtered);
});

setInterval(loadData, 30000);
loadData();
