/**
 * Cloudflare Pages Function — functions/api/spins.js
 * GET         /api/spins        → ambil 50 spin terakhir (leaderboard)
 * GET         /api/spins/status → cek sisa spin hari ini berdasarkan IP
 * POST        /api/spins        → simpan spin baru (dengan rate limit 3x/hari per IP)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const VALID_RESULTS = ['GAY', 'FURRY', 'FEMBOY', 'DIH PEOPLE', 'STUPID', 'PMO'];
const DAILY_LIMIT = 3;

function getIP(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ||
    'unknown'
  );
}

function getToday() {
  // UTC date string: YYYY-MM-DD
  return new Date().toISOString().slice(0, 10);
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // ── GET /api/spins/status ─────────────────────────────────────────────────
  if (request.method === 'GET' && url.pathname.endsWith('/status')) {
    try {
      const ip    = getIP(request);
      const today = getToday();

      const row = await env.DB
        .prepare('SELECT spin_count FROM ip_limits WHERE ip = ? AND date = ?')
        .bind(ip, today)
        .first();

      const used      = row ? row.spin_count : 0;
      const remaining = Math.max(0, DAILY_LIMIT - used);

      return Response.json(
        { used, remaining, limit: DAILY_LIMIT },
        { headers: CORS_HEADERS }
      );
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

      // 1. Cek limit IP hari ini
      const row = await env.DB
        .prepare('SELECT spin_count FROM ip_limits WHERE ip = ? AND date = ?')
        .bind(ip, today)
        .first();

      const used = row ? row.spin_count : 0;

      if (used >= DAILY_LIMIT) {
        return Response.json(
          { error: 'LIMIT_REACHED', message: 'Kamu sudah spin 3x hari ini. Kembali besok!' },
          { status: 429, headers: CORS_HEADERS }
        );
      }

      // 2. Validasi body
      const body = await request.json();
      const { name, result } = body;

      if (!name || typeof name !== 'string' || name.trim() === '') {
        return Response.json({ error: 'Nama tidak boleh kosong' }, { status: 400, headers: CORS_HEADERS });
      }
      if (!result || !VALID_RESULTS.includes(result)) {
        return Response.json({ error: 'Result tidak valid' }, { status: 400, headers: CORS_HEADERS });
      }

      const cleanName = name.trim().slice(0, 30);

      // 3. Simpan spin ke tabel spins
      await env.DB
        .prepare('INSERT INTO spins (name, result, created_at) VALUES (?, ?, datetime("now"))')
        .bind(cleanName, result)
        .run();

      // 4. Update counter IP (upsert)
      await env.DB
        .prepare(`
          INSERT INTO ip_limits (ip, date, spin_count)
          VALUES (?, ?, 1)
          ON CONFLICT(ip, date) DO UPDATE SET spin_count = spin_count + 1
        `)
        .bind(ip, today)
        .run();

      const remaining = DAILY_LIMIT - (used + 1);

      return Response.json({ ok: true, remaining }, { headers: CORS_HEADERS });

    } catch (err) {
      return Response.json({ error: err.message }, { status: 500, headers: CORS_HEADERS });
    }
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS_HEADERS });
}
