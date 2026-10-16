# BlinkChat

A fast, mobile-first messenger built with MongoDB, Express, React and Socket.IO.

**Core:** direct & group chats (up to 256), delivered/read receipts, typing indicators, presence & last seen, replies, reactions, edit, delete for me/everyone, forward, search, photos/videos/files, voice notes, voice & video calls (multi-device ringing, screen share), disappearing messages, mute/pin/archive, blocking, Web Push notifications, installable PWA, offline outbox, light/dark/system themes.

**Extras most messengers don't have:** contact's local time in the header · "send at their morning" (time-zone-aware scheduling) · scheduled messages · "Remind me" on any message · Needs-reply filter · Focus mode with urgent override · optional AI: catch-up summaries, reply suggestions, rewrite, translate, voice-note transcription.

## Quick start (no accounts needed)

Requires Node.js 20.19+.

```bash
npm install --prefix backend
npm install --prefix frontend
npm --prefix backend run dev:memory
```

`dev:memory` starts a real local MongoDB (downloaded once, data kept in `backend/.data`). In a second terminal:

```bash
npm --prefix frontend run dev
```

Open http://localhost:5173. Optional demo data (password `demo1234`, e.g. `ava@demo.blinkchat.app`):

```bash
MONGODB_URI=mongodb://127.0.0.1:27027/blinkchat JWT_SECRET=x npm --prefix backend run seed
```

Run the backend tests: `npm --prefix backend test`

## Configuration (`backend/.env`)

Copy `backend/.env.example` to `backend/.env`. Only two values are required:

| Variable | How to get it (free) |
|---|---|
| `MONGODB_URI` | [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) → create a free M0 cluster → Database Access (add user) → Network Access (allow `0.0.0.0/0` for hosted servers) → Connect → Drivers → copy the URI and add `/blinkchat` before `?` |
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |

Everything else is optional and switches features on:

| Feature | Variables | Free source |
|---|---|---|
| Media storage (recommended in production) | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | [cloudinary.com](https://cloudinary.com) → Dashboard. Without it files go to `backend/uploads` (lost on hosts with temporary disks such as Render). |
| Google sign-in | `GOOGLE_CLIENT_ID` | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Create OAuth client ID (Web) → add your site URL (and `http://localhost:5173`) to **Authorized JavaScript origins**. Set the consent screen's privacy policy to `https://YOUR-SITE/privacy`. No frontend variable needed — it's served at runtime. |
| Password reset emails | `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` | Gmail: turn on 2-step verification → [App passwords](https://myaccount.google.com/apppasswords) → use it as `EMAIL_PASS`. Or [Brevo](https://www.brevo.com) SMTP (300/day). In development, codes are printed to the server console. |
| Push notifications | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `npm --prefix backend run vapid` and paste both keys. (Auto-generated locally if empty; set them in production so subscriptions survive redeploys.) iPhone users must add the site to the Home Screen first. |
| AI features | `GROQ_API_KEY` (recommended) or `GEMINI_API_KEY` | [Groq](https://console.groq.com/keys) — free, also enables voice-note transcription. [Google AI Studio](https://aistudio.google.com/apikey) — free. Optional overrides: `AI_PROVIDER`, `AI_MODEL`, `AI_BASE_URL`; `ANTHROPIC_API_KEY` for Claude (paid). `AI_DAILY_LIMIT_PER_USER` protects your free quota. |
| Reliable calls (TURN relay) | `METERED_DOMAIN`, `METERED_API_KEY` | [Metered](https://www.metered.ca/tools/openrelay/) free plan (20 GB/month): sign up → your app domain (e.g. `yourapp.metered.live`) + API key. Alternatives: Cloudflare TURN (`CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_API_TOKEN`) or your own coturn (`TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL`). Without TURN, calls fail on many mobile networks. |

## Deploy (recommended: one free service on Render)

1. Push the repo to GitHub.
2. [Render](https://render.com) → New → **Web Service** → pick the repo.
3. Build command: `npm run build` · Start command: `npm start`
4. Environment: `NODE_ENV=production` plus the variables above.
5. Deploy. The backend serves the built frontend on the same domain, so cookies, WebSockets and iOS Safari all work with no CORS setup.

Free Render services sleep after 15 minutes idle; scheduled messages and reminders run when it wakes. Add a free monitor on [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com) hitting `https://YOUR-SITE/api/health` every 10 minutes.

### Frontend on Vercel instead (optional)

Deploy the backend as above. On Vercel set root directory `frontend` and `VITE_API_URL=https://YOUR-BACKEND.onrender.com`. On the backend set `CLIENT_URL=https://YOUR-APP.vercel.app` and `COOKIE_SAMESITE=none`. The app automatically uses bearer tokens across domains, so Safari's third-party cookie blocking doesn't break login.

## Upgrading from v1

Existing data is migrated automatically on first start: v1 messages become conversations, emails are normalized and the old reset fields are removed. Nothing is deleted.

## Security notes

Messages are encrypted in transit (HTTPS/WSS) and stored on the server; they are **not** end-to-end encrypted. Included: authenticated sockets with origin checks, rate limits, OTP attempt limits, request validation, session revocation, CSRF header check, Helmet/CSP, and upload type allow-listing.
