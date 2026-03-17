const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DATA_ROOT = path.resolve(process.env.MIDJOURNEY_FACTORY_HOME || path.join(__dirname, '../..'));

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const value = argv[i + 1];
    out[key] = value;
    i++;
  }
  return out;
}

function resolveStatePath(profile) {
  const p = String(profile || '').toLowerCase();
  if (p === 'uploader') return path.join(DATA_ROOT, 'output', 'browser_state_uploader');
  return path.join(DATA_ROOT, 'output', 'browser_state_factory');
}

(async () => {
  const args = parseArgs(process.argv);
  const profile = String(args.profile || process.env.FACTORY_PROFILE || 'factory');
  const STATE_PATH = resolveStatePath(profile);

  console.log('🔵 Launching Browser for Manual Login...');
  console.log('👉 Please scan the QR code or log in with your credentials.');
  console.log('⏳ This window will stay open for 5 minutes (or close it manually when done).');
  console.log(`🧪 Profile: ${profile}`);
  console.log('💾 State dir:', STATE_PATH);

  // Launch headful browser
  const browser = await chromium.launchPersistentContext(STATE_PATH, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('https://discord.com/login');

  // Wait for 5 minutes or until closed
  await new Promise(resolve => setTimeout(resolve, 300000));
  
  await browser.close();
  console.log('✅ Browser state saved to:', STATE_PATH);
})();
