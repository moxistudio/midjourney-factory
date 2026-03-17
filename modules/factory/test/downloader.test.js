const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  ATTACHMENT_URL_PATTERN,
  extractOriginalFilename,
  saveDownloadedImage,
} = require('../downloader');

const tempDirs = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

describe('downloader helpers', () => {
  it('matches Discord CDN attachment URLs only', () => {
    expect(ATTACHMENT_URL_PATTERN.test('https://cdn.discordapp.com/attachments/1/2/file.png')).toBe(true);
    expect(ATTACHMENT_URL_PATTERN.test('https://media.discordapp.net/attachments/1/2/file.webp')).toBe(true);
    expect(ATTACHMENT_URL_PATTERN.test('https://example.com/attachments/1/2/file.png')).toBe(false);
  });

  it('sanitizes original filenames from Discord URLs', () => {
    const filename = extractOriginalFilename(
      'https://cdn.discordapp.com/attachments/1/2/My%20File%20(1).png?width=1024',
      'image/png'
    );

    expect(filename).toBe('My_File_1.png');
  });

  it('creates image and sidecar files with generated metadata', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-download-'));
    tempDirs.push(outputDir);

    const result = await saveDownloadedImage({
      buffer: Buffer.from('image-bytes'),
      sourceUrl: 'https://cdn.discordapp.com/attachments/1/2/My%20File%20(1).png',
      contentType: 'image/png',
      strategy: 'playwright_response',
      metadata: {
        topic: 'Space Opera',
        promptIndex: 2,
        prompt: 'cinematic nebula',
        batchFile: 'batch.json',
        channelId: '123456',
      },
      discordMessageId: 'discord-message-1',
      outputDir,
    });

    expect(result.filename).toMatch(/^\d{8}_\d{6}_Space_Opera_2_My_File_1\.png$/);
    expect(fs.existsSync(result.imagePath)).toBe(true);
    expect(fs.existsSync(result.sidecarPath)).toBe(true);

    const sidecar = JSON.parse(fs.readFileSync(result.sidecarPath, 'utf8'));
    expect(sidecar).toMatchObject({
      prompt: 'cinematic nebula',
      batchFile: 'batch.json',
      promptIndex: 2,
      topic: 'Space Opera',
      topicSlug: 'Space_Opera',
      channelId: '123456',
      downloadStrategy: 'playwright_response',
      sourceUrl: 'https://cdn.discordapp.com/attachments/1/2/My%20File%20(1).png',
      originalFilename: 'My_File_1.png',
      contentType: 'image/png',
      discordMessageId: 'discord-message-1',
    });
    expect(typeof sidecar.savedAt).toBe('string');
  });
});
