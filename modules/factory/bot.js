const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');
const { downloadImage } = require('./downloader');

const DATA_ROOT = path.resolve(process.env.MIDJOURNEY_FACTORY_HOME || path.join(__dirname, '../..'));
// --- CONFIG ---
const CONFIG_PATH = path.join(DATA_ROOT, 'config', 'settings.yaml');
const STATE_PATH = path.join(DATA_ROOT, 'output', 'browser_state_factory');
const PROMPTS_DIR = path.join(DATA_ROOT, 'output', 'prompts');

// --- HELPERS ---
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const envOrConfig = (envName, value) => {
  if (Object.prototype.hasOwnProperty.call(process.env, envName)) {
    return String(process.env[envName] || '').trim();
  }
  return String(value || '').trim();
};

function detectMode(promptData) {
  if (promptData && typeof promptData === 'object') {
    const m = String(promptData.mode || '').toLowerCase();
    if (m.includes('niji')) return 'niji';

    const prompts = Array.isArray(promptData.prompts) ? promptData.prompts : [];
    for (const item of prompts) {
      const params = item && item.parameters;
      const prompt = item && item.prompt;
      if (params && typeof params === 'object' && Number(params.niji) === 7) return 'niji';
      if (typeof params === 'string' && params.toLowerCase().includes('--niji')) return 'niji';
      if (typeof prompt === 'string' && prompt.toLowerCase().includes('--niji')) return 'niji';
    }
  }

  return 'mj';
}

async function openDiscordChannel(page, channelUrl, timeoutMs) {
  const attempts = [
    { url: channelUrl, waitUntil: 'domcontentloaded' },
    { url: 'https://discord.com/app', waitUntil: 'domcontentloaded' },
    { url: channelUrl, waitUntil: 'domcontentloaded' }
  ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      await page.goto(attempt.url, { waitUntil: attempt.waitUntil, timeout: timeoutMs });
      if (page.url().includes('/login')) {
        throw new Error('Discord session is not logged in. Run `npm run login:factory` in modules/factory first.');
      }

      await page.waitForSelector('[role="textbox"], div[class*="textArea"]', { timeout: timeoutMs });
      return;
    } catch (error) {
      lastError = error;
      await sleep(1500);
    }
  }

  throw lastError || new Error('Unable to open Discord channel.');
}

