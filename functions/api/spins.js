/**
 * Cloudflare Pages Function — functions/api/spins.js
 * GET  /api/spins          → leaderboard
 * GET  /api/spins/status   → spin limit status
 * POST /api/spins/request  → submit segment request (MUST be before POST /api/spins)
 * POST /api/spins          → save spin + rate limit + Discord notif
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const VALID_RESULTS = [
  'GAY', 'FURRY', 'FEMBOY', 'DIH PEOPLE', 'STUPID', 'PMO',
  'IPAD KID', 'BRAINROT KID', 'HALAL PEOPLE', 'CHARCOAL PEOPLE',
  'RACIST PEOPLE', 'GOOD PEOPLE', 'SIGMA', 'MEWING',
  '1000 AURA', 'VERY STUPID', 'TRASH', 'WORST PEOPLE',
  'LOSER', 'CITY BOY',
];

const DAILY_LIMIT = 3;
const COOKIE_NAME = 'sof_session';

const RESULT_COLORS = {
  'GAY':            0xff3a6e,
  'FURRY':          0xff7e1a,
  'FEMBOY':         0xffe600,
  'DIH PEOPLE':     0x00e5ff,
  'STUPID':         0xa259ff,
  'PMO':            0x00ff9d,
  'IPAD KID':       0xff6b9d,
  'BRAINROT KID':   0x8b5cf6,
  'HALAL PEOPLE':   0x10b981,
  'CHARCOAL PEOPLE':0x6b7280,
  'RACIST PEOPLE':  0xef4444,
  'GOOD PEOPLE':    0x22c55e,
  'SIGMA':          0xf59e0b,
  'MEWING':         0x3b82f6,
  '1000 AURA':      0xfbbf24,
  'VERY STUPID':    0xc084fc,
  'TRASH':          0x78716c,
  'WORST PEOPLE':   0xdc2626,
  'LOSER':          0x94a3b8,
  'CITY BOY':       0x0ea5e9,
};

const RESULT_EMOJI = {
  'GAY':            '🌈',
  'FURRY':          '🐾',
  'FEMBOY':         '💛',
  'DIH PEOPLE':     '💧',
  'STUPID':         '💜',
  'PMO':            '💚',
  'IPAD KID':       '📱',
  'BRAINROT KID':   '🧠',
  'HALAL PEOPLE':   '☪️',
  'CHARCOAL PEOPLE':'🪨',
  'RACIST PEOPLE':  '🚫',
  'GOOD PEOPLE':    '😇',
  'SIGMA':          '😤',
  'MEWING':         '😐',
  '1000 AURA':      '✨',
  'VERY STUPID':    '🤦',
  'TRASH':          '🗑️',
  'WORST PEOPLE':   '💀',
  'LOSER':          '😭',
  'CITY BOY':       '🏙️',
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
      title:     `${RESULT_EMOJI[result] ?? '🎰'}  New Spin!`,
      color:     RESULT_COLORS[result] ?? 0xffffff,
      thumbnail: avatar ? { url: avatar } : undefined,
      fields: [
        { name: '👤 Player',           value: `**${name}**`,                   inline: true },
        { name: '🎯 Result',           value: `**${result}**`,                 inline: true },
        { name: '🎰 Spins Left Today', value: `${remaining} / ${DAILY_LIMIT}`, inline: true },
      ],
      footer:    { text: 'Spin of Fate' },
      timestamp: new Date().toISOString(),
    }],
  });
  await fetch(webhookUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
  });
}

async function sendDiscordRequest(webhookUrl, name, avatar, requestText) {
  const body = JSON.stringify({
    embeds: [{
      title:     '📬  New Segment Request!',
      color:     0xffe600,
      thumbnail: avatar ? { url: avatar } : undefined,
      fields: [
        { name: '👤 From',    value: `**${name}**`,        inline: true },
        { name: '💡 Request', value: `**${requestText}**`, inline: false },
      ],
      footer:    { text: 'Spin of Fate — Segment Requests' },
      timestamp: new Date().toISOString(),
    }],
  });
  await fetch(webhookUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url      = new URL(request.url);
  const pathname = url.pathname;

  // ── CORS preflight ────────────────────────────────────────────────────────
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // ── GET /api/spins/status ─────────────────────────────────────────────────
  if (request.method === 'GET' && pathname.endsWith('/status')) {
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

  // ── POST /api/spins/request ───────────────────────────────────────────────
  // IMPORTANT: this block MUST come before POST /api/spins
  if (request.method === 'POST' && pathname.endsWith('/request')) {
    try {
      let displayName = 'Anonymous';
      let avatarUrl   = null;

      // Try to get name from Discord session
      const sessionRaw = getCookie(request, COOKIE_NAME);
      if (sessionRaw && env.SESSION_SECRET) {
        const session = await verifySession(sessionRaw, env.SESSION_SECRET);
        if (session) {
          displayName = session.username;
          avatarUrl   = session.avatar || null;
        }
      }

      // Parse body
      let body;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS_HEADERS });
      }

      const { name, requestText } = body;

      // Use guest name if not logged in with Discord
      if (displayName === 'Anonymous' && name) {
        displayName = String(name).trim().slice(0, 30) || 'Anonymous';
      }

      if (!requestText || typeof requestText !== 'string' || !requestText.trim()) {
        return Response.json({ error: 'Request cannot be empty' }, { status: 400, headers: CORS_HEADERS });
      }

      const cleanRequest = requestText.trim().slice(0, 100);

      // Save to DB
      await env.DB
        .prepare('INSERT INTO segment_requests (name, request, created_at) VALUES (?, ?, datetime("now"))')
        .bind(displayName, cleanRequest)
        .run();

      // Send to separate Discord webhook for requests
      if (env.DISCORD_REQUEST_WEBHOOK) {
        context.waitUntil(
          sendDiscordRequest(env.DISCORD_REQUEST_WEBHOOK, displayName, avatarUrl, cleanRequest)
            .catch(() => {})
        );
      }

      return Response.json({ ok: true }, { headers: CORS_HEADERS });

    } catch (err) {
      return Response.json({ error: err.message }, { status: 500, headers: CORS_HEADERS });
    }
  }

  // ── POST /api/spins ───────────────────────────────────────────────────────
  if (request.method === 'POST') {
    try {
      const ip    = getIP(request);
      const today = getToday();

      // Check rate limit
      const row  = await env.DB
        .prepare('SELECT spin_count FROM ip_limits WHERE ip = ? AND date = ?')
        .bind(ip, today).first();
      const used = row ? row.spin_count : 0;

      if (used >= DAILY_LIMIT) {
        return Response.json(
          { error: 'LIMIT_REACHED', message: 'You have used all 3 spins today. Come back tomorrow!' },
          { status: 429, headers: CORS_HEADERS }
        );
      }

      // Get session
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

      // Parse body
      let body;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS_HEADERS });
      }

      // Fallback to guest name
      if (!displayName) {
        const { name } = body;
        if (!name || typeof name !== 'string' || !name.trim()) {
          return Response.json({ error: 'Name cannot be empty' }, { status: 400, headers: CORS_HEADERS });
        }
        displayName = name.trim().slice(0, 30);
      }

      const { result } = body;
      if (!result || !VALID_RESULTS.includes(result)) {
        return Response.json({ error: 'Invalid result' }, { status: 400, headers: CORS_HEADERS });
      }

      const remaining = DAILY_LIMIT - (used + 1);

      // Save spin
      await env.DB
        .prepare('INSERT INTO spins (name, avatar, result, created_at) VALUES (?, ?, ?, datetime("now"))')
        .bind(displayName, avatarUrl, result)
        .run();

      // Update IP counter
      await env.DB
        .prepare(`
          INSERT INTO ip_limits (ip, date, spin_count) VALUES (?, ?, 1)
          ON CONFLICT(ip, date) DO UPDATE SET spin_count = spin_count + 1
        `)
        .bind(ip, today)
        .run();

      // Send Discord notification
      if (env.DISCORD_WEBHOOK) {
        context.waitUntil(
          sendDiscord(env.DISCORD_WEBHOOK, displayName, avatarUrl, result, remaining)
            .catch(() => {})
        );
      }

      return Response.json({ ok: true, remaining, name: displayName }, { headers: CORS_HEADERS });

    } catch (err) {
      return Response.json({ error: err.message }, { status: 500, headers: CORS_HEADERS });
    }
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS_HEADERS });
}
