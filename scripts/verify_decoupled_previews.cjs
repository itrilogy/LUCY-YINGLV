const path = require('path');
const fs = require('fs');
const { chromium } = require(path.resolve(__dirname, '../app/node_modules/playwright-core'));

const chromePath = fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/Users/ic/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

async function captureDecoupled() {
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // 1. Studio Workbench 主面板（展示独立预览与跳转按钮）
  console.log('1. Capturing Studio Workbench with decoupled preview buttons...');
  await page.goto('http://localhost:5173/?track=demo&mode=studio', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(__dirname, '../素材/decoupled_01_workbench_studio.png') });

  // 2. 独立新标签页：整曲全屏预览 (Full Preview Tab)
  console.log('2. Capturing Dedicated Full Track Preview Tab...');
  await page.goto('http://localhost:5173/?track=demo&preview=full', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(__dirname, '../素材/decoupled_02_full_preview_tab.png') });

  // 3. 独立新标签页：单切片/单句循环预览 (Slice Preview Tab)
  console.log('3. Capturing Dedicated Single Slice Preview Tab...');
  await page.goto('http://localhost:5173/?track=demo&preview=full&t=81.21&loop=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(__dirname, '../素材/decoupled_03_slice_preview_tab.png') });

  // 4. 独立新标签页：Bureau Stamps 沙箱测试 (Effect Sandbox Tab)
  console.log('4. Capturing Bureau Stamps Sandbox Tab...');
  await page.goto('http://localhost:5173/?track=demo&preview=effect&effect=bureau-stamps', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(__dirname, '../素材/decoupled_04_sandbox_bureau.png') });

  // 5. 独立新标签页：Room Terminal 沙箱测试 (Effect Sandbox Tab)
  console.log('5. Capturing Room Terminal Sandbox Tab...');
  await page.goto('http://localhost:5173/?track=demo&preview=effect&effect=room-terminal', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(__dirname, '../素材/decoupled_05_sandbox_room.png') });

  // 6. 独立新标签页：Dense Cluster 算力集群机架背景与歌词 (Effect Sandbox Tab)
  console.log('6. Capturing Dense Cluster Sandbox Tab...');
  await page.goto('http://localhost:5173/?track=demo&preview=effect&effect=dense-cluster', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(__dirname, '../素材/decoupled_06_sandbox_dense.png') });

  await browser.close();
  console.log('All decoupled preview captures completed successfully!');
}

captureDecoupled().catch((err) => {
  console.error('Decoupled capture error:', err);
  process.exit(1);
});
