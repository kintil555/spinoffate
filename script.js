const SEGMENTS = [
  'GAY', 'FURRY', 'FEMBOY', 'DIH PEOPLE', 'STUPID', 'PMO',
  'IPAD KID', 'BRAINROT KID', 'HALAL PEOPLE', 'CHARCOAL PEOPLE',
  'RACIST PEOPLE', 'GOOD PEOPLE', 'SIGMA', 'MEWING',
  '1000 AURA', 'VERY STUPID', 'TRASH', 'WORST PEOPLE',
  'LOSER', 'CITY BOY',
];

const DAILY_LIMIT = 3;

// 20 colors cycling
const COLORS = [
  { bg: '#ff3a6e', text: '#fff' },
  { bg: '#ff7e1a', text: '#fff' },
  { bg: '#ffe600', text: '#111' },
  { bg: '#00e5ff', text: '#111' },
  { bg: '#a259ff', text: '#fff' },
  { bg: '#00ff9d', text: '#111' },
  { bg: '#ff6b9d', text: '#fff' },
  { bg: '#8b5cf6', text: '#fff' },
  { bg: '#10b981', text: '#fff' },
  { bg: '#6b7280', text: '#fff' },
  { bg: '#ef4444', text: '#fff' },
  { bg: '#22c55e', text: '#fff' },
  { bg: '#f59e0b', text: '#111' },
  { bg: '#3b82f6', text: '#fff' },
  { bg: '#fbbf24', text: '#111' },
  { bg: '#c084fc', text: '#fff' },
  { bg: '#78716c', text: '#fff' },
  { bg: '#dc2626', text: '#fff' },
  { bg: '#94a3b8', text: '#111' },
  { bg: '#0ea5e9', text: '#fff' },
];

const BADGE_COLORS = {
  'GAY':            { bg: 'rgba(255,58,110,0.15)',   color: '#ff3a6e', border: '#ff3a6e' },
  'FURRY':          { bg: 'rgba(255,126,26,0.15)',   color: '#ff7e1a', border: '#ff7e1a' },
  'FEMBOY':         { bg: 'rgba(255,230,0,0.15)',    color: '#ffe600', border: '#ffe600' },
  'DIH PEOPLE':     { bg: 'rgba(0,229,255,0.15)',    color: '#00e5ff', border: '#00e5ff' },
  'STUPID':         { bg: 'rgba(162,89,255,0.15)',   color: '#a259ff', border: '#a259ff' },
  'PMO':            { bg: 'rgba(0,255,157,0.15)',    color: '#00ff9d', border: '#00ff9d' },
  'IPAD KID':       { bg: 'rgba(255,107,157,0.15)',  color: '#ff6b9d', border: '#ff6b9d' },
  'BRAINROT KID':   { bg: 'rgba(139,92,246,0.15)',   color: '#8b5cf6', border: '#8b5cf6' },
  'HALAL PEOPLE':   { bg: 'rgba(16,185,129,0.15)',   color: '#10b981', border: '#10b981' },
  'CHARCOAL PEOPLE':{ bg: 'rgba(107,114,128,0.15)',  color: '#9ca3af', border: '#9ca3af' },
  'RACIST PEOPLE':  { bg: 'rgba(239,68,68,0.15)',    color: '#ef4444', border: '#ef4444' },
  'GOOD PEOPLE':    { bg: 'rgba(34,197,94,0.15)',    color: '#22c55e', border: '#22c55e' },
  'SIGMA':          { bg: 'rgba(245,158,11,0.15)',   color: '#f59e0b', border: '#f59e0b' },
  'MEWING':         { bg: 'rgba(59,130,246,0.15)',   color: '#3b82f6', border: '#3b82f6' },
  '1000 AURA':      { bg: 'rgba(251,191,36,0.15)',   color: '#fbbf24', border: '#fbbf24' },
  'VERY STUPID':    { bg: 'rgba(192,132,252,0.15)',  color: '#c084fc', border: '#c084fc' },
  'TRASH':          { bg: 'rgba(120,113,108,0.15)',  color: '#a8a29e', border: '#a8a29e' },
  'WORST PEOPLE':   { bg: 'rgba(220,38,38,0.15)',    color: '#dc2626', border: '#dc2626' },
  'LOSER':          { bg: 'rgba(148,163,184,0.15)',  color: '#94a3b8', border: '#94a3b8' },
  'CITY BOY':       { bg: 'rgba(14,165,233,0.15)',   color: '#0ea5e9', border: '#0ea5e9' },
};

let currentAngle   = 0;
let spinning       = false;
let playerName     = '';
let playerAvatar   = null;
let isDiscordUser  = false;
let spinsRemaining = DAILY_LIMIT;

// ─── INIT ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('error')) window.history.replaceState({}, '', '/');
});

// ─── TURNSTILE ────────────────────────────────────────────────────────────────
function onTurnstileSuccess() {
  const page = document.getElementById('verify-page');
  page.style.transition = 'opacity 0.5s ease';
  page.style.opacity    = '0';
  setTimeout(async () => {
    page.style.display = 'none';
    await initIntroPage();
  }, 500);
}

