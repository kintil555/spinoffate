/**
 * Cloudflare Pages Function — functions/api/auth/[[route]].js
 * GET /api/auth/login    → redirect ke Discord OAuth
 * GET /api/auth/callback → handle callback, set session cookie
 * GET /api/auth/me       → cek session user
 * GET /api/auth/logout   → hapus session
 */

const SCOPES         = 'identify';
const COOKIE_NAME    = 'sof_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 hari

function getBaseUrl(request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

async function signData(data, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const payload = btoa(JSON.stringify(data));
  const sig     = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const sigB64  = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${payload}.${sigB64}`;
}

async function verifyData(token, secret) {
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
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const match  = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url  = new URL(request.url);
  const path = url.pathname;
  const base = getBaseUrl(request);

  const CLIENT_ID     = env.DISCORD_CLIENT_ID;
  const CLIENT_SECRET = env.DISCORD_CLIENT_SECRET;
  const SESSION_SEC   = env.SESSION_SECRET;
  const REDIRECT_URI  = `${base}/api/auth/callback`;

  // ── /api/auth/login ───────────────────────────────────────────────────────
  if (path.endsWith('/login')) {
    const params = new URLSearchParams({
      client_id:     CLIENT_ID,
      redirect_uri:  REDIRECT_URI,
      response_type: 'code',
      scope:         SCOPES,
    });
    return Response.redirect(`https://discord.com/oauth2/authorize?${params}`, 302);
  }

  // ── /api/auth/callback ────────────────────────────────────────────────────
  if (path.endsWith('/callback')) {
    const code = url.searchParams.get('code');
    if (!code) return Response.redirect(`${base}/?error=no_code`, 302);

    try {
      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type:    'authorization_code',
          code,
          redirect_uri:  REDIRECT_URI,
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) return Response.redirect(`${base}/?error=token_failed`, 302);

      const userRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const user = await userRes.json();

      const session = {
        id:       user.id,
        username: user.global_name || user.username,
        avatar:   user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
          : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator || 0) % 5}.png`,
        exp: Date.now() + COOKIE_MAX_AGE * 1000,
      };

      const token   = await signData(session, SESSION_SEC);
      const headers = new Headers();
      headers.set('Location', `${base}/`);
      headers.append('Set-Cookie',
        `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`
      );
      return new Response(null, { status: 302, headers });

    } catch (err) {
      return Response.redirect(`${base}/?error=auth_failed`, 302);
    }
  }

  // ── /api/auth/me ──────────────────────────────────────────────────────────
  if (path.endsWith('/me')) {
    const raw = getCookie(request, COOKIE_NAME);
    if (!raw) return Response.json({ user: null });

    const session = await verifyData(decodeURIComponent(raw), SESSION_SEC);
    if (!session || Date.now() > session.exp) return Response.json({ user: null });

    return Response.json({ user: session });
  }

  // ── /api/auth/logout ──────────────────────────────────────────────────────
  if (path.endsWith('/logout')) {
    const headers = new Headers();
    headers.set('Location', `${base}/`);
    headers.append('Set-Cookie',
      `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
    );
    return new Response(null, { status: 302, headers });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}
