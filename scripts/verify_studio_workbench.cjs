const path = require('path');
const fs = require('fs');
const { chromium } = require(path.resolve(__dirname, '../app/node_modules/playwright-core'));

const chromePath = fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/Users/ic/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

async function captureStudio() {
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  console.log('Opening Studio Workbench at http://localhost:5173/ ...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // 1. 截取 Tab 1: 视觉编排 (Timeline Studio)
  console.log('Capturing Tab 1: Timeline Studio...');
  await page.screenshot({ path: path.join(__dirname, '../素材/studio_01_timeline_tab.png') });

  // 2. 切换并截取 Tab 2: 歌曲加工 (Song Pipeline)
  console.log('Capturing Tab 2: Song Pipeline...');
  await page.click('button[data-tab="song"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(__dirname, '../素材/studio_02_song_pipeline.png') });

  // 3. 切换并截取 Tab 3: 视效管理 (Effect Arsenal & Sandbox)
  console.log('Capturing Tab 3: Effect Arsenal...');
  await page.click('button[data-tab="effects"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(__dirname, '../素材/studio_03_effect_arsenal.png') });

  // 4. 切换并截取 Tab 4: 大模型接入 (LLM Integration)
  console.log('Capturing Tab 4: LLM Integration...');
  await page.click('button[data-tab="llm"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(__dirname, '../素材/studio_04_llm_integration.png') });

  // 5. 点击折叠面板，查看全屏播放器沉浸效果
  console.log('Capturing Collapsed Studio View...');
  await page.click('#btn-toggle-workbench');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(__dirname, '../素材/studio_05_collapsed_view.png') });

  await browser.close();
  console.log('All Studio Workbench captures completed successfully!');
}

captureStudio().catch((err) => {
  console.error('Studio capture error:', err);
  process.exit(1);
});
