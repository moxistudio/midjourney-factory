const fs = require('fs');
const path = require('path');

const DATA_ROOT = path.resolve(process.env.MIDJOURNEY_FACTORY_HOME || path.join(__dirname, '../..'));
const INCOMING_DIR = path.join(DATA_ROOT, 'output', 'incoming');
const PLAYWRIGHT_TIMEOUT_MS = 180000;
const DISCORD_API_TIMEOUT_MS = 30000;
const ATTACHMENT_URL_PATTERN = /^https:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net)\/attachments\//i;

function sanitizeSegment(value, fallback = 'unknown') {
  const normalized = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || fallback;
}

function formatTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('') + '_' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('');
}

function extensionFromContentType(contentType) {
  const normalized = String(contentType || '').toLowerCase();
  if (normalized.includes('jpeg')) return '.jpg';
  if (normalized.includes('png')) return '.png';
  if (normalized.includes('webp')) return '.webp';
  if (normalized.includes('gif')) return '.gif';
  if (normalized.includes('bmp')) return '.bmp';
  if (normalized.includes('avif')) return '.avif';
  return '';
}

function resolveIncomingDir(overrideDir) {
  if (overrideDir) {
    return path.resolve(overrideDir);
  }

  const envDir = String(process.env.FACTORY_INCOMING_DIR || '').trim();
  return envDir ? path.resolve(envDir) : INCOMING_DIR;
}

function extractOriginalFilename(sourceUrl, contentType) {
  try {
    const parsed = new URL(sourceUrl);
    const rawName = path.basename(decodeURIComponent(parsed.pathname));
    if (rawName && rawName !== '/') {
      const parts = path.parse(rawName);
      const safeBase = sanitizeSegment(parts.name, 'discord_image');
      const safeExt = parts.ext || extensionFromContentType(contentType) || '.jpg';
      return `${safeBase}${safeExt}`;
    }
  } catch (error) {
    // Fall through to the content-type-based fallback.
  }

  return `discord_image${extensionFromContentType(contentType) || '.jpg'}`;
}

function isImageContentType(contentType) {
  return String(contentType || '').toLowerCase().startsWith('image/');
}

function isImageAttachment(attachment) {
  if (!attachment || typeof attachment !== 'object') {
    return false;
  }

  if (isImageContentType(attachment.content_type)) {
    return true;
  }

  return ATTACHMENT_URL_PATTERN.test(String(attachment.url || ''));
}

function createFetchErrorMessage(response, bodyText) {
  const suffix = bodyText ? ` - ${bodyText.slice(0, 200)}` : '';
  return `HTTP ${response.status} ${response.statusText}${suffix}`;
}

async function getFetchImpl() {
  if (typeof fetch === 'function') {
    return fetch.bind(globalThis);
  }

  const imported = await import('node-fetch');
  return imported.default || imported;
}

