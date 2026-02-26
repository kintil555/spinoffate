/**
 * Cloudflare Pages Function — functions/api/request.js
 * POST /api/request → submit segment request
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const COOKIE_NAME = 'sof_session';

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

export async function onRequest(context) {
  const { request: req, env } = context;

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
  }

  try {
    // Get session if logged in with Discord
    let displayName = null;
    let avatarUrl   = null;
    const raw = getCookie(req, COOKIE_NAME);
    if (raw && env.SESSION_SECRET) {
      const session = await verifySession(raw, env.SESSION_SECRET);
      if (session) {
        displayName = session.username;
        avatarUrl   = session.avatar ?? null;
      }
    }

    // Parse body
    let body = {};
    try { body = await req.json(); } catch { /* ignore */ }

    // Fallback to guest name
    if (!displayName) {
      displayName = String(body.name ?? '').trim().slice(0, 30) || 'Anonymous';
    }

    const text = String(body.requestText ?? '').trim().slice(0, 100);
    if (!text) {
      return Response.json({ error: 'Request cannot be empty' }, { status: 400, headers: CORS });
    }

    // Save to DB
    await env.DB
      .prepare('INSERT INTO segment_requests (name, request, created_at) VALUES (?, ?, datetime("now"))')
      .bind(displayName, text)
      .run();

    // Send to Discord
    if (env.DISCORD_REQUEST_WEBHOOK) {
      const payload = JSON.stringify({
        embeds: [{
          title:     '📬  New Segment Request!',
          color:     0xffe600,
          thumbnail: avatarUrl ? { url: avatarUrl } : undefined,
          fields: [
            { name: '👤 From',    value: `**${displayName}**`, inline: true },
            { name: '💡 Request', value: `**${text}**`,        inline: false },
          ],
          footer:    { text: 'Spin of Fate — Requests' },
          timestamp: new Date().toISOString(),
        }],
      });
      context.waitUntil(
        fetch(env.DISCORD_REQUEST_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        }).catch(() => {})
      );
    }

    return Response.json({ ok: true }, { headers: CORS });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500, headers: CORS });
  }
}