async function initIntroPage() {
  try {
    const res  = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.user) {
      isDiscordUser = true;
      playerName    = data.user.username;
      playerAvatar  = data.user.avatar;
      document.getElementById('discord-avatar').src           = playerAvatar || '';
      document.getElementById('discord-username').textContent = playerName;
      document.getElementById('discord-logged').style.display = 'flex';
      document.getElementById('discord-guest').style.display  = 'none';
    } else {
      isDiscordUser = false;
      document.getElementById('discord-logged').style.display = 'none';
      document.getElementById('discord-guest').style.display  = 'flex';
    }
  } catch {
    document.getElementById('discord-logged').style.display = 'none';
    document.getElementById('discord-guest').style.display  = 'flex';
  }
  document.getElementById('intro-page').style.display = 'flex';
}

function logout() { window.location.href = '/api/auth/logout'; }

// ─── WHEEL ────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('wheel-canvas');
const ctx    = canvas.getContext('2d');
const cx     = canvas.width  / 2;
const cy     = canvas.height / 2;
const radius = cx - 8;

function drawWheel(rotation) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const segAngle = (2 * Math.PI) / SEGMENTS.length;

  SEGMENTS.forEach((seg, i) => {
    const startAngle = rotation + i * segAngle;
    const endAngle   = startAngle + segAngle;
    const color      = COLORS[i % COLORS.length];

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle   = color.bg;
    ctx.fill();
    ctx.strokeStyle = '#0a0a0f';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(startAngle + segAngle / 2);
    ctx.textAlign   = 'right';
    ctx.fillStyle   = color.text;
    ctx.font        = `bold 10px 'Space Mono', monospace`;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur  = 4;
    ctx.fillText(seg, radius - 10, 4);
    ctx.restore();
  });

  // Center hub
  ctx.beginPath();
  ctx.arc(cx, cy, 36, 0, 2 * Math.PI);
  ctx.fillStyle   = '#0a0a0f';
  ctx.fill();
  ctx.strokeStyle = '#2a2a3a';
  ctx.lineWidth   = 2;
  ctx.stroke();
}

drawWheel(0);

function getResult(angle) {
  const segAngle     = (2 * Math.PI) / SEGMENTS.length;
  const pointerAngle = -Math.PI / 2;
  const relative     = ((pointerAngle - angle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  return SEGMENTS[Math.floor(relative / segAngle) % SEGMENTS.length];
}

// ─── COUNTER & LOCK ───────────────────────────────────────────────────────────
function updateCounter() {
  const el = document.getElementById('spin-counter');
  if (!el) return;
  el.textContent = `SPINS LEFT: ${spinsRemaining} / ${DAILY_LIMIT}`;
  el.className   = 'spin-counter' + (spinsRemaining === 0 ? ' counter-empty' : '');
}

function showLimitBanner() {
  if (document.getElementById('limit-banner')) return;
  const banner     = document.createElement('div');
  banner.id        = 'limit-banner';
  banner.className = 'limit-banner';
  banner.textContent = '⛔ You have used all 3 spins today. Come back tomorrow!';
  document.getElementById('action-buttons').insertAdjacentElement('afterend', banner);
}

function removeLimitBanner() {
  const b = document.getElementById('limit-banner');
  if (b) b.remove();
}

function lockSpin() {
  document.getElementById('spin-btn').disabled = true;
  document.getElementById('again-btn').style.display = 'none';
  showLimitBanner();
  updateCounter();
}

async function checkLimit() {
  try {
    const res  = await fetch('/api/spins/status');
    const data = await res.json();
    spinsRemaining = typeof data.remaining === 'number' ? data.remaining : DAILY_LIMIT;
    updateCounter();
    if (spinsRemaining <= 0) lockSpin();
  } catch { /* ignore */ }
}

// ─── SPIN ─────────────────────────────────────────────────────────────────────
function spinWheel() {
  if (spinning) return;
  if (spinsRemaining <= 0) { lockSpin(); return; }

  spinning = true;
  document.getElementById('spin-btn').disabled = true;
  document.getElementById('again-btn').style.display = 'none';
  document.getElementById('result-box').classList.remove('show');
  canvas.classList.add('spinning');

  const extraSpins  = (5 + Math.floor(Math.random() * 5)) * 2 * Math.PI;
  const targetAngle = currentAngle + extraSpins + Math.random() * 2 * Math.PI;
  const duration    = 4000 + Math.random() * 1000;
  const startAngle  = currentAngle;
  const startTime   = performance.now();

  function easeOut(t) { return 1 - Math.pow(1 - t, 4); }

  function animate(now) {
    const t = Math.min((now - startTime) / duration, 1);
    currentAngle = startAngle + (targetAngle - startAngle) * easeOut(t);
    drawWheel(currentAngle);
    if (t < 1) { requestAnimationFrame(animate); }
    else {
      spinning = false;
      canvas.classList.remove('spinning');
      showResult(getResult(currentAngle));
    }
  }
  requestAnimationFrame(animate);
}

// ─── SHOW RESULT ──────────────────────────────────────────────────────────────
function showResult(result) {
  const text = document.getElementById('result-text');
  text.textContent = result;
  const c = BADGE_COLORS[result];
  if (c) { text.style.color = c.color; text.style.textShadow = `0 0 20px ${c.color}`; }
  document.getElementById('result-box').classList.add('show');
  saveData(playerName, result);
}

// ─── SAVE DATA ────────────────────────────────────────────────────────────────
async function saveData(name, result) {
  try {
    const res  = await fetch('/api/spins', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, result }),
    });
    const data = await res.json();

    if (res.status === 429 || data.error === 'LIMIT_REACHED') {
      spinsRemaining = 0; lockSpin(); return;
    }
    if (typeof data.remaining === 'number') spinsRemaining = data.remaining;
    if (data.name) playerName = data.name;
    updateCounter();

    if (spinsRemaining > 0) {
      document.getElementById('spin-btn').disabled = false;
      document.getElementById('again-btn').style.display = 'inline-block';
    } else { lockSpin(); }

    fetchLeaderboard();
  } catch {
    document.getElementById('spin-btn').disabled = false;
    document.getElementById('again-btn').style.display = 'inline-block';
  }
}

