/**
 * Cloudflare Pages Function — /api/spins
 * Handles GET (fetch leaderboard), POST (save spin), GET /api/spins/status (cek limit)
 * Rate limit: 3 spin per IP per hari
 * Bound to D1 database via binding name: DB
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const DAILY_LIMIT = 3;

function getClientIP(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ||
    'unknown'
  );
}

function getTodayDate() {
  // Format: YYYY-MM-DD (UTC)
  return new Date().toISOString().slice(0, 10);
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // GET /api/spins/status — cek sisa spin hari ini untuk IP ini
  if (request.method === 'GET' && url.pathname.endsWith('/status')) {
    try {
      const ip = getClientIP(request);
      const today = getTodayDate();

      const row = await env.DB.prepare(
        `SELECT spin_count FROM ip_limits WHERE ip = ? AND date = ?`
      ).bind(ip, today).first();

      const used = row?.spin_count ?? 0;
      const remaining = Math.max(0, DAILY_LIMIT - used);

      return Response.json({ used, remaining, limit: DAILY_LIMIT }, { headers: CORS_HEADERS });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500, headers: CORS_HEADERS });
    }
  }

  // GET /api/spins — fetch leaderboard
  if (request.method === 'GET') {
    try {
      const { results } = await env.DB.prepare(
        `SELECT name, result, created_at
         FROM spins
         ORDER BY id DESC
         LIMIT 50`
      ).all();

      return Response.json({ results }, { headers: CORS_HEADERS });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500, headers: CORS_HEADERS });
    }
  }

  // POST /api/spins — save spin + cek rate limit
  if (request.method === 'POST') {
    try {
      const ip = getClientIP(request);
      const today = getTodayDate();

      // Cek limit hari ini
      const row = await env.DB.prepare(
        `SELECT spin_count FROM ip_limits WHERE ip = ? AND date = ?`
      ).bind(ip, today).first();

      const used = row?.spin_count ?? 0;

      if (used >= DAILY_LIMIT) {
        return Response.json(
          { error: 'LIMIT_REACHED', message: `Kamu sudah spin ${DAILY_LIMIT}x hari ini. Kembali besok!` },
          { status: 429, headers: CORS_HEADERS }
        );
      }

      const { name, result } = await request.json();

      // Validasi data
      const validResults = ['GAY', 'FURRY', 'FEMBOY', 'DIH PEOPLE', 'STUPID', 'PMO'];
      if (!name || !result || !validResults.includes(result)) {
        return Response.json({ error: 'Invalid data' }, { status: 400, headers: CORS_HEADERS });
      }

      const cleanName = String(name).trim().slice(0, 30);

      // Simpan spin
      await env.DB.prepare(
        `INSERT INTO spins (name, result, created_at)
         VALUES (?, ?, datetime('now'))`
      ).bind(cleanName, result).run();

      // Update / insert counter IP
      await env.DB.prepare(
        `INSERT INTO ip_limits (ip, date, spin_count)
         VALUES (?, ?, 1)
         ON CONFLICT(ip, date) DO UPDATE SET spin_count = spin_count + 1`
      ).bind(ip, today).run();

      const remaining = DAILY_LIMIT - (used + 1);

      return Response.json({ ok: true, remaining }, { headers: CORS_HEADERS });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500, headers: CORS_HEADERS });
    }
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS_HEADERS });
}
