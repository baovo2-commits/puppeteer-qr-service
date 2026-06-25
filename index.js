const express = require("express");
const puppeteer = require("puppeteer");

const app = express();

app.get("/get-qr", async (req, res) => {
  const sessionId = req.query.sessionId;

  if (!sessionId) {
    return res.status(400).json({ error: "Missing sessionId" });
  }

  let browser;

  try {
    browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: "new"
    });

    const page = await browser.newPage();
    const url = `https://thanhtoan.ndc.gov.vn/payment?sessionId=${sessionId}`;

    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await page.waitForSelector("canvas", { timeout: 30000 });

    const qr = await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      return canvas ? canvas.toDataURL() : null;
    });

    res.json({
      success: true,
      qr
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});
