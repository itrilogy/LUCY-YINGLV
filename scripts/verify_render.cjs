const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

async function testEndpoint(name, url, screenshotPath) {
  console.log(`\n========================================`);
  console.log(`[TEST] Starting verification for: ${name}`);
  console.log(`[TEST] Target URL: ${url}`);
  console.log(`========================================`);

  const chromePath = fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/Users/ic/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=metal']
  });

  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 }
  });

  const pageErrors = [];
  const consoleMessages = [];

  page.on('pageerror', (err) => {
    console.error(`[BROWSER ERROR] [${name}]`, err.message);
    pageErrors.push(err.message);
  });

  page.on('console', (msg) => {
    const text = msg.text();
    consoleMessages.push({ type: msg.type(), text });
    if (msg.type() === 'error') {
      console.error(`[BROWSER CONSOLE ERROR] [${name}]`, text);
    }
  });

  page.on('requestfailed', (req) => {
    console.warn(`[REQUEST FAILED] [${name}]`, req.url(), req.failure()?.errorText);
  });

  page.on('response', (res) => {
    if (res.status() >= 400) {
      console.warn(`[HTTP ${res.status()}] [${name}]`, res.url());
    }
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log(`[TEST] [${name}] Page loaded (DOM ready).`);

    // Wait for engine ready and fonts
    await page.waitForTimeout(1000);

    // Check if error box is visible
    const errBox = await page.$('#errs');
    if (errBox) {
      const errText = await errBox.innerText();
      if (errText && errText.trim().length > 0) {
        console.error(`[TEST] [${name}] Engine reported errors in #errs:\n`, errText);
      }
    }

    // Trigger play by pressing Space
    console.log(`[TEST] [${name}] Pressing Space to start audio & dynamic rendering...`);
    await page.keyboard.press('Space');

    // Run for 3 seconds of real-time rendering
    await page.waitForTimeout(3000);

    // Read player info
    const infoEl = await page.$('#info');
    let infoText = '';
    if (infoEl) {
      infoText = await infoEl.innerText();
      console.log(`[TEST] [${name}] Current Player Status:`, infoText);
    }

    // Capture screenshot
    await page.screenshot({ path: screenshotPath });
    console.log(`[TEST] [${name}] Saved screenshot to: ${screenshotPath}`);

    // Verify no fatal page errors
    if (pageErrors.length > 0) {
      throw new Error(`Browser encountered ${pageErrors.length} uncaught exceptions: ${pageErrors.join('; ')}`);
    }

    console.log(`[TEST] [${name}] PASSED without runtime exceptions.`);
    return { success: true, info: infoText, errors: pageErrors };
  } finally {
    await browser.close();
  }
}

async function run() {
  const artifactDir = '/Users/ic/Copyright/pdoom-video/素材';
  const defaultPng = path.join(artifactDir, 'render_test_default.png');
  const demoPng = path.join(artifactDir, 'render_test_demo.png');

  const resDefault = await testEndpoint('Default Track (pdoom original)', 'http://localhost:5174/', defaultPng);
  const resDemo = await testEndpoint('Demo Track (4 Modular Plugins DSL)', 'http://localhost:5174/?track=demo', demoPng);

  console.log(`\n========================================`);
  console.log(`[TEST SUMMARY]`);
  console.log(`Default Track: ${resDefault.success ? 'SUCCESS' : 'FAILED'} -> ${resDefault.info}`);
  console.log(`Demo Track:    ${resDemo.success ? 'SUCCESS' : 'FAILED'} -> ${resDemo.info}`);
  console.log(`========================================\n`);
}

run().catch((err) => {
  console.error('[FATAL TEST FAILURE]', err);
  process.exit(1);
});
