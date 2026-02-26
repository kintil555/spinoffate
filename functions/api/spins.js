/**
 * Cloudflare Pages Function — functions/api/spins.js
 */

const CORS = {
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

const COLORS = {
  'GAY': 0xff3a6e, 'FURRY': 0xff7e1a, 'FEMBOY': 0xffe600,
  'DIH PEOPLE': 0x00e5ff, 'STUPID': 0xa259ff, 'PMO': 0x00ff9d,
  'IPAD KID': 0xff6b9d, 'BRAINROT KID': 0x8b5cf6, 'HALAL PEOPLE': 0x10b981,
  'CHARCOAL PEOPLE': 0x6b7280, 'RACIST PEOPLE': 0xef4444, 'GOOD PEOPLE': 0x22c55e,
  'SIGMA': 0xf59e0b, 'MEWING': 0x3b82f6, '1000 AURA': 0xfbbf24,
  'VERY STUPID': 0xc084fc, 'TRASH': 0x78716c, 'WORST PEOPLE': 0xdc2626,
  'LOSER': 0x94a3b8, 'CITY BOY': 0x0ea5e9,
};

const EMOJI = {
  'GAY': '🌈', 'FURRY': '🐾', 'FEMBOY': '💛', 'DIH PEOPLE': '💧',
  'STUPID': '💜', 'PMO': '💚', 'IPAD KID': '📱', 'BRAINROT KID': '🧠',
  'HALAL PEOPLE': '☪️', 'CHARCOAL PEOPLE': '🪨', 'RACIST PEOPLE': '🚫',
  'GOOD PEOPLE': '😇', 'SIGMA': '😤', 'MEWING': '😐', '1000 AURA': '✨',
  'VERY STUPID': '🤦', 'TRASH': '🗑️', 'WORST PEOPLE': '💀',
  'LOSER': '😭', 'CITY BOY': '🏙️',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok(data) {
  return Response.json(data, { headers: CORS });
}

function err(msg, status = 500) {
  return Response.json({ error: msg }, { status, headers: CORS });
}

function getIP(req) {
  return req.headers.get('CF-Connecting-IP')
    || req.headers.get('X-Forwarded-For')?.split(',')[0].trim()
    || 'unknown';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function getCookie(req, name) {
  const h = req.headers.get('Cookie') || '';
  const m = h.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

async function verifySession(token, secret) {
  try {
    const [payload, sigB64] = token.split('.');
    if (!payload || !sigB64) return null;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sig   = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sig, enc.encode(payload));
    if (!valid) return null;
    const data = JSON.parse(atob(payload));
    if (Date.now() > data.exp) return null;
    return data;
  } catch { return null; }
}

async function getSession(req, env) {
  const raw = getCookie(req, COOKIE_NAME);
  if (!raw || !env.SESSION_SECRET) return null;
  return verifySession(raw, env.SESSION_SECRET);
}

async function discordPost(url, payload) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ── Discord notifications ─────────────────────────────────────────────────────

function spinEmbed(name, avatar, result, remaining) {
  return {
    embeds: [{
      title:     `${EMOJI[result] ?? '🎰'}  New Spin!`,
      color:     COLORS[result] ?? 0xffffff,
      thumbnail: avatar ? { url: avatar } : undefined,
      fields: [
        { name: '👤 Player',           value: `**${name}**`,                   inline: true },
        { name: '🎯 Result',           value: `**${result}**`,                 inline: true },
        { name: '🎰 Spins Left Today', value: `${remaining} / ${DAILY_LIMIT}`, inline: true },
      ],
      footer:    { text: 'Spin of Fate' },
      timestamp: new Date().toISOString(),
    }],
  };
}

function requestEmbed(name, avatar, text) {
  return {
    embeds: [{
      title:     '📬  New Segment Request!',
      color:     0xffe600,
      thumbnail: avatar ? { url: avatar } : undefined,
      fields: [
        { name: '👤 From',    value: `**${name}**`, inline: true },
        { name: '💡 Request', value: `**${text}**`, inline: false },
      ],
      footer:    { text: 'Spin of Fate — Requests' },
      timestamp: new Date().toISOString(),
    }],
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function onRequest(context) {
  const { request: req, env } = context;
  const { pathname } = new URL(req.url);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  // GET /api/spins/status
  if (req.method === 'GET' && pathname === '/api/spins/status') {
    try {
      const ip  = getIP(req);
      const row = await env.DB
        .prepare('SELECT spin_count FROM ip_limits WHERE ip = ? AND date = ?')
        .bind(ip, today()).first();
      const used      = row?.spin_count ?? 0;
      const remaining = Math.max(0, DAILY_LIMIT - used);
      return ok({ used, remaining, limit: DAILY_LIMIT });
    } catch (e) { return err(e.message); }
  }

  // GET /api/spins
  if (req.method === 'GET' && pathname === '/api/spins') {
    try {
      const { results } = await env.DB
        .prepare('SELECT name, avatar, result, created_at FROM spins ORDER BY id DESC LIMIT 50')
        .all();
      return ok({ results });
    } catch (e) { return err(e.message); }
  }

  // POST /api/spins/request
  if (req.method === 'POST' && pathname === '/api/spins/request') {
    try {
      const session     = await getSession(req, env);
      let   displayName = session?.username ?? null;
      let   avatarUrl   = session?.avatar   ?? null;

      let body = {};
      try { body = await req.json(); } catch { /* ignore */ }

      if (!displayName) {
        displayName = String(body.name ?? '').trim().slice(0, 30) || 'Anonymous';
      }

      const text = String(body.requestText ?? '').trim().slice(0, 100);
      if (!text) return err('Request cannot be empty', 400);

      await env.DB
        .prepare('INSERT INTO segment_requests (name, request, created_at) VALUES (?, ?, datetime("now"))')
        .bind(displayName, text).run();

      if (env.DISCORD_REQUEST_WEBHOOK) {
        context.waitUntil(
          discordPost(env.DISCORD_REQUEST_WEBHOOK, requestEmbed(displayName, avatarUrl, text)).catch(() => {})
        );
      }

      return ok({ ok: true });
    } catch (e) { return err(e.message); }
  }

  // POST /api/spins
  if (req.method === 'POST' && pathname === '/api/spins') {
    try {
      const ip  = getIP(req);
      const row = await env.DB
        .prepare('SELECT spin_count FROM ip_limits WHERE ip = ? AND date = ?')
        .bind(ip, today()).first();
      const used = row?.spin_count ?? 0;

      if (used >= DAILY_LIMIT) {
        return err('You have used all 3 spins today. Come back tomorrow!', 429);
      }

      const session     = await getSession(req, env);
      let   displayName = session?.username ?? null;
      let   avatarUrl   = session?.avatar   ?? null;

      let body = {};
      try { body = await req.json(); } catch { /* ignore */ }

      if (!displayName) {
        const name = String(body.name ?? '').trim().slice(0, 30);
        if (!name) return err('Name cannot be empty', 400);
        displayName = name;
      }

      const result = body.result;
      if (!result || !VALID_RESULTS.includes(result)) return err('Invalid result', 400);

      const remaining = DAILY_LIMIT - (used + 1);

      await env.DB
        .prepare('INSERT INTO spins (name, avatar, result, created_at) VALUES (?, ?, ?, datetime("now"))')
        .bind(displayName, avatarUrl, result).run();

      await env.DB
        .prepare(`
          INSERT INTO ip_limits (ip, date, spin_count) VALUES (?, ?, 1)
          ON CONFLICT(ip, date) DO UPDATE SET spin_count = spin_count + 1
        `)
        .bind(ip, today()).run();

      if (env.DISCORD_WEBHOOK) {
        context.waitUntil(
          discordPost(env.DISCORD_WEBHOOK, spinEmbed(displayName, avatarUrl, result, remaining)).catch(() => {})
        );
      }

      return ok({ ok: true, remaining, name: displayName });
    } catch (e) { return err(e.message); }
  }

  return err('Method not allowed', 405);
}
