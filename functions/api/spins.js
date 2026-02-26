/**
 * Cloudflare Pages Function — functions/api/spins.js
 * GET  /api/spins        → leaderboard 50 spin terakhir
 * GET  /api/spins/status → cek sisa spin hari ini (by IP)
 * POST /api/spins        → simpan spin + rate limit + notif Discord
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const VALID_RESULTS = ['GAY', 'FURRY', 'FEMBOY', 'DIH PEOPLE', 'STUPID', 'PMO'];
const DAILY_LIMIT  = 3;

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

async function sendDiscord(webhookUrl, name, result, remaining) {
  const body = JSON.stringify({
    embeds: [{
      title: `${RESULT_EMOJI[result] ?? '🎰'}  Spin Baru!`,
      color: RESULT_COLORS[result] ?? 0xffffff,
      fields: [
        { name: '👤 Player',            value: `**${name}**`,              inline: true },
        { name: '🎯 Hasil',             value: `**${result}**`,            inline: true },
        { name: '🎰 Sisa Spin Hari Ini', value: `${remaining} / ${DAILY_LIMIT}`, inline: true },
      ],
      footer:    { text: 'Spin of Fate' },
      timestamp: new Date().toISOString(),
    }],
  });

  const res = await fetch(webhookUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  return res;
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
        .prepare('SELECT name, result, created_at FROM spins ORDER BY id DESC LIMIT 50')
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

      // 2. Validasi input
      const { name, result } = await request.json();

      if (!name || typeof name !== 'string' || !name.trim()) {
        return Response.json({ error: 'Nama tidak boleh kosong' }, { status: 400, headers: CORS_HEADERS });
      }
      if (!result || !VALID_RESULTS.includes(result)) {
        return Response.json({ error: 'Result tidak valid' }, { status: 400, headers: CORS_HEADERS });
      }

      const cleanName = name.trim().slice(0, 30);
      const remaining = DAILY_LIMIT - (used + 1);

      // 3. Simpan spin
      await env.DB
        .prepare('INSERT INTO spins (name, result, created_at) VALUES (?, ?, datetime("now"))')
        .bind(cleanName, result).run();

      // 4. Update counter IP
      await env.DB
        .prepare(`
          INSERT INTO ip_limits (ip, date, spin_count) VALUES (?, ?, 1)
          ON CONFLICT(ip, date) DO UPDATE SET spin_count = spin_count + 1
        `)
        .bind(ip, today).run();

      // 5. Kirim notif Discord (tidak blocking, error diabaikan)
      if (env.DISCORD_WEBHOOK) {
        context.waitUntil(
          sendDiscord(env.DISCORD_WEBHOOK, cleanName, result, remaining)
        );
      }

      return Response.json({ ok: true, remaining }, { headers: CORS_HEADERS });

    } catch (err) {
      return Response.json({ error: err.message }, { status: 500, headers: CORS_HEADERS });
    }
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS_HEADERS });
}
