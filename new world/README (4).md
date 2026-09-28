# Sypher Coffee Joint — Vercel Edition

This is the Vercel-native rewrite of the site: Node.js serverless functions
instead of PHP, Upstash Redis (via the Vercel Marketplace) instead of JSON
files, signed cookies instead of PHP sessions, and Resend instead of
PHP's `mail()`. Same features, same UI — different plumbing underneath.

## Files

```
index.html               Home page + all tabs
admin.html                 Admin price editor (client-rendered — logs in, edits, saves)
styles.css                 Same styling as before
script.js                  Same UI logic, now calling /api/* Node routes instead of *.php
api/catalog.js              GET  /api/catalog — returns the live catalog (auto-seeds Redis on first run)
api/reserve.js               POST /api/reserve — validates & saves a reservation
api/payment.js                POST /api/payment — initiates the 25% deposit via Payzaapi (demo mode until connected)
api/payzaapi-callback.js       POST — webhook Payzaapi calls on payment result
api/admin/login.js              POST /api/admin/login — verifies password, sets session cookie
api/admin/logout.js              POST /api/admin/logout
api/admin/session.js              GET  /api/admin/session — used by admin.html to check login state
api/admin/save-prices.js          POST /api/admin/save-prices — updates catalog, requires valid session
lib/redis.js                Tiny Upstash REST client (no SDK dependency)
lib/catalog.js                Catalog read/write + auto-seed
lib/default-catalog.js          The 14 starting items (same as before)
lib/reservations.js             Reservation storage + payment-ref lookup index
lib/auth.js                     Password hashing (scrypt) + signed session cookies
lib/send-receipt.js             Emails the receipt via Resend
lib/payzaapi.js                 Payzaapi client — placeholder, see "Connecting Payzaapi" below
lib/http.js                     Small shared response helpers
test/run.js                     Local test suite (mocks Redis) — run with `npm test`
```

## 1. Connect Upstash Redis (Vercel Marketplace)

1. In your Vercel project dashboard, go to **Storage** → **Create Database**
   (or **Marketplace** → search "Redis").
2. Pick **Upstash** and create a Redis database. Free tier is enough to start.
3. Connect it to this project — Vercel automatically adds
   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` as environment
   variables. You don't need to copy these yourself.

## 2. Set the remaining environment variables

In **Project Settings → Environment Variables**, add everything listed in
`.env.example`. At minimum for the site to work:

- `ADMIN_PASSWORD_HASH` — a working default is already in `.env.example`
  (password: `sypher-admin-2026`). **Change it before launch:**
  ```bash
  node -e "console.log(require('./lib/auth').hashPassword('your-new-password'))"
  ```
- `ADMIN_SESSION_SECRET` — any long random string:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

`PAYZAAPI_*` and `RESEND_*` can stay blank — the site runs in clearly-labelled
demo mode for payments and logs receipts instead of emailing them until
those are set.

## 3. Deploy

Push this repo to GitHub/GitLab and import it in Vercel, or run:

```bash
npm i -g vercel
vercel
```

**Important — Root Directory:** if you put these files in a subfolder of
your repo, set **Project Settings → General → Root Directory** to that
folder. If `index.html` sits at your repo root, leave it as default. (This
is the exact setting that caused the "page doesn't exist" error last time —
worth double-checking either way.)

## Local development

```bash
npm i -g vercel   # if you don't have it
cp .env.example .env.local   # fill in your Upstash values
vercel dev
```

Opening `index.html` directly as a file won't work — the menu and every
button are powered by the `/api/*` functions, which only run through
`vercel dev` or a real deployment.

## Running the test suite

```bash
npm test
```

This mocks Redis in-memory and runs the full reservation → payment →
webhook → receipt chain, plus the admin login → price edit → propagation
chain, without needing a real Upstash instance. Useful after any code change.

## Connecting Payzaapi

Same situation as the PHP version: I don't have Payzaapi's actual API
contract, so `lib/payzaapi.js` is a clearly-marked placeholder rather than
a guess. To go live:

1. Get their API reference — base URL, auth method, charge endpoint
   fields, webhook payload format.
2. Fill in `initiateCharge()` in `lib/payzaapi.js` (commented example
   included showing the shape to follow).
3. Update the field names in `api/payzaapi-callback.js` (marked with a
   TODO) to match their real webhook payload.
4. Set `PAYZAAPI_API_KEY`, `PAYZAAPI_BASE_URL`, `PAYZAAPI_CALLBACK_URL`.
   Once all three are set, `api/payment.js` automatically switches from
   demo mode to the real client.

## Receipts

Uses Resend (https://resend.com) — sign up, verify a sending domain, grab
an API key. Free tier covers low volume easily. Swap `lib/send-receipt.js`
for SendGrid/Mailgun/etc. if you'd rather use one you already have —
`sendReservationReceipt()`'s signature stays the same either way.

## A naming note

The menu lists a "Sypher Classic Beef Burger" and "Sypher Crispy Chicken
Burger" rather than "McDonald's burger" as originally described, to avoid
implying a trademark affiliation that doesn't exist. Rename freely in
`lib/default-catalog.js` (only affects new deployments — live prices are
edited through the admin panel once seeded).

## Branding

Same as before: brown `#5B3A21` (primary), white, blue `#2E5A88`, red
`#C1272D`. WhatsApp (+254 703 942 775) is wired into the footer and
floating button with the official WhatsApp mark as inline SVG.
