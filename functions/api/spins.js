/**
 * Cloudflare Pages Function — functions/api/spins.js
 * GET  /api/spins        → leaderboard
 * GET  /api/spins/status → sisa spin hari ini
 * POST /api/spins        → simpan spin + rate limit + notif Discord
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const VALID_RESULTS = ['GAY', 'FURRY', 'FEMBOY', 'DIH PEOPLE', 'STUPID', 'PMO'];
const DAILY_LIMIT  = 3;
const COOKIE_NAME  = 'sof_session';

const RESULT_COLORS = {
  'GAY':        0xff3a6e,
  'FURRY':      0xff7e1a,
  'FEMBOY':     0xffe600,
  'DIH PEOPLE': 0x00e5ff,
  'STUPID':     0xa259ff,
  'PMO':        0x00ff9d,
};

const RESULT_EMOJI = {
  'GAY':        '🌈',
  'FURRY':      '🐾',
  'FEMBOY':     '💛',
  'DIH PEOPLE': '💧',
  'STUPID':     '💜',
  'PMO':        '💚',
};

function getIP(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ||
    'unknown'
  );
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const match  = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function verifySession(token, secret) {
  try {
    const [payload, sigB64] = token.split('.');
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['verify']
    );
    const sig   = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sig, encoder.encode(payload));
    if (!valid) return null;
    const data = JSON.parse(atob(payload));
    if (Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

async function sendDiscord(webhookUrl, name, avatar, result, remaining) {
  const body = JSON.stringify({
    embeds: [{
      title:     `${RESULT_EMOJI[result] ?? '🎰'}  Spin Baru!`,
      color:     RESULT_COLORS[result] ?? 0xffffff,
      thumbnail: avatar ? { url: avatar } : undefined,
      fields: [
        { name: '👤 Player',             value: `**${name}**`,                   inline: true },
        { name: '🎯 Hasil',              value: `**${result}**`,                 inline: true },
        { name: '🎰 Sisa Spin Hari Ini', value: `${remaining} / ${DAILY_LIMIT}`, inline: true },
      ],
      footer:    { text: 'Spin of Fate' },
      timestamp: new Date().toISOString(),
    }],
  });
  await fetch(webhookUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // ── GET /api/spins/status ─────────────────────────────────────────────────
  if (request.method === 'GET' && url.pathname.endsWith('/status')) {
    try {
      const ip    = getIP(request);
      const today = getToday();
      const row   = await env.DB
        .prepare('SELECT spin_count FROM ip_limits WHERE ip = ? AND date = ?')
        .bind(ip, today).first();
      const used      = row ? row.spin_count : 0;
      const remaining = Math.max(0, DAILY_LIMIT - used);
      return Response.json({ used, remaining, limit: DAILY_LIMIT }, { headers: CORS_HEADERS });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500, headers: CORS_HEADERS });
    }
  }

  // ── GET /api/spins ────────────────────────────────────────────────────────
  if (request.method === 'GET') {
    try {
      const { results } = await env.DB
        .prepare('SELECT name, avatar, result, created_at FROM spins ORDER BY id DESC LIMIT 50')
        .all();
      return Response.json({ results }, { headers: CORS_HEADERS });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500, headers: CORS_HEADERS });
    }
  }

  // ── POST /api/spins ───────────────────────────────────────────────────────
  if (request.method === 'POST') {
    try {
      const ip    = getIP(request);
      const today = getToday();

      // 1. Cek rate limit
      const row  = await env.DB
        .prepare('SELECT spin_count FROM ip_limits WHERE ip = ? AND date = ?')
        .bind(ip, today).first();
      const used = row ? row.spin_count : 0;

      if (used >= DAILY_LIMIT) {
        return Response.json(
          { error: 'LIMIT_REACHED', message: 'Kamu sudah spin 3x hari ini. Kembali besok!' },
          { status: 429, headers: CORS_HEADERS }
        );
      }

      // 2. Cek session Discord
      let displayName = null;
      let avatarUrl   = null;

      const sessionRaw = getCookie(request, COOKIE_NAME);
      if (sessionRaw && env.SESSION_SECRET) {
        const session = await verifySession(sessionRaw, env.SESSION_SECRET);
        if (session) {
          displayName = session.username;
          avatarUrl   = session.avatar || null;
        }
      }

      // 3. Validasi body
      const body = await request.json();
      if (!displayName) {
        const { name } = body;
        if (!name || typeof name !== 'string' || !name.trim()) {
          return Response.json({ error: 'Nama tidak boleh kosong' }, { status: 400, headers: CORS_HEADERS });
        }
        displayName = name.trim().slice(0, 30);
      }

      const { result } = body;
      if (!result || !VALID_RESULTS.includes(result)) {
        return Response.json({ error: 'Result tidak valid' }, { status: 400, headers: CORS_HEADERS });
      }

      const remaining = DAILY_LIMIT - (used + 1);

      // 4. Simpan spin (dengan avatar)
      await env.DB
        .prepare('INSERT INTO spins (name, avatar, result, created_at) VALUES (?, ?, ?, datetime("now"))')
        .bind(displayName, avatarUrl, result).run();

      // 5. Update counter IP
      await env.DB
        .prepare(`
          INSERT INTO ip_limits (ip, date, spin_count) VALUES (?, ?, 1)
          ON CONFLICT(ip, date) DO UPDATE SET spin_count = spin_count + 1
        `)
        .bind(ip, today).run();

      // 6. Notif Discord
      if (env.DISCORD_WEBHOOK) {
        context.waitUntil(
          sendDiscord(env.DISCORD_WEBHOOK, displayName, avatarUrl, result, remaining)
        );
      }

      return Response.json({ ok: true, remaining, name: displayName }, { headers: CORS_HEADERS });

    } catch (err) {
      return Response.json({ error: err.message }, { status: 500, headers: CORS_HEADERS });
    }
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS_HEADERS });
}
