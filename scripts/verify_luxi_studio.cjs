const path = require('path');
const fs = require('fs');
const { chromium } = require(path.resolve(__dirname, '../app/node_modules/playwright-core'));

const chromePath = fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/Users/ic/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

async function captureLuxiStudio() {
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // 1. 鹿溪·视听织机独立工作台主页 (studio.html)
  console.log('1. Capturing LUXI Studio Workbench (Overview)...');
  await page.goto('http://localhost:5173/studio.html?track=demo', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(__dirname, '../素材/luxi_01_studio_workbench_overview.png') });

  // 2. 视效军械库 Tab (19 大通用插件全景)
  console.log('2. Capturing Tab 3: Effect Arsenal...');
  await page.click('button[data-tab="effects"]');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(__dirname, '../素材/luxi_02_studio_effects_arsenal.png') });

  // 3. 标签与意象库 Tab (美学流派与语义本体)
  console.log('3. Capturing Tab 4: Tag & Imagery System...');
  await page.click('button[data-tab="tags"]');
  await page.waitForTimeout(800);
  // 执行测试查询
  await page.fill('#sandbox-tag-query', 'Silicon wafer monocrystalline layers of weights 100k GPUs');
  await page.click('#btn-test-match');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(__dirname, '../素材/luxi_03_studio_tag_imagery_system.png') });

  // 4. 独立沙箱测试：HardwareStack (硅晶圆与计算堆栈)
  console.log('4. Capturing HardwareStack Sandbox...');
  await page.goto('http://localhost:5173/?track=demo&preview=effect&effect=hardware-stack', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(__dirname, '../素材/luxi_04_sandbox_hardware_stack.png') });

  // 5. 独立沙箱测试：GanttManeuver (规避机动与甘特图)
  console.log('5. Capturing GanttManeuver Sandbox...');
  await page.goto('http://localhost:5173/?track=demo&preview=effect&effect=gantt-maneuver', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(__dirname, '../素材/luxi_05_sandbox_gantt_maneuver.png') });

  await browser.close();
  console.log('All LUXI Studio Workbench captures completed successfully!');
}

captureLuxiStudio().catch((err) => {
  console.error('LUXI Studio capture error:', err);
  process.exit(1);
});
