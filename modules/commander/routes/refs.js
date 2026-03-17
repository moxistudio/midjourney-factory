const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const {
  OUTPUT_DIR,
  getNodeCommand,
  readSettingsYamlRaw,
  getEnvOrYamlString,
  resolveSourcePath,
  safeBaseName,
} = require('../lib/helpers');

module.exports = () => {
  const router = express.Router();

  router.post('/upload-discord', (req, res) => {
    const { filename, dataBase64, mode } = req.body || {};
    const safeName = safeBaseName(String(filename || ''));
    if (!safeName) {
      res.status(400).json({ error: 'invalid filename' });
      return;
    }

    const base64 = String(dataBase64 || '').trim();
    if (!base64) {
      res.status(400).json({ error: 'dataBase64 is required' });
      return;
    }

    let buffer;
    try {
      buffer = Buffer.from(base64, 'base64');
    } catch {
      res.status(400).json({ error: 'invalid base64' });
      return;
    }

    let raw;
    try {
      raw = readSettingsYamlRaw();
    } catch {
      res.status(500).json({ error: 'failed to read config/settings.yaml' });
      return;
    }

    const mjChannelId = getEnvOrYamlString(raw, 'channel_id', 'MJ_CHANNEL_ID');
    const nijiChannelId = getEnvOrYamlString(raw, 'niji_channel_id', 'NIJI_CHANNEL_ID');
    const isNiji = String(mode || '').toLowerCase().includes('niji');
    const channelId = isNiji && nijiChannelId ? nijiChannelId : mjChannelId;

    if (!channelId) {
      res.status(400).json({ error: 'midjourney.channel_id is not configured (set MJ_CHANNEL_ID or config/settings.yaml)' });
      return;
    }

    const tmpDir = path.join(OUTPUT_DIR, 'refs_tmp');
    fs.mkdirSync(tmpDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const tmpPath = path.join(tmpDir, `${stamp}_${safeName}`);

    try {
      fs.writeFileSync(tmpPath, buffer);
    } catch {
      res.status(500).json({ error: 'failed to write temp file' });
      return;
    }

    const scriptPath = resolveSourcePath('modules', 'factory', 'upload_ref.js');
    const child = spawn(getNodeCommand(), [scriptPath, '--channel', channelId, '--file', tmpPath, '--timeout', '300000'], {
      cwd: path.dirname(scriptPath),
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // ignore
      }

      if (code !== 0) {
        res.status(502).json({
          error: `discord upload failed (${code}). If you are not logged in, run modules/factory: npm run login:uploader. Details: ${stderr || stdout}`,
        });
        return;
      }

      try {
        const lastLine = stdout.trim().split('\n').pop();
        const json = JSON.parse(lastLine);
        const url = String(json.url || '').trim();
        if (!url) throw new Error('no url');
        res.json({ status: 'ok', url });
      } catch {
        res.status(502).json({ error: `unexpected upload output: ${stdout || stderr}` });
      }
    });
  });

  router.post('/upload', async (req, res) => {
    const { filename, mimeType, dataBase64 } = req.body || {};
    const safeName = safeBaseName(String(filename || ''));
    if (!safeName) {
      res.status(400).json({ error: 'invalid filename' });
      return;
    }

    const base64 = String(dataBase64 || '').trim();
    if (!base64) {
      res.status(400).json({ error: 'dataBase64 is required' });
      return;
    }

    const token = String(process.env.GDRIVE_ACCESS_TOKEN || '').trim();
    const folderId = String(process.env.GDRIVE_FOLDER_ID || '').trim();
    if (!token || !folderId) {
      res.status(400).json({
        error: 'Google Drive not configured. Set env vars: GDRIVE_ACCESS_TOKEN and GDRIVE_FOLDER_ID (restart commander).',
      });
      return;
    }

    let buffer;
    try {
      buffer = Buffer.from(base64, 'base64');
    } catch {
      res.status(400).json({ error: 'invalid base64' });
      return;
    }

    const boundary = 'opencode_' + Math.random().toString(16).slice(2);
    const metaPart =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify({ name: safeName, parents: [folderId] }) +
      '\r\n';
    const filePartHeader =
      `--${boundary}\r\n` +
      `Content-Type: ${String(mimeType || 'application/octet-stream')}\r\n\r\n`;
    const body = Buffer.concat([
      Buffer.from(metaPart, 'utf8'),
      Buffer.from(filePartHeader, 'utf8'),
      buffer,
      Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'),
    ]);

    try {
      const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      });

      const uploadJson = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        res.status(502).json({ error: `Drive upload failed: ${JSON.stringify(uploadJson)}` });
        return;
      }

      const fileId = String(uploadJson.id || '').trim();
      if (!fileId) {
        res.status(502).json({ error: 'Drive upload succeeded but no file id returned' });
        return;
      }

      const permRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      });

      if (!permRes.ok) {
        const permJson = await permRes.json().catch(() => ({}));
        res.status(502).json({ error: `Drive permission failed: ${JSON.stringify(permJson)}` });
        return;
      }

      res.json({
        status: 'ok',
        id: fileId,
        url: `https://drive.google.com/uc?export=view&id=${fileId}`,
        shareUrl: `https://drive.google.com/file/d/${fileId}/view?usp=sharing`,
      });
    } catch (error) {
      res.status(500).json({ error: String(error && error.message ? error.message : error) });
    }
  });

  return router;
};
