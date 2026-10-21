<div align="center">

<img src="frontend/public/favicon.svg" width="72" alt="BlinkChat logo" />

# BlinkChat

**A fast, modern messenger for the web: real-time chats, groups, calls, status updates and smart scheduling.**

[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520.19-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%208-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socket.io&logoColor=white)](https://socket.io)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](#license)

[Features](#features) · [Tech stack](#tech-stack) · [Getting started](#getting-started) · [Configuration](#configuration) · [Deployment](#deployment) · [Security](#security)

</div>

---

## Overview

BlinkChat is a full-stack, mobile-first messaging application built on the MERN stack with Socket.IO. It covers everything people expect from a modern messenger and adds features that address real friction in everyday conversations: time zones, busy schedules and noisy group chats.

It installs as a Progressive Web App on desktop and mobile, works on unreliable networks with an offline outbox, and runs entirely on free tiers of well-known services.

## Features

### Messaging
- One-to-one and group chats (up to 256 members) with admin roles and invite links with QR codes
- Delivered and read receipts, typing indicators, online presence and last seen
- Replies, reactions, editing, forwarding, and delete for me or for everyone
- Photos, videos, documents and voice notes with live waveforms
- GIFs and stickers, polls, location sharing, contact cards and link previews
- @mentions that notify even in muted groups
- Pinned, starred and view-once messages, plus Saved Messages for personal notes
- Disappearing messages, global message search and chat export

### Calls and status
- Peer-to-peer voice and video calls with multi-device ringing and screen sharing
- Call history with missed-call tracking
- Status updates that disappear after 24 hours, with views, reactions and replies

### Productivity
- Scheduled messages, including **"send at their morning"** in the recipient's time zone
- The contact's local time in the chat header
- **Remind me** on any message
- A "Needs reply" inbox and Focus mode with urgent override
- Optional AI features: catch-up summaries, reply suggestions, rewriting, translation and voice-note transcription

### Experience
- Responsive layout for phones, tablets and desktops, with native-feeling transitions
- Light, dark and system themes, seven accent colors, solid or soft bubbles and chat wallpapers
- Web Push notifications, an installable PWA, app lock with PIN, and an offline message outbox

## Tech stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, React Router 7, Zustand, Tailwind CSS, DaisyUI, Vite |
| Backend | Node.js, Express 5, Socket.IO 4, Mongoose, Zod |
| Database | MongoDB (Atlas or self-hosted) |
| Real-time | Socket.IO with JWT-authenticated connections, WebRTC for calls |
| Integrations | Cloudinary (media), Web Push (VAPID), Groq / Gemini (AI), KLIPY (GIFs), Metered or Cloudflare (TURN) |
| Testing | Node.js test runner, Supertest, mongodb-memory-server |

## Architecture

```
┌──────────────────────────┐        HTTPS (REST)        ┌──────────────────────────┐
│  React SPA / PWA         │ ─────────────────────────▶ │  Express API             │
│  Zustand stores          │                            │  Zod validation          │
│  Service worker (push)   │ ◀───── WebSocket ────────▶ │  Socket.IO (realtime)    │
└──────────────────────────┘                            │  Scheduler (jobs)        │
            │                                           └────────────┬─────────────┘
            │  WebRTC (peer-to-peer media, TURN relay)               │
            ▼                                                        ▼
      Other participant                                  MongoDB · Cloudinary · Web Push
```

The backend can serve the built frontend from the same domain (recommended), or the frontend can be hosted separately, for example on Vercel.

## Getting started

### Prerequisites
- Node.js 20.19 or later (22 LTS recommended)
- npm 10 or later

### Installation

```bash
git clone https://github.com/RahulSingh005/BlinkChat.git
cd BlinkChat
npm install --prefix backend
npm install --prefix frontend
```

### Run locally

Start the API with a local MongoDB instance. It is downloaded automatically, and data is kept in `backend/.data`:

```bash
npm --prefix backend run dev:memory
```

In a second terminal, start the web app:

```bash
npm --prefix frontend run dev
```

Open http://localhost:5173. No accounts or keys are required for local development.

### Demo data (optional)

Seed sample users and conversations (password `demo1234`, e.g. `ava@demo.blinkchat.app`):

```bash
MONGODB_URI=mongodb://127.0.0.1:27027/blinkchat JWT_SECRET=dev npm --prefix backend run seed
```

## Project structure

```
BlinkChat/
├── backend/
│   ├── src/
│   │   ├── config/        # Environment loading and validation
│   │   ├── controllers/   # Route handlers
│   │   ├── lib/           # Realtime, storage, push, AI, link previews, scheduler
│   │   ├── middleware/    # Auth, rate limiting, validation, errors
│   │   ├── models/        # Mongoose schemas
│   │   ├── routes/        # REST endpoints
│   │   ├── services/      # Conversation and message domain logic
│   │   ├── socket/        # Socket.IO handlers and call signaling
│   │   └── migrations/    # Automatic data migrations
│   └── test/              # API and realtime integration tests
└── frontend/
    ├── public/            # PWA manifest, service worker, icons
    └── src/
        ├── components/    # Chat, layout, stories, calls and UI primitives
        ├── pages/         # Route screens
        ├── store/         # Zustand state and realtime bindings
        ├── hooks/         # Shared React hooks
        └── lib/           # API client, formatting, media and theme helpers
```

## Scripts

| Command | Description |
|---|---|
| `npm run build` | Install dependencies and build the frontend (production) |
| `npm start` | Start the production server |
| `npm test` | Run the backend test suite |
| `npm --prefix backend run dev:memory` | Run the API with a local MongoDB |
| `npm --prefix frontend run dev` | Run the web app with hot reload |
| `npm --prefix frontend run lint` | Lint the frontend |
| `npm --prefix backend run vapid` | Generate Web Push keys |
| `npm --prefix backend run migrate` | Run data migrations manually |

## Security

- JWT sessions in httpOnly cookies, with bearer tokens for cross-site frontends and server-side revocation
- Authenticated WebSocket connections with origin checks to prevent cross-site hijacking
- Rate limiting, request validation with Zod, CSRF header checks and a Helmet content security policy
- Upload type allow-listing, server-signed GIF URLs and SSRF-protected link previews
- Privacy controls for last seen, read receipts and local time, plus blocking

Messages are encrypted in transit (HTTPS/WSS) and stored on the server to support multiple devices. They are **not** end-to-end encrypted.

## License

Distributed under the ISC License.
