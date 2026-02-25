const SEGMENTS = ['GAY', 'FURRY', 'FEMBOY', 'DIH PEOPLE', 'STUPID', 'PMO'];

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

let currentAngle = 0;
let spinning = false;
let playerName = '';
let verified = false;
let allData = JSON.parse(localStorage.getItem('spinData') || '[]');

// ===== TURNSTILE CALLBACK =====
// Called automatically by Cloudflare Turnstile when user passes verification
function onTurnstileSuccess(token) {
  verified = true;
  // Fade out verify page, show intro
  const verifyPage = document.getElementById('verify-page');
  verifyPage.style.transition = 'opacity 0.5s ease';
  verifyPage.style.opacity = '0';
  setTimeout(() => {
    verifyPage.style.display = 'none';
    document.getElementById('intro-page').style.display = 'flex';
  }, 500);
}

// ===== WHEEL SETUP =====
const canvas = document.getElementById('wheel-canvas');
const ctx = canvas.getContext('2d');
const cx = canvas.width / 2;
const cy = canvas.height / 2;
const radius = cx - 8;

function drawWheel(rotation) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const segAngle = (2 * Math.PI) / SEGMENTS.length;

  SEGMENTS.forEach((seg, i) => {
    const startAngle = rotation + i * segAngle;
    const endAngle = startAngle + segAngle;

    // Segment fill
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = COLORS[i].bg;
    ctx.fill();
    ctx.strokeStyle = '#0a0a0f';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Segment label
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(startAngle + segAngle / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS[i].text;
    ctx.font = `bold 13px 'Space Mono', monospace`;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText(seg, radius - 12, 5);
    ctx.restore();
  });

  // Center circle
  ctx.beginPath();
  ctx.arc(cx, cy, 44, 0, 2 * Math.PI);
  ctx.fillStyle = '#0a0a0f';
  ctx.fill();
  ctx.strokeStyle = '#2a2a3a';
  ctx.lineWidth = 2;
  ctx.stroke();
}

drawWheel(0);

// ===== GET RESULT =====
function getResult(angle) {
  // Pointer sits at top of canvas = -PI/2 radians
  const segAngle = (2 * Math.PI) / SEGMENTS.length;
  const pointerAngle = -Math.PI / 2;
  const relative = ((pointerAngle - angle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const index = Math.floor(relative / segAngle) % SEGMENTS.length;
  return SEGMENTS[index];
}

// ===== SPIN =====
function spinWheel() {
  if (spinning) return;
  spinning = true;

  document.getElementById('spin-btn').disabled = true;
  document.getElementById('again-btn').style.display = 'none';
  document.getElementById('result-box').classList.remove('show');
  canvas.classList.add('spinning');

  const extraSpins = (5 + Math.floor(Math.random() * 5)) * 2 * Math.PI;
  const targetAngle = currentAngle + extraSpins + Math.random() * 2 * Math.PI;
  const duration = 4000 + Math.random() * 1000;
  const startAngle = currentAngle;
  const startTime = performance.now();

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  function animate(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
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

// ===== SHOW RESULT =====
function showResult(result) {
  const box = document.getElementById('result-box');
  const text = document.getElementById('result-text');

  text.textContent = result;
  const c = BADGE_COLORS[result];
  if (c) {
    text.style.color = c.color;
    text.style.textShadow = `0 0 20px ${c.color}`;
  }

  box.classList.add('show');
  document.getElementById('spin-btn').disabled = false;
  document.getElementById('again-btn').style.display = 'inline-block';

  saveData(playerName, result);
}

// ===== SAVE & RENDER =====
function saveData(name, result) {
  const entry = {
    name,
    result,
    time: new Date().toLocaleString('en-GB', { hour12: false }),
  };
  allData.unshift(entry);
  localStorage.setItem('spinData', JSON.stringify(allData));
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('data-body');

  if (allData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No data yet</td></tr>';
    return;
  }

  tbody.innerHTML = allData.map((row, i) => {
    const c = BADGE_COLORS[row.result] || { bg: '#333', color: '#fff', border: '#555' };
    return `<tr>
      <td style="color:var(--dim);font-size:11px;">${i + 1}</td>
      <td style="font-weight:700;">${escapeHtml(row.name)}</td>
      <td><span class="badge" style="background:${c.bg};color:${c.color};border:1px solid ${c.border};">${row.result}</span></td>
      <td style="color:var(--dim);font-size:11px;">${row.time}</td>
    </tr>`;
  }).join('');
}

// ===== NAVIGATION =====
function startGame() {
  const input = document.getElementById('player-name');
  const name = input.value.trim();

  if (!name) {
    input.style.borderColor = 'var(--accent)';
    input.focus();
    setTimeout(() => (input.style.borderColor = ''), 1000);
    return;
  }

  playerName = name;
  document.getElementById('header-name').textContent = name.toUpperCase();
  document.getElementById('intro-page').style.display = 'none';
  document.getElementById('spin-page').style.display = 'flex';
  document.getElementById('result-box').classList.remove('show');
  document.getElementById('again-btn').style.display = 'none';
  renderTable();
}

function goBack() {
  document.getElementById('spin-page').style.display = 'none';
  document.getElementById('intro-page').style.display = 'flex';
  document.getElementById('player-name').value = '';
}

// ===== UTILS =====
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Enter key shortcut on name input
document.getElementById('player-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') startGame();
});
