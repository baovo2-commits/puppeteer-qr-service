# puppeteer-qr-service

Production-grade Express service that extracts QR codes from the NDC payment portal (`thanhtoan.ndc.gov.vn`). Uses a persistent browser pool, Redis caching, user-agent rotation, and the Puppeteer stealth plugin to handle concurrent load without triggering bot detection.

## Architecture

| Component | Detail |
|---|---|
| **Browser pool** | `puppeteer-cluster` — 3 concurrent browser contexts (Railway free-tier safe) |
| **Cache** | Redis with 2-minute TTL per `sessionId` (optional, degrades gracefully) |
| **Anti-bot** | `puppeteer-extra-plugin-stealth` + rotating user-agents + resource blocking |
| **Rate limit** | 30 requests / minute per IP |
| **Graceful shutdown** | SIGTERM drains the cluster and closes Redis before exit |

## API

### `GET /health`
Returns `{ "status": "ok" }`. Use as a Railway health-check endpoint.

### `GET /get-qr?sessionId=<id>`
Navigates to the NDC payment page for the given session and returns the QR canvas as a base-64 data-URL.

**Success (200)**
```json
{ "success": true, "qr": "data:image/png;base64,...", "cached": false }
```

**Error responses**

| Status | Meaning |
|---|---|
| 400 | Missing or blank `sessionId` |
| 422 | Page loaded but no QR canvas found (invalid / used sessionId) |
| 504 | Page load timed out (NDC site slow or sessionId expired) |
| 500 | Unexpected internal error |

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | HTTP port (default `3000`, set automatically by Railway) |
| `REDIS_URL` | No | Redis connection string — add a Railway Redis plugin and it is injected automatically. Without it the service runs without caching. |
| `PUPPETEER_EXECUTABLE_PATH` | No | Path to Chromium binary (set to `/usr/bin/chromium` in the Dockerfile) |

## Run locally

```bash
npm install
npm start
```

Then call:

```bash
curl "http://localhost:3000/get-qr?sessionId=YOUR_SESSION_ID"
```

With Redis caching:

```bash
REDIS_URL=redis://localhost:6379 npm start
```

## Docker

```bash
docker build -t puppeteer-qr-service .
docker run -p 3000:3000 puppeteer-qr-service
```

## Railway deploy

1. Push the repo to GitHub.
2. Open Railway → **New Project** → **Deploy from GitHub** → select this repo.
3. Railway detects the Dockerfile and deploys automatically.
4. (Optional) Add a **Redis** plugin to the project — Railway injects `REDIS_URL` automatically, enabling caching with zero config.
