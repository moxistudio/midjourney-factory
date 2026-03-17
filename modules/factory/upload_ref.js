const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const DATA_ROOT = path.resolve(process.env.MIDJOURNEY_FACTORY_HOME || path.join(__dirname, '../..'));
const CONFIG_PATH = path.join(DATA_ROOT, 'config', 'settings.yaml');
const STATE_PATH = path.join(DATA_ROOT, 'output', 'browser_state_uploader');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const envOrConfig = (envName, value) => {
  if (Object.prototype.hasOwnProperty.call(process.env, envName)) {
    return String(process.env[envName] || '').trim();
  }
  return String(value || '').trim();
};

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

async function openDiscordChannel(page, channelUrl, timeoutMs) {
  const attempts = [
    { url: channelUrl, waitUntil: 'domcontentloaded' },
    { url: 'https://discord.com/app', waitUntil: 'domcontentloaded' },
    { url: channelUrl, waitUntil: 'domcontentloaded' },
  ];

  let lastError = null;
  for (const attempt of attempts) {
    try {
      await page.goto(attempt.url, { waitUntil: attempt.waitUntil, timeout: timeoutMs });
      if (page.url().includes('/login')) {
        throw new Error('Discord session is not logged in. Run `npm run login:uploader` in modules/factory first.');
      }
      await page.waitForSelector('[role="textbox"], div[class*="textArea"]', { timeout: timeoutMs });
      return;
    } catch (e) {
      lastError = e;
      await sleep(1500);
    }
  }

  throw lastError || new Error('Unable to open Discord channel.');
}

async function tryUploadViaButton(page, filePath, timeoutMs) {
  // Try upload button -> file chooser
  const candidates = [
    'button[aria-label*="Upload"]',
    'button[aria-label*="Attach"]',
    'button[aria-label*="upload"]',
  ];

  for (const sel of candidates) {
    try {
      const el = await page.$(sel);
      if (!el) continue;

      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 5000 }),
        el.click(),
      ]);
      await chooser.setFiles(filePath);
      return true;
    } catch {
      // try next
    }
  }

  // Try direct file input
  try {
    const inputs = await page.$$('input[type="file"]');
    for (const input of inputs) {
      try {
        await input.setInputFiles(filePath);
        return true;
      } catch {
        // continue
      }
    }
  } catch {
    // ignore
  }

  return false;
}

function toLowerSafe(s) {
  return String(s || '').toLowerCase();
}

async function getAttachmentUrls(page, opts) {
  const channelId = String(opts && opts.channelId ? opts.channelId : '').trim();
  const fileName = String(opts && opts.fileName ? opts.fileName : '').trim();
  const fileNameLower = toLowerSafe(fileName);
  const fileNameEncLower = toLowerSafe(encodeURIComponent(fileName));

  return await page.evaluate(
    ({ channelId, fileNameLower, fileNameEncLower }) => {
    const out = [];

    const pushIf = (u) => {
      if (!u) return;
      if (typeof u !== 'string') return;
      const url = u.trim();
      if (!url) return;

      const isAttachment =
        url.startsWith('https://cdn.discordapp.com/attachments/') || url.startsWith('https://media.discordapp.net/attachments/');
      if (!isAttachment) return;

      if (channelId) {
        const needle = `/attachments/${channelId}/`;
        if (!url.includes(needle)) return;
      }

      if (fileNameLower) {
        const lower = url.toLowerCase();
        const ok = lower.includes(fileNameLower) || (fileNameEncLower && lower.includes(fileNameEncLower));
        if (!ok) return;
      }

      out.push(url);
    };

    const root = document.querySelector('main') || document.body;
    for (const a of Array.from(root.querySelectorAll('a[href]'))) {
      pushIf(a.getAttribute('href'));
    }

    for (const img of Array.from(root.querySelectorAll('img[src]'))) {
      pushIf(img.getAttribute('src'));
    }

    // dedupe while preserving order
    const seen = new Set();
    const uniq = [];
    for (const u of out) {
      if (seen.has(u)) continue;
      seen.add(u);
      uniq.push(u);
    }
    return uniq;
  },
    { channelId, fileNameLower, fileNameEncLower }
  );
}

