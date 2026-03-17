const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const { createCuratorApp } = require('../server');

const tempDirs = [];

function touchFile(filePath, content, mtime) {
  fs.writeFileSync(filePath, content);
  fs.utimesSync(filePath, mtime, mtime);
}

function makeDirs() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'curator-test-'));
  tempDirs.push(root);
  const incomingDir = path.join(root, 'incoming');
  const bestDir = path.join(root, 'best');
  fs.mkdirSync(incomingDir, { recursive: true });
  fs.mkdirSync(bestDir, { recursive: true });
  return { incomingDir, bestDir };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

describe('curator routes', () => {
  it('GET /api/images returns image files sorted newest first', async () => {
    const { incomingDir, bestDir } = makeDirs();
    touchFile(path.join(incomingDir, 'older.png'), 'older', new Date('2026-03-10T10:00:00Z'));
    touchFile(path.join(incomingDir, 'newer.webp'), 'newer', new Date('2026-03-10T11:00:00Z'));
    touchFile(path.join(incomingDir, 'notes.txt'), 'ignore', new Date('2026-03-10T12:00:00Z'));

    const { app } = createCuratorApp({ incomingDir, bestDir });
    const response = await request(app).get('/api/images');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(['newer.webp', 'older.png']);
  });

  it('POST /api/action keeps an image by moving it to best', async () => {
    const { incomingDir, bestDir } = makeDirs();
    fs.writeFileSync(path.join(incomingDir, 'hero.png'), 'hero');

    const { app } = createCuratorApp({ incomingDir, bestDir });
    const response = await request(app)
      .post('/api/action')
      .send({ filename: 'hero.png', action: 'keep' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
    expect(fs.existsSync(path.join(bestDir, 'hero.png'))).toBe(true);
    expect(fs.existsSync(path.join(incomingDir, 'hero.png'))).toBe(false);
  });

  it('POST /api/action discards an image from incoming', async () => {
    const { incomingDir, bestDir } = makeDirs();
    fs.writeFileSync(path.join(incomingDir, 'discard-me.jpg'), 'hero');

    const { app } = createCuratorApp({ incomingDir, bestDir });
    const response = await request(app)
      .post('/api/action')
      .send({ filename: 'discard-me.jpg', action: 'discard' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
    expect(fs.existsSync(path.join(incomingDir, 'discard-me.jpg'))).toBe(false);
  });

  it('POST /api/action returns 404 for missing files', async () => {
    const { incomingDir, bestDir } = makeDirs();
    const { app } = createCuratorApp({ incomingDir, bestDir });

    const response = await request(app)
      .post('/api/action')
      .send({ filename: 'missing.png', action: 'keep' });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('File not found');
  });
});
