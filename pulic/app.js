const API_DATA   = '/api/data';
const API_NOTE   = '/api/note';
const API_AVATAR = '/api/avatar?userid=';

let allAccounts = {};
let allNotes = {};

function isOnline(acc) {
  return (Date.now() - new Date(acc.lastRaw || 0).getTime()) < 65000;
}

function fmtNum(n) {
  if (!n) return '0';

  const num = parseFloat(String(n).replace(/,/g, ''));

  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';

  return String(Math.floor(num));
}

function esc(s) {
  const div = document.createElement('div');
  div.textContent = s || '';
  return div.innerHTML;
}

function showToast(type, title, msg) {
  const toast = document.getElementById('toast');

  toast.className = `toast ${type}`;

  document.getElementById('toastTitle').textContent = title;
  document.getElementById('toastMsg').textContent = msg;

  document.getElementById('toastIcon').className =
    type === 'success'
      ? 'fa-solid fa-circle-check'
      : 'fa-solid fa-circle-xmark';

  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 2300);
}

function updateOverview(accounts) {
  const list = Object.values(accounts);
  const online = list.filter(isOnline).length;

  let beli = 0;
  let frag = 0;
  let heart = 0;
  let scroll = 0;

  list.forEach(a => {
    beli += parseFloat(String(a.beli || '0').replace(/,/g, '')) || 0;
    frag += parseFloat(String(a.frag || '0').replace(/,/g, '')) || 0;
    heart += parseInt(a.heart || 0);
    scroll += parseInt(a.mythic || 0) + parseInt(a.legend || 0);
  });

  document.getElementById('ov-online').textContent = `${online} / ${list.length}`;
  document.getElementById('ov-beli').textContent = fmtNum(beli);
  document.getElementById('ov-frag').textContent = fmtNum(frag);
  document.getElementById('ov-heart').textContent = heart;
  document.getElementById('ov-scroll').textContent = scroll;
  document.getElementById('total-count').textContent = list.length;
}

function renderTable(accounts) {
  const tbody = document.getElementById('tableBody');
  const list = Object.values(accounts);

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="loading-cell">
          Không tìm thấy tài khoản nào
        </td>
      </tr>
    `;
    return;
  }

  list.sort((a, b) => {
    const oa = isOnline(a);
    const ob = isOnline(b);

    if (oa !== ob) return ob - oa;

    return (b.level || 0) - (a.level || 0);
  });

  tbody.innerHTML = list.map((acc, idx) => {
    const online = isOnline(acc);
    const currentNote = esc((allNotes[acc.userid] || '').slice(0, 100));

    const ping = parseInt(acc.ping || 0);
    const pingClass = ping < 100 ? 'mini-money' : ping < 200 ? 'mini-frag' : 'mini-heart';

    return `
      <tr>
        <td><b>${idx + 1}</b></td>

        <td>
          <div class="acc">
            <img
              class="avatar"
              loading="lazy"
              src="${API_AVATAR}${esc(acc.userid)}"
              onerror="this.src='https://placehold.co/46x46'"
            >

            <div>
              <div class="acc-name">
                <span class="dot ${online ? 'online' : 'offline'}"></span>
                ${esc(acc.player || 'Unknown')}
              </div>

              <div class="acc-id">
                ID: ${esc(acc.userid)}
              </div>

              <div class="acc-id">
                ${esc(acc.executor || '')}
              </div>
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
          <div class="equipped-box">
            <div class="equip-item equip-fruit">
              Fruit: ${esc(acc.fruit || 'Không')}
            </div>

            <div class="equip-item equip-sword">
              Sword: ${esc(acc.sword || 'Không')}
            </div>

            <div class="equip-item equip-fighting">
              Fighting: ${esc(acc.fighting || 'Không')}
            </div>
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
              <span class="scroll-name">
                <i class="fa-solid fa-wand-sparkles"></i>
                Mythic
              </span>
              <span class="scroll-value">${esc(acc.mythic || 0)}</span>
            </div>

            <div class="scroll-item scroll-legend">
              <span class="scroll-name">
                <i class="fa-solid fa-scroll"></i>
                Legendary
              </span>
              <span class="scroll-value">${esc(acc.legend || 0)}</span>
            </div>
          </div>
        </td>

        <td>
          <div class="system-box">
            <div class="system-row">
              <span>FPS</span>
              <b>${esc(acc.fps || 0)}</b>
            </div>

            <div class="system-row">
              <span>Ping</span>
              <b class="${pingClass}">${esc(acc.ping || 0)}ms</b>
            </div>

            <div class="system-row">
              <span>Treo</span>
              <b>${esc(acc.treo || '00:00')}</b>
            </div>

            <div class="status-pill ${online ? 'status-online' : 'status-offline'}">
              ${online ? 'Online' : 'Offline'}
            </div>
          </div>
        </td>

        <td>
          <div class="note-wrap">
            <input
              class="note"
              id="note-${esc(acc.userid)}"
              value="${currentNote}"
              placeholder="Ghi chú..."
              onkeydown="if(event.key === 'Enter') saveNote('${esc(acc.userid)}')"
            >

            <button class="save" onclick="saveNote('${esc(acc.userid)}')">
              <i class="fa-solid fa-floppy-disk"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function saveNote(userid) {
  const input = document.getElementById(`note-${userid}`);

  if (!input) return;

  const note = input.value.trim();

  allNotes[userid] = note;

  try {
    const res = await fetch(`${API_NOTE}?userid=${userid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    });

    if (res.ok) {
      showToast('success', 'Đã lưu', note || 'Note trống');
    } else {
      showToast('error', 'Lỗi', 'Server không nhận note');
    }

  } catch (e) {
    showToast('error', 'Lỗi', 'Không lưu được');
  }
}

async function loadData() {
  try {
    const res = await fetch(API_DATA);

    if (!res.ok) return;

    const result = await res.json();

    allAccounts = result.accounts || {};
    allNotes = result.notes || {};

    const keyword = document.getElementById('searchInput').value.toLowerCase();

    const filtered = keyword
      ? Object.fromEntries(
          Object.entries(allAccounts).filter(([, a]) =>
            (a.player || '').toLowerCase().includes(keyword) ||
            (allNotes[a.userid] || '').toLowerCase().includes(keyword)
          )
        )
      : allAccounts;

    updateOverview(allAccounts);
    renderTable(filtered);

  } catch (e) {
    console.error(e);
  }
}

document.getElementById('searchInput').addEventListener('input', e => {
  const keyword = e.target.value.toLowerCase();

  const filtered = keyword
    ? Object.fromEntries(
        Object.entries(allAccounts).filter(([, a]) =>
          (a.player || '').toLowerCase().includes(keyword) ||
          (allNotes[a.userid] || '').toLowerCase().includes(keyword)
        )
      )
    : allAccounts;

  renderTable(filtered);
});

setInterval(loadData, 30000);
loadData();
