const SEGMENTS    = ['GAY', 'FURRY', 'FEMBOY', 'DIH PEOPLE', 'STUPID', 'PMO'];
const DAILY_LIMIT = 3;

const COLORS = [
  { bg: '#ff3a6e', text: '#fff' },
  { bg: '#ff7e1a', text: '#fff' },
  { bg: '#ffe600', text: '#111' },
  { bg: '#00e5ff', text: '#111' },
  { bg: '#a259ff', text: '#fff' },
  { bg: '#00ff9d', text: '#111' },
];

const BADGE_COLORS = {
  'GAY':        { bg: 'rgba(255,58,110,0.15)',  color: '#ff3a6e', border: '#ff3a6e' },
  'FURRY':      { bg: 'rgba(255,126,26,0.15)',  color: '#ff7e1a', border: '#ff7e1a' },
  'FEMBOY':     { bg: 'rgba(255,230,0,0.15)',   color: '#ffe600', border: '#ffe600' },
  'DIH PEOPLE': { bg: 'rgba(0,229,255,0.15)',   color: '#00e5ff', border: '#00e5ff' },
  'STUPID':     { bg: 'rgba(162,89,255,0.15)',  color: '#a259ff', border: '#a259ff' },
  'PMO':        { bg: 'rgba(0,255,157,0.15)',   color: '#00ff9d', border: '#00ff9d' },
};

let currentAngle   = 0;
let spinning       = false;
let playerName     = '';
let spinsRemaining = DAILY_LIMIT;

// ─── TURNSTILE ───────────────────────────────────────────────────────────────
function onTurnstileSuccess() {
  const page = document.getElementById('verify-page');
  page.style.transition = 'opacity 0.5s ease';
  page.style.opacity = '0';
  setTimeout(() => {
    page.style.display = 'none';
    document.getElementById('intro-page').style.display = 'flex';
  }, 500);
}

// ─── WHEEL SETUP ─────────────────────────────────────────────────────────────
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

    // Slice
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle   = COLORS[i].bg;
    ctx.fill();
    ctx.strokeStyle = '#0a0a0f';
    ctx.lineWidth   = 2;
    ctx.stroke();

    // Label
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(startAngle + segAngle / 2);
    ctx.textAlign   = 'right';
    ctx.fillStyle   = COLORS[i].text;
    ctx.font        = `bold 13px 'Space Mono', monospace`;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur  = 4;
    ctx.fillText(seg, radius - 12, 5);
    ctx.restore();
  });

  // Center hub
  ctx.beginPath();
  ctx.arc(cx, cy, 44, 0, 2 * Math.PI);
  ctx.fillStyle   = '#0a0a0f';
  ctx.fill();
  ctx.strokeStyle = '#2a2a3a';
  ctx.lineWidth   = 2;
  ctx.stroke();
}

drawWheel(0);

// ─── RESULT FROM ANGLE ───────────────────────────────────────────────────────
function getResult(angle) {
  const segAngle    = (2 * Math.PI) / SEGMENTS.length;
  const pointerAngle = -Math.PI / 2;
  const relative    = ((pointerAngle - angle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  return SEGMENTS[Math.floor(relative / segAngle) % SEGMENTS.length];
}

// ─── SPIN COUNTER UI ─────────────────────────────────────────────────────────
function updateCounter() {
  const el = document.getElementById('spin-counter');
  if (!el) return;
  el.textContent = `SPIN TERSISA: ${spinsRemaining} / ${DAILY_LIMIT}`;
  el.className   = 'spin-counter' + (spinsRemaining === 0 ? ' counter-empty' : '');
}

function showLimitBanner() {
  if (document.getElementById('limit-banner')) return;
  const banner = document.createElement('div');
  banner.id    = 'limit-banner';
  banner.className = 'limit-banner';
  banner.textContent = '⛔ Kamu sudah spin 3x hari ini. Kembali besok!';
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

// ─── CHECK LIMIT ON LOAD ─────────────────────────────────────────────────────
async function checkLimit() {
  try {
    const res  = await fetch('/api/spins/status');
    const data = await res.json();
    spinsRemaining = typeof data.remaining === 'number' ? data.remaining : DAILY_LIMIT;
    updateCounter();
    if (spinsRemaining <= 0) lockSpin();
  } catch (err) {
    console.warn('Gagal cek limit:', err);
  }
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
    const t  = Math.min((now - startTime) / duration, 1);
    currentAngle = startAngle + (targetAngle - startAngle) * easeOut(t);
    drawWheel(currentAngle);

    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      spinning = false;
      canvas.classList.remove('spinning');
      showResult(getResult(currentAngle));
    }
  }

  requestAnimationFrame(animate);
}

// ─── SHOW RESULT ─────────────────────────────────────────────────────────────
function showResult(result) {
  const text = document.getElementById('result-text');
  text.textContent = result;

  const c = BADGE_COLORS[result];
  if (c) {
    text.style.color      = c.color;
    text.style.textShadow = `0 0 20px ${c.color}`;
  }

  document.getElementById('result-box').classList.add('show');
  saveData(playerName, result);
}

// ─── SAVE DATA ────────────────────────────────────────────────────────────────
async function saveData(name, result) {
  try {
    const res  = await fetch('/api/spins', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, result }),
    });
    const data = await res.json();

    if (res.status === 429 || data.error === 'LIMIT_REACHED') {
      spinsRemaining = 0;
      lockSpin();
      return;
    }

    // Update sisa spin dari response server
    if (typeof data.remaining === 'number') {
      spinsRemaining = data.remaining;
    }

    updateCounter();

    if (spinsRemaining > 0) {
      document.getElementById('spin-btn').disabled = false;
      document.getElementById('again-btn').style.display = 'inline-block';
    } else {
      lockSpin();
    }

    fetchLeaderboard();

  } catch (err) {
    console.error('Gagal simpan:', err);
    // Tetap enable spin kalau network error
    document.getElementById('spin-btn').disabled = false;
    document.getElementById('again-btn').style.display = 'inline-block';
  }
}

// ─── LEADERBOARD ─────────────────────────────────────────────────────────────
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
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No spins yet — be the first!</td></tr>';
      return;
    }

    tbody.innerHTML = data.results.map((row, i) => {
      const c = BADGE_COLORS[row.result] || { bg: '#333', color: '#fff', border: '#555' };
      return `<tr>
        <td style="color:var(--dim);font-size:11px;">${i + 1}</td>
        <td style="font-weight:700;">${escapeHtml(row.name)}</td>
        <td><span class="badge" style="background:${c.bg};color:${c.color};border:1px solid ${c.border};">${row.result}</span></td>
        <td style="color:var(--dim);font-size:11px;">${row.created_at}</td>
      </tr>`;
    }).join('');

  } catch (err) {
    loading.textContent = 'Failed to load leaderboard.';
    console.error(err);
  }
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
function startGame() {
  const input = document.getElementById('player-name');
  const name  = input.value.trim();

  if (!name) {
    input.style.borderColor = 'var(--accent)';
    input.focus();
    setTimeout(() => (input.style.borderColor = ''), 1000);
    return;
  }

  playerName = name;
  document.getElementById('header-name').textContent    = name.toUpperCase();
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
  document.getElementById('player-name').value = '';
  removeLimitBanner();
}

// ─── UTILS ───────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

document.getElementById('player-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') startGame();
});
