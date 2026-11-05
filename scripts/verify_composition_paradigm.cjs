const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '../app/node_modules/playwright-core'));

const chromePath = fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/Users/ic/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

async function capture() {
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=metal'],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173/?track=demo&export=1 ...');
  await page.goto('http://localhost:5173/?track=demo&export=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__pdoom && window.__pdoom.ready, { timeout: 15000 });

  const testPoints = [
    { t: 8.5, name: 'fix_01_scene1_terrain_lyric.png', desc: 'Scene 01 Terrain "that is no surprise"' },
    { t: 9.6, name: 'fix_02_scene2_acoustic_loss_clean.png', desc: 'Scene 02 Acoustic-Loss Clean Cut (No Overlap)' },
    { t: 33.0, name: 'fix_03_scene5_cyber_shoggoth.png', desc: 'Scene 05 Cyber-Shoggoth Unmasked + Detection Eyes' },
    { t: 70.0, name: 'fix_04_scene9_ascent_odometer.png', desc: 'Scene 09 Ascent-Odometer FLOPs Runaway' },
    { t: 78.0, name: 'fix_05_scene10_tunnel_vonneumann.png', desc: 'Scene 10 Beat-Tunnel Von Neumann Obsolete' },
    { t: 83.0, name: 'fix_06_scene11_kinetic_press_leftturn.png', desc: 'Scene 11 Kinetic-Press Sharp Left Turn Clean Switch' },
    { t: 98.0, name: 'fix_07_scene12_infinite_clips.png', desc: 'Scene 12 Infinite-Clips Paperclips Lattice' },
    { t: 105.0, name: 'fix_08_scene13_fuse_spark.png', desc: 'Scene 13 Fuse-Spark Lit The Fuse' },
    { t: 116.0, name: 'fix_09_scene14_dense_cluster.png', desc: 'Scene 14 Dense-Cluster 100k GPU Racks' },
  ];

  for (const pt of testPoints) {
    console.log(`Rendering time t=${pt.t}s (${pt.desc})...`);
    await page.evaluate((time) => {
      if (window.__pdoom) {
        window.__pdoom.still(time);
      }
    }, pt.t);
    await page.waitForTimeout(600);

    const outPath = path.join(__dirname, '../素材', pt.name);
    await page.screenshot({ path: outPath });
    console.log(`Saved screenshot: ${outPath}`);
  }

  await browser.close();
  console.log('All verification captures completed successfully!');
}

capture().catch((err) => {
  console.error('Capture error:', err);
  process.exit(1);
});