async function main() {
  // 1. Load Config
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(chalk.red('❌ Config file not found:', CONFIG_PATH));
    process.exit(1);
  }
  const config = yaml.load(fs.readFileSync(CONFIG_PATH, 'utf8')) || {};

  const rawMidjourneyConfig = (config && typeof config === 'object' && config.midjourney && typeof config.midjourney === 'object')
    ? config.midjourney
    : {};
  const midjourneyConfig = {
    ...rawMidjourneyConfig,
    discord_token: envOrConfig('DISCORD_TOKEN', rawMidjourneyConfig.discord_token),
    channel_id: envOrConfig('MJ_CHANNEL_ID', rawMidjourneyConfig.channel_id || rawMidjourneyConfig.channelId),
    niji_channel_id: envOrConfig('NIJI_CHANNEL_ID', rawMidjourneyConfig.niji_channel_id || rawMidjourneyConfig.nijiChannelId),
  };
  config.midjourney = midjourneyConfig;
  const mjChannelId = midjourneyConfig.channel_id;
  const nijiChannelId = midjourneyConfig.niji_channel_id;

  const channelUrlFor = (mode) => {
    const channelId = mode === 'niji' && nijiChannelId ? nijiChannelId : mjChannelId;
    return `https://discord.com/channels/@me/${channelId}`;
  };

  const ensureChannel = async (page, mode) => {
    const desiredUrl = channelUrlFor(mode);
    if (!mjChannelId) {
      throw new Error('midjourney.channel_id is missing. Set MJ_CHANNEL_ID or config/settings.yaml.');
    }
    if (mode === 'niji' && !nijiChannelId) {
      console.log(chalk.yellow('Niji mode requested but midjourney.niji_channel_id is not set; using midjourney.channel_id.'));
    }

    // Navigate if needed
    if (!page.url().includes(desiredUrl)) {
      await openDiscordChannel(page, desiredUrl, navigationTimeoutMs);
    }
  };
  const factoryConfig = config.factory || {};
  const navigationTimeoutMs = Number(factoryConfig.discord_navigation_timeout_ms || 120000);
  const configuredBrowserPath = factoryConfig.browser_path || config.browser_path || '';
  const isWindows = process.platform === 'win32';

  const defaultWindowsChromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];

  let executablePath = '';
  if (configuredBrowserPath) {
    executablePath = configuredBrowserPath;
    console.log(chalk.blue(`Using browser_path from config: ${configuredBrowserPath}`));
  } else if (isWindows) {
    const detectedChromePath = defaultWindowsChromePaths.find((chromePath) => fs.existsSync(chromePath));
    if (detectedChromePath) {
      executablePath = detectedChromePath;
      console.log(chalk.blue(`Detected Windows Chrome executable: ${detectedChromePath}`));
    } else {
      console.log(chalk.yellow('Windows Chrome path not detected. Set factory.browser_path in config/settings.yaml if needed.'));
    }
  }

  console.log(chalk.green('🚀 Starting Midjourney Factory Bot...'));
  console.log(chalk.gray(`Profile dir: ${STATE_PATH}`));
  console.log(chalk.blue(`Target: ${channelUrlFor('mj')}`));

  // 2. Launch Browser (Persistent Context)
  const launchOptions = {
    headless: false, // Change to true for background run
    viewport: { width: 1280, height: 800 },
    args: ['--disable-blink-features=AutomationControlled'] // Stealth mode
  };

  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  const browser = await chromium.launchPersistentContext(STATE_PATH, launchOptions);

  const page = await browser.newPage();
  page.setDefaultTimeout(navigationTimeoutMs);
  
  // 3. Go to Discord (default channel)
  await ensureChannel(page, 'mj');
  console.log('Waiting for Discord to load...');
  await page.waitForSelector('[role="textbox"], div[class*="textArea"]', { timeout: navigationTimeoutMs });
  console.log('✅ Discord Loaded');

  // 4. Processing Loop
  while (true) {
    // A. Find a pending prompt file
    const files = fs.readdirSync(PROMPTS_DIR).filter(f => f.endsWith('.json') && !f.includes('_done'));
    if (files.length === 0) {
      console.log(chalk.yellow('💤 No pending prompts. Sleeping for 30s...'));
      await sleep(30000);
      continue;
    }

    const promptFile = files[0];
    const promptPath = path.join(PROMPTS_DIR, promptFile);
    const promptData = JSON.parse(fs.readFileSync(promptPath, 'utf8'));

    const mode = detectMode(promptData);
    await ensureChannel(page, mode);

    console.log(chalk.cyan(`\n📂 Processing Batch: ${promptFile} (mode: ${mode})`));

    // B. Process each prompt in the file
    for (const [index, item] of promptData.prompts.entries()) {
      const parameterText = typeof item.parameters === 'string'
        ? item.parameters
        : Object.entries(item.parameters || {}).map(([k, v]) => `--${k} ${v}`).join(' ');
      const fullPrompt = `${item.prompt} ${parameterText || '--ar 16:9 --stylize 250 --v 7'}`.trim();
      const activeChannelId = mode === 'niji' && nijiChannelId ? nijiChannelId : mjChannelId;
      const downloadTask = downloadImage(page, config, {
        batchFile: promptFile,
        promptIndex: index,
        topic: promptData.topic || 'unknown',
        channelId: activeChannelId,
        prompt: fullPrompt
      }).then(
        (result) => ({ result }),
        (error) => ({ error })
      );

      console.log(chalk.white(`   🎨 Generating [${index+1}/${promptData.prompts.length}]: ${fullPrompt.substring(0, 70)}...`));

      // Type /imagine
      await page.keyboard.type('/imagine');
      await sleep(1500);
      await page.keyboard.press('Enter');
      await sleep(1000);
      
      // Type prompt
      await page.keyboard.type(fullPrompt);
      await sleep(1000);
      await page.keyboard.press('Enter');

      console.log('   ⏳ Waiting for generation...');
      
      // Wait for generation to complete
      // Strategy: Wait for a new image grid to appear that has "U1" buttons (meaning it's done)
      // This is a simplified waiter. Ideally we track the specific message ID.
      let generationError = null;
      try {
        // Wait for the "Upscale" buttons to appear (indicating completion)
        // We give it 2-3 minutes max
        await page.waitForFunction(() => {
          // Find the latest message's buttons
          const buttons = document.querySelectorAll('button');
          // Check if any button has text "U1"
          return Array.from(buttons).some(b => b.innerText.includes('U1'));
        }, { timeout: 180000 }); // 3 min timeout

        console.log('   ✨ Generation Complete!');
      } catch (e) {
        generationError = e;
        console.error(chalk.red('   ❌ Timeout or Error waiting for image'));
      }

      const downloadOutcome = await downloadTask;
      if (downloadOutcome.error) {
        console.error(chalk.red(`   ❌ Image download failed: ${downloadOutcome.error.message}`));
      } else {
        const result = downloadOutcome.result;
        console.log(chalk.green(`   💾 Saved image via ${result.strategy}: ${path.basename(result.imagePath)}`));
        console.log(chalk.gray(`   📝 Sidecar: ${path.basename(result.sidecarPath)}`));
      }

      if (generationError && downloadOutcome.error) {
        console.error(chalk.red(`   ⚠️ Generation wait and download both failed for prompt #${index}`));
      }

      // Human Delay
      const delay = Math.floor(Math.random() * (45 - 20 + 1) + 20);
      console.log(chalk.gray(`   ☕ Taking a coffee break (${delay}s)...`));
      await sleep(delay * 1000);
    }

    // Mark file as done
    const donePath = path.join(PROMPTS_DIR, promptFile.replace('.json', '_done.json'));
    fs.renameSync(promptPath, donePath);
    console.log(chalk.green(`✅ Batch Completed: ${promptFile}`));
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  detectMode,
  main,
};
