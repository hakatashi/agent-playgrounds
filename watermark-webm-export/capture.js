'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const DESIGN_DIR = path.join(__dirname, 'design');
const ENTRY_FILE = 'watermark.dc.html';

const LOOP_MS = 6000; // one full cycle of the 6s CSS keyframes
const FPS = Number(process.env.FPS) || 30;
const RAW_FRAMES_DIR = path.join(__dirname, `frames_raw_${FPS}fps`);
const TOTAL_FRAMES = Math.round((LOOP_MS / 1000) * FPS);

// Generous canvas around the bottom-right badge; the crop step trims this
// down to the badge's actual bounding box afterwards.
const VIEWPORT = { width: 450, height: 160, deviceScaleFactor: 2 };

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      const filePath = path.join(DESIGN_DIR, urlPath === '/' ? ENTRY_FILE : urlPath.slice(1));
      const resolved = path.resolve(filePath);
      if (!resolved.startsWith(DESIGN_DIR)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.readFile(resolved, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end();
          return;
        }
        const ext = path.extname(resolved);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  fs.rmSync(RAW_FRAMES_DIR, { recursive: true, force: true });
  fs.mkdirSync(RAW_FRAMES_DIR, { recursive: true });

  const server = await startServer();
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/${ENTRY_FILE}`;

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--force-color-profile=srgb',
      '--font-render-hinting=none',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);

    page.on('pageerror', (e) => console.error('[page error]', e));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('[console]', msg.text());
    });

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

    await page.waitForSelector('[data-watermark-root]', { timeout: 30000 });
    await page.waitForFunction(() => {
      const icon = document.querySelector('img[alt="TouhouSattori icon"]');
      const logo = document.querySelector('img[alt="TouhouSattori"]');
      return icon && icon.complete && icon.naturalWidth > 0 && logo && logo.complete && logo.naturalWidth > 0;
    }, { timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);

    // Let layout/paint fully settle.
    await new Promise((r) => setTimeout(r, 200));

    // Freeze CSS animations so we can step through them deterministically
    // via the Web Animations API instead of racing real wall-clock time.
    await page.evaluate(() => {
      document.getAnimations().forEach((a) => a.pause());
    });

    for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
      const t = (frame * LOOP_MS) / TOTAL_FRAMES;
      await page.evaluate((tt) => {
        document.getAnimations().forEach((a) => {
          a.currentTime = tt;
        });
      }, t);
      // Flush style/layout before capturing the frame.
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      );

      const filePath = path.join(RAW_FRAMES_DIR, `frame_${String(frame).padStart(4, '0')}.png`);
      await page.screenshot({ path: filePath, omitBackground: true });
    }

    console.log(`Captured ${TOTAL_FRAMES} frames at ${FPS}fps into ${RAW_FRAMES_DIR}`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
