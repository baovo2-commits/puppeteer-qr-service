const express = require("express");
const rateLimit = require("express-rate-limit");
const Redis = require("ioredis");
const { getCluster, closeCluster } = require("./cluster");
const { extractQR } = require("./worker");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Redis cache (optional — degrades gracefully when REDIS_URL is not set)
// ---------------------------------------------------------------------------
let redis = null;
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: false,
    lazyConnect: true,
  });
  redis.on("error", (err) => console.error("[redis] connection error:", err.message));
  redis.connect().catch((err) => console.error("[redis] connect failed:", err.message));
  console.log("[redis] client configured");
} else {
  console.warn("[redis] REDIS_URL not set — caching disabled");
}

const CACHE_TTL_SECONDS = 120; // 2-minute TTL per sessionId

// ---------------------------------------------------------------------------
// Rate limiting — 30 requests / minute per IP
// ---------------------------------------------------------------------------
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.get("/get-qr", limiter, async (req, res) => {
  const { sessionId } = req.query;

  if (!sessionId || typeof sessionId !== "string" || sessionId.trim() === "") {
    return res.status(400).json({ error: "Missing or invalid sessionId" });
  }

  const cacheKey = `qr:${sessionId}`;

  // 1. Cache hit
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log(`[cache] HIT for sessionId=${sessionId}`);
        return res.json({ success: true, qr: cached, cached: true });
      }
    } catch (err) {
      console.error("[cache] read error:", err.message);
    }
  }

  // 2. Browser pool execution
  try {
    const cluster = await getCluster();

    const qr = await cluster.execute({ sessionId }, extractQR);

    // 3. Store in cache
    if (redis) {
      redis.set(cacheKey, qr, "EX", CACHE_TTL_SECONDS).catch((err) =>
        console.error("[cache] write error:", err.message)
      );
    }

    return res.json({ success: true, qr, cached: false });
  } catch (err) {
    console.error(`[api] error for sessionId=${sessionId}:`, err.message);

    if (err.message.includes("timeout") || err.message.includes("Timeout")) {
      return res.status(504).json({ error: "Page load timed out. The NDC site may be slow or the sessionId has expired." });
    }

    if (err.message.includes("canvas") || err.message.includes("Canvas")) {
      return res.status(422).json({ error: "QR code not found on page. The sessionId may be invalid or already used." });
    }

    return res.status(500).json({ error: "Internal error: " + err.message });
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const server = app.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);
  // Warm up the cluster so the first real request is fast
  getCluster().catch((err) => console.error("[cluster] warm-up failed:", err.message));
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
async function shutdown(signal) {
  console.log(`[server] ${signal} received — shutting down`);
  server.close(async () => {
    await closeCluster();
    if (redis) await redis.quit().catch(() => {});
    console.log("[server] clean exit");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