async function fetchWithTimeout(resource, options = {}, timeoutMs = DISCORD_API_TIMEOUT_MS) {
  const fetchImpl = await getFetchImpl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(resource, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function saveDownloadedImage({
  buffer,
  sourceUrl,
  contentType,
  strategy,
  metadata,
  discordMessageId,
  outputDir,
}) {
  const incomingDir = resolveIncomingDir(outputDir);
  await fs.promises.mkdir(incomingDir, { recursive: true });

  const originalFilename = extractOriginalFilename(sourceUrl, contentType);
  const timestamp = formatTimestamp(new Date());
  const topic = String(metadata.topic || 'unknown');
  const topicSlug = sanitizeSegment(topic, 'unknown');
  const promptIndex = Number.isFinite(Number(metadata.promptIndex))
    ? String(metadata.promptIndex)
    : 'unknown';
  const outputFilename = `${timestamp}_${topicSlug}_${promptIndex}_${originalFilename}`;
  const imagePath = path.join(incomingDir, outputFilename);
  const sidecarPath = path.join(incomingDir, `${path.parse(outputFilename).name}.json`);
  const savedAt = new Date().toISOString();

  await fs.promises.writeFile(imagePath, buffer);

  const sidecar = {
    prompt: metadata.prompt || '',
    batchFile: metadata.batchFile || '',
    promptIndex: metadata.promptIndex,
    topic,
    topicSlug,
    channelId: metadata.channelId || '',
    downloadStrategy: strategy,
    sourceUrl,
    originalFilename,
    contentType,
    discordMessageId: discordMessageId || null,
    savedAt
  };

  await fs.promises.writeFile(sidecarPath, `${JSON.stringify(sidecar, null, 2)}\n`, 'utf8');

  return {
    strategy,
    imagePath,
    sidecarPath,
    filename: outputFilename,
    sourceUrl
  };
}

function selectLatestMessageWithAttachment(messages, startedAtIso) {
  const startedAtMs = Date.parse(startedAtIso);
  const recentThresholdMs = Number.isNaN(startedAtMs) ? null : startedAtMs - 15000;
  const orderedMessages = Array.isArray(messages)
    ? [...messages].sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    : [];

  const candidates = orderedMessages.filter((message) =>
    Array.isArray(message.attachments) && message.attachments.some(isImageAttachment)
  );

  if (candidates.length === 0) {
    return null;
  }

  if (recentThresholdMs == null) {
    return candidates[0];
  }

  return candidates.find((message) => Date.parse(message.timestamp) >= recentThresholdMs) || candidates[0];
}

async function downloadViaDiscordApi(config, metadata) {
  const discordToken = String(config?.midjourney?.discord_token || '').trim();
  const channelId = String(metadata.channelId || '').trim();

  if (!discordToken) {
    throw new Error('Discord REST fallback is unavailable because config.midjourney.discord_token is missing.');
  }

  if (!channelId) {
    throw new Error('Discord REST fallback is unavailable because channelId metadata is missing.');
  }

  const messagesResponse = await fetchWithTimeout(
    `https://discord.com/api/v10/channels/${channelId}/messages?limit=5`,
    {
      headers: {
        Authorization: discordToken
      }
    }
  );

  if (!messagesResponse.ok) {
    const errorBody = await messagesResponse.text().catch(() => '');
    throw new Error(`Discord message lookup failed: ${createFetchErrorMessage(messagesResponse, errorBody)}`);
  }

  const messages = await messagesResponse.json();
  const message = selectLatestMessageWithAttachment(messages, metadata.startedAt);
  if (!message) {
    throw new Error('Discord REST fallback did not find a recent message with image attachments.');
  }

  const attachment = message.attachments.find(isImageAttachment);
  if (!attachment) {
    throw new Error('Discord REST fallback found a message, but it did not contain an image attachment.');
  }

  const imageResponse = await fetchWithTimeout(attachment.url);
  if (!imageResponse.ok) {
    const errorBody = await imageResponse.text().catch(() => '');
    throw new Error(`Discord attachment download failed: ${createFetchErrorMessage(imageResponse, errorBody)}`);
  }

  const contentType = attachment.content_type || imageResponse.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await imageResponse.arrayBuffer());

  return saveDownloadedImage({
    buffer,
    sourceUrl: attachment.url,
    contentType,
    strategy: 'discord_rest_api',
    metadata,
    discordMessageId: message.id
  });
}

function waitForPlaywrightImage(page, metadata) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      clearTimeout(timeoutId);
      page.off('response', handler);
    };

    const resolveOnce = async (resultPromise) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();

      try {
        resolve(await resultPromise);
      } catch (error) {
        reject(error);
      }
    };

    const rejectOnce = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    const handler = async (response) => {
      const url = response.url();
      if (!ATTACHMENT_URL_PATTERN.test(url)) {
        return;
      }

      const headers = typeof response.allHeaders === 'function'
        ? await response.allHeaders().catch(() => ({}))
        : (typeof response.headers === 'function' ? await response.headers() : {});
      const contentType = headers['content-type'] || '';
      if (!isImageContentType(contentType)) {
        return;
      }

      if (!response.ok()) {
        return;
      }

      await resolveOnce(
        (async () => {
          const buffer = await response.body();
          if (!buffer || buffer.length === 0) {
            throw new Error('Intercepted an attachment response, but the image body was empty.');
          }

          return saveDownloadedImage({
            buffer,
            sourceUrl: url,
            contentType,
            strategy: 'playwright_response',
            metadata
          });
        })()
      );
    };

    const timeoutId = setTimeout(() => {
      rejectOnce(new Error(`Timed out waiting ${PLAYWRIGHT_TIMEOUT_MS}ms for a Discord attachment response.`));
    }, PLAYWRIGHT_TIMEOUT_MS);

    page.on('response', handler);
  });
}

async function downloadImage(page, config, metadata = {}) {
  const enrichedMetadata = {
    ...metadata,
    startedAt: metadata.startedAt || new Date().toISOString()
  };

  try {
    return await waitForPlaywrightImage(page, enrichedMetadata);
  } catch (playwrightError) {
    try {
      const fallbackResult = await downloadViaDiscordApi(config, enrichedMetadata);
      return {
        ...fallbackResult,
        fallbackReason: playwrightError.message
      };
    } catch (apiError) {
      throw new Error(
        `Image download failed. Playwright interception error: ${playwrightError.message}. Discord REST fallback error: ${apiError.message}`
      );
    }
  }
}

module.exports = {
  ATTACHMENT_URL_PATTERN,
  downloadImage,
  extractOriginalFilename,
  isImageAttachment,
  resolveIncomingDir,
  saveDownloadedImage
};
