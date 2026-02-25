# SPIN OF FATE — Setup Guide

## File Structure
```
/
├── index.html
├── style.css
├── script.js
├── wrangler.toml
├── schema.sql
└── functions/
    └── api/
        └── spins.js
```

---

## Step 1 — Create D1 Database

Install Wrangler CLI (if not installed):
```bash
npm install -g wrangler
wrangler login
```

Create the database:
```bash
wrangler d1 create spinoffate-db
```

Copy the `database_id` from the output and paste it into `wrangler.toml`:
```toml
database_id = "paste-your-id-here"
```

Create the table:
```bash
wrangler d1 execute spinoffate-db --file=schema.sql
```

---

## Step 2 — Set Turnstile Site Key

In `index.html`, replace:
```
data-sitekey="YOUR_TURNSTILE_SITE_KEY"
```
With your actual Cloudflare Turnstile Site Key.

---

## Step 3 — Link D1 to Cloudflare Pages

1. Go to Cloudflare Dashboard → Workers & Pages → your `spinoffate` project
2. Settings → Bindings → Add binding
3. Type: **D1 Database**
4. Variable name: `DB`
5. Database: `spinoffate-db`
6. Save → Redeploy

---

## Step 4 — Push to GitHub & Deploy

```bash
git add .
git commit -m "add D1 backend"
git push
```

Cloudflare Pages will auto-redeploy. Done! 🎉
