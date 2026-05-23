const API_DATA   = '/api/data';
const API_NOTE   = '/api/note';
const API_AVATAR = '/api/avatar?userid=';

let allAccounts = {};
let allNotes = {};

function isOnline(acc){
  return (
    Date.now() -
    new Date(acc.lastRaw || 0).getTime()
  ) < 65000;
}

function fmtNum(n){

  if(!n) return '0';

  const num =
    parseFloat(String(n).replace(/,/g,''));

  if(num >= 1e9)
    return (num/1e9).toFixed(2)+'B';

  if(num >= 1e6)
    return (num/1e6).toFixed(2)+'M';

  if(num >= 1e3)
    return (num/1e3).toFixed(1)+'K';

  return String(Math.floor(num));
}

function esc(s){
  const div = document.createElement('div');
  div.textContent = s || '';
  return div.innerHTML;
}

function showToast(type,title,msg){

  const toast =
    document.getElementById('toast');

  toast.className = `toast show ${type}`;

  document.getElementById('toastTitle')
    .textContent = title;

  document.getElementById('toastMsg')
    .textContent = msg;

  setTimeout(()=>{
    toast.classList.remove('show');
  },2300);
}

/* renderTable + renderMobile + loadData */
/* dùng code render mình gửi trước */
