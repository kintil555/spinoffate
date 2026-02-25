/**
 * Cloudflare Pages Function — /api/spins
 * Handles GET (fetch leaderboard) and POST (save spin result)
 * Bound to D1 database via binding name: DB
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequest(context) {
  const { request, env } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // GET — fetch latest 50 spins
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

  // POST — save a new spin
  if (request.method === 'POST') {
    try {
      const { name, result } = await request.json();

      // Basic validation
      const validResults = ['GAY', 'FURRY', 'FEMBOY', 'DIH PEOPLE', 'STUPID', 'PMO'];
      if (!name || !result || !validResults.includes(result)) {
        return Response.json({ error: 'Invalid data' }, { status: 400, headers: CORS_HEADERS });
      }

      const cleanName = String(name).trim().slice(0, 30);

      await env.DB.prepare(
        `INSERT INTO spins (name, result, created_at)
         VALUES (?, ?, datetime('now'))`
      ).bind(cleanName, result).run();

      return Response.json({ ok: true }, { headers: CORS_HEADERS });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500, headers: CORS_HEADERS });
    }
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS_HEADERS });
}
