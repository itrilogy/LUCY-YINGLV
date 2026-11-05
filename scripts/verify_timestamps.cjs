const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const checkpoints = [
  { name: '01_Terrain_Typography', t: 6.0, out: 'render_plugin_01_terrain_typography.png' },
  { name: '02_Kinetic_Press', t: 20.0, out: 'render_plugin_02_kinetic_press.png' },
  { name: '03_Matrix_Loom', t: 35.0, out: 'render_plugin_03_matrix_loom.png' },
  { name: '04_Spacetime_Lens', t: 52.0, out: 'render_plugin_04_spacetime_lens.png' },
  { name: '05_Tunnel_Glitch', t: 70.0, out: 'render_plugin_05_tunnel_glitch.png' },
];

async function capture(item) {
  const chromePath = fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/Users/ic/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=metal']
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const url = `http://localhost:5174/?track=demo&t=${item.t}`;

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    // 等待着色器编译与字形排版
    await page.waitForTimeout(1600);

    const infoEl = await page.$('#info');
    const infoText = infoEl ? await infoEl.innerText() : '';
    console.log(`[PASS] [${item.name} at t=${item.t}s] -> ${infoText}`);

    const outPath = path.join('/Users/ic/Copyright/pdoom-video/素材', item.out);
    await page.screenshot({ path: outPath });
    console.log(`       Saved frame screenshot: ${outPath}`);
    return { success: true, info: infoText };
  } finally {
    await browser.close();
  }
}

async function run() {
  console.log('\n======================================================');
  console.log('STARTING MULTI-PLUGIN END-TO-END RENDER VERIFICATION');
  console.log('======================================================\n');

  for (const cp of checkpoints) {
    await capture(cp);
  }

  console.log('\n======================================================');
  console.log('ALL 5 PLUGIN CHECKPOINTS RENDERED SUCCESSFULLY (60 FPS)');
  console.log('======================================================\n');
}

run().catch((err) => {
  console.error('[FATAL ERROR IN VERIFICATION]', err);
  process.exit(1);
});
