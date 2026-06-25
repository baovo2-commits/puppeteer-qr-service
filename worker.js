// User-agents to rotate across requests to reduce fingerprinting
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Puppeteer-cluster task: navigate to the NDC payment page for the given
 * sessionId and extract the QR code from the first <canvas> element.
 *
 * @param {{ page: import('puppeteer').Page, data: { sessionId: string } }} ctx
 * @returns {Promise<string>} Base-64 data-URL of the QR canvas
 */
async function extractQR({ page, data: { sessionId } }) {
  const url = `https://thanhtoan.ndc.gov.vn/payment?sessionId=${sessionId}`;

  // Rotate user-agent and set realistic viewport
  await page.setUserAgent(randomUA());
  await page.setViewport({ width: 1280, height: 800 });

  // Block unnecessary resource types to speed up page load
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const blocked = ["font", "media", "stylesheet"];
    if (blocked.includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });

  console.log(`[worker] navigating to ${url}`);

  await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 25000,
  });

  // Wait for the QR canvas to appear
  await page.waitForSelector("canvas", { timeout: 15000 });

  const qr = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    return canvas ? canvas.toDataURL() : null;
  });

  if (!qr) {
    throw new Error("Canvas element found but toDataURL() returned null");
  }

  console.log(`[worker] QR extracted for sessionId=${sessionId}`);
  return qr;
}

module.exports = { extractQR };