// ─── SEGMENT REQUEST ──────────────────────────────────────────────────────────
async function submitRequest() {
  const input  = document.getElementById('request-input');
  const btn    = document.getElementById('request-btn');
  const status = document.getElementById('request-status');
  const text   = input.value.trim();

  if (!text) {
    input.style.borderColor = 'var(--accent)';
    setTimeout(() => (input.style.borderColor = ''), 1000);
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'SENDING...';
  status.textContent = '';

  try {
    const res = await fetch('/api/request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: playerName, requestText: text }),
    });
    const data = await res.json();

    if (data.ok) {
      input.value        = '';
      status.textContent = '✅ Request sent!';
      status.style.color = '#00ff9d';
    } else {
      status.textContent = '❌ Failed to send.';
      status.style.color = '#ff3a6e';
    }
  } catch {
    status.textContent = '❌ Network error.';
    status.style.color = '#ff3a6e';
  }

  btn.disabled    = false;
  btn.textContent = 'SEND REQUEST';
  setTimeout(() => (status.textContent = ''), 3000);
}

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────
async function fetchLeaderboard() {
  const loading = document.getElementById('loading-state');
  const table   = document.getElementById('data-table');
  const tbody   = document.getElementById('data-body');

  try {
    const res  = await fetch('/api/spins');
    const data = await res.json();

    loading.style.display = 'none';
    table.style.display   = 'table';

    if (!data.results || data.results.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No spins yet — be the first!</td></tr>';
      return;
    }

    tbody.innerHTML = data.results.map((row, i) => {
      const c          = BADGE_COLORS[row.result] || { bg: '#333', color: '#fff', border: '#555' };
      const avatarHtml = row.avatar
        ? `<img src="${escapeHtml(row.avatar)}" class="lb-avatar" alt="" />`
        : `<div class="lb-avatar-placeholder"></div>`;
      return `<tr>
        <td style="color:var(--dim);font-size:11px;">${i + 1}</td>
        <td>${avatarHtml}</td>
        <td style="font-weight:700;">${escapeHtml(row.name)}</td>
        <td><span class="badge" style="background:${c.bg};color:${c.color};border:1px solid ${c.border};">${row.result}</span></td>
        <td style="color:var(--dim);font-size:11px;">${row.created_at}</td>
      </tr>`;
    }).join('');
  } catch {
    loading.textContent = 'Failed to load leaderboard.';
  }
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
function startGame() {
  if (!isDiscordUser) {
    const input = document.getElementById('player-name');
    const name  = input.value.trim();
    if (!name) {
      input.style.borderColor = 'var(--accent)';
      input.focus();
      setTimeout(() => (input.style.borderColor = ''), 1000);
      return;
    }
    playerName = name; playerAvatar = null;
  }

  document.getElementById('header-name').textContent = playerName.toUpperCase();
  const ha = document.getElementById('header-avatar');
  if (playerAvatar) { ha.src = playerAvatar; ha.style.display = 'inline-block'; }
  else { ha.style.display = 'none'; }

  document.getElementById('intro-page').style.display   = 'none';
  document.getElementById('spin-page').style.display    = 'flex';
  document.getElementById('result-box').classList.remove('show');
  document.getElementById('again-btn').style.display    = 'none';
  document.getElementById('spin-btn').disabled          = false;

  removeLimitBanner();
  checkLimit();
  fetchLeaderboard();
}

function goBack() {
  document.getElementById('spin-page').style.display  = 'none';
  document.getElementById('intro-page').style.display = 'flex';
  if (!isDiscordUser) document.getElementById('player-name').value = '';
  removeLimitBanner();
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const nameInput = document.getElementById('player-name');
if (nameInput) nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') startGame(); });
