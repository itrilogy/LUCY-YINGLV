const path = require('path');
const fs = require('fs');
const { chromium } = require(path.resolve(__dirname, '../app/node_modules/playwright-core'));

const chromePath = fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/Users/ic/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

async function captureLayeredSystem() {
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const outDir = path.resolve(__dirname, '../素材');

  // 1. 鹿溪·视听织机独立工作台主页 (包含 5 层镜头装配器和双演示按钮)
  console.log('1. Capturing Layered Studio Workbench (Assembler & Preset Buttons)...');
  await page.goto('http://localhost:5173/studio.html?track=demo', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outDir, 'layered_01_workbench_assembler.png') });

  // 2. 歌曲加工 Tab：三位一体资源映射拓扑
  console.log('2. Capturing Tab 2: Trilogy Asset Mapping Topology...');
  await page.click('button[data-tab="song"]');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, 'layered_02_trilogy_asset_topology.png') });

  // 3. 视效军械库 Tab：图层角色标签与导入/生成管理按钮
  console.log('3. Capturing Tab 3: Effect Arsenal with Layer Pass Roles...');
  await page.click('button[data-tab="effects"]');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, 'layered_03_effects_arsenal_roles.png') });

  // 4. 大模型生成分层视效弹窗
  console.log('4. Capturing AI Generation Modal...');
  await page.click('#btn-open-llm-gen-modal');
  await page.waitForTimeout(600);
  await page.click('#btn-trigger-llm-gen');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, 'layered_04_ai_gen_modal.png') });
  await page.click('.modal-close');
  await page.waitForTimeout(400);

  // 5. 点击载入电影级五层正交预设，并在新视口中全屏渲染多层正交合成场景
  console.log('5. Capturing Multi-Pass Realtime Layered Rendering...');
  await page.click('button[data-tab="timeline"]');
  await page.waitForTimeout(500);

  // 触发点击电影级分层预设按钮
  page.on('dialog', async dialog => {
    await dialog.accept();
  });
  await page.click('#btn-load-cinema');
  await page.waitForTimeout(1000);

  // 打开全屏播放器渲染
  const previewPage = await context.newPage();
  await previewPage.goto('http://localhost:5173/?track=demo&preview=full&t=5.0', { waitUntil: 'networkidle' });
  await previewPage.waitForTimeout(2500);
  await previewPage.screenshot({ path: path.join(outDir, 'layered_05_multipass_render_silicon.png') });

  await browser.close();
  console.log('All Layered Workbench captures completed successfully!');
}

captureLayeredSystem().catch((err) => {
  console.error('Layered capture error:', err);
  process.exit(1);
});