async function waitForNewAttachmentUrl(page, timeoutMs, beforeUrls, opts) {
  const started = Date.now();
  const before = new Set(beforeUrls || []);

  while (Date.now() - started < timeoutMs) {
    try {
      const urls = await getAttachmentUrls(page, opts);
      // Return the most recent URL we haven't seen
      for (let i = urls.length - 1; i >= 0; i--) {
        const u = urls[i];
        if (!before.has(u)) return u;
      }
    } catch {
      // ignore
    }

    await sleep(800);
  }

  throw new Error('Timed out waiting for new Discord attachment URL');
}

async function waitForNewAttachmentUrlWithTimeout(page, timeoutMs, beforeUrls, opts) {
  const started = Date.now();
  const before = new Set(beforeUrls || []);

  while (Date.now() - started < timeoutMs) {
    try {
      const urls = await getAttachmentUrls(page, opts);
      for (let i = urls.length - 1; i >= 0; i--) {
        const u = urls[i];
        if (!before.has(u)) return u;
      }
    } catch {
      // ignore
    }

    await sleep(800);
  }

  return '';
}

async function main() {
  const args = parseArgs(process.argv);
  const requestedChannelId = String(args.channel || '').trim();
  const filePath = String(args.file || '').trim();
  const mode = String(args.mode || '').trim().toLowerCase();
  const timeoutMs = Number(args.timeout || 180000);

  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error('Config file not found: ' + CONFIG_PATH);
  }

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('--file is required and must exist');
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
  const channelId = requestedChannelId || (
    mode.includes('niji') && midjourneyConfig.niji_channel_id
      ? midjourneyConfig.niji_channel_id
      : midjourneyConfig.channel_id
  );

  if (!channelId) {
    throw new Error('--channel is required (or set MJ_CHANNEL_ID / NIJI_CHANNEL_ID in environment/config)');
  }

  const factoryConfig = (config && config.factory) || {};
  const configuredBrowserPath = factoryConfig.browser_path || config.browser_path || '';

  const launchOptions = {
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: ['--disable-blink-features=AutomationControlled'],
  };

  if (configuredBrowserPath) {
    launchOptions.executablePath = configuredBrowserPath;
  }

  const browser = await chromium.launchPersistentContext(STATE_PATH, launchOptions);
  try {
    process.stderr.write(`Using persistent profile: ${STATE_PATH}\n`);
    const page = await browser.newPage();
    page.setDefaultTimeout(timeoutMs);

  const channelUrl = `https://discord.com/channels/@me/${channelId}`;
  await openDiscordChannel(page, channelUrl, timeoutMs);

    const beforeUrlsByFile = await getAttachmentUrls(page, {
      channelId,
      fileName: path.basename(filePath),
    });

    const beforeUrlsAll = await getAttachmentUrls(page, {
      channelId,
      fileName: '',
    });

    const uploaded = await tryUploadViaButton(page, filePath, timeoutMs);
    if (!uploaded) {
      throw new Error('Unable to attach file in Discord UI (upload button not found)');
    }

    // Give Discord a moment to render the attachment preview, then send
    await sleep(1200);
    await page.keyboard.press('Enter');

    // Prefer filename match first. If Discord renames/transcodes, fall back to any new attachment in this DM.
    let url = await waitForNewAttachmentUrlWithTimeout(page, 25000, beforeUrlsByFile, {
      channelId,
      fileName: path.basename(filePath),
    });

    if (!url) {
      url = await waitForNewAttachmentUrl(page, timeoutMs, beforeUrlsAll, {
        channelId,
        fileName: '',
      });
    }
    process.stdout.write(JSON.stringify({ url }) + '\n');
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  process.stderr.write(String(e && e.stack ? e.stack : e) + '\n');
  process.exit(1);
});
