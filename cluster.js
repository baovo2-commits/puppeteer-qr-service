const { Cluster } = require("puppeteer-cluster");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

let cluster = null;

/**
 * Initialise the browser pool once and return it.
 * Subsequent calls return the same instance.
 */
async function getCluster() {
  if (cluster) return cluster;

  cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: 3, // safe for Railway free tier
    puppeteer,
    puppeteerOptions: {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
        "--single-process",
      ],
    },
    retryLimit: 1,
    retryDelay: 500,
    timeout: 30000,
    monitor: false,
  });

  // Surface unhandled task errors so they don't silently swallow
  cluster.on("taskerror", (err, data) => {
    console.error(`[cluster] task error for sessionId=${data?.sessionId}:`, err.message);
  });

  console.log("[cluster] browser pool initialised (maxConcurrency=3)");
  return cluster;
}

/**
 * Gracefully shut down the cluster (call on SIGTERM).
 */
async function closeCluster() {
  if (cluster) {
    await cluster.idle();
    await cluster.close();
    cluster = null;
    console.log("[cluster] browser pool closed");
  }
}

module.exports = { getCluster, closeCluster };
