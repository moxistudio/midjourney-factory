const express = require('express');
const fs = require('fs');
const path = require('path');
const { PROMPTS_DIR, DRAFTS_DIR, safeBaseName, listFilesByMtimeDesc } = require('../lib/helpers');

module.exports = () => {
  const router = express.Router();

  router.get('/drafts/latest', (_req, res) => {
    const files = listFilesByMtimeDesc(DRAFTS_DIR, (name) => name.endsWith('.json') && !name.includes('_done'));
    if (files.length === 0) {
      res.status(404).json({ error: 'No draft prompts found' });
      return;
    }

    const file = files[0];
    try {
      const data = JSON.parse(fs.readFileSync(path.join(DRAFTS_DIR, file), 'utf8'));
      res.json({ file, data });
    } catch {
      res.status(500).json({ error: 'Failed to read draft file' });
    }
  });

  router.get('/drafts/list', (_req, res) => {
    const files = listFilesByMtimeDesc(DRAFTS_DIR, (name) => name.endsWith('.json'));
    const items = files.slice(0, 60).map((file) => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(DRAFTS_DIR, file), 'utf8'));
        return {
          file,
          topic: String(data && data.topic ? data.topic : ''),
          generated_at: String(data && data.generated_at ? data.generated_at : ''),
          count: Number(data && data.count ? data.count : 0),
          mode: String(data && data.mode ? data.mode : ''),
        };
      } catch {
        return { file, topic: '', generated_at: '', count: 0, mode: '' };
      }
    });

    res.json({ files: items });
  });

  router.get('/drafts/read', (req, res) => {
    const file = safeBaseName(String(req.query.file || ''));
    if (!file) {
      res.status(400).json({ error: 'file is required' });
      return;
    }
    if (!file.endsWith('.json')) {
      res.status(400).json({ error: 'unsupported file type' });
      return;
    }

    try {
      const data = JSON.parse(fs.readFileSync(path.join(DRAFTS_DIR, file), 'utf8'));
      res.json({ file, data });
    } catch {
      res.status(404).json({ error: 'file not found' });
    }
  });

  router.post('/approve', (req, res) => {
    const { topic, prompts, sourceDraft, mode } = req.body || {};
    if (!topic || !String(topic).trim()) {
      res.status(400).json({ error: 'topic is required' });
      return;
    }
    if (!Array.isArray(prompts) || prompts.length === 0) {
      res.status(400).json({ error: 'prompts array is required' });
      return;
    }

    fs.mkdirSync(PROMPTS_DIR, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeTopic = String(topic)
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^\w\-\u4e00-\u9fa5]/g, '_')
      .slice(0, 50);
    const filename = `${timestamp}_${safeTopic || 'approved'}.json`;
    const payload = {
      topic: String(topic).trim(),
      mode: String(mode || '').trim() || 'standard',
      generated_at: new Date().toISOString(),
      count: prompts.length,
      prompts,
    };

    try {
      fs.writeFileSync(path.join(PROMPTS_DIR, filename), JSON.stringify(payload, null, 2));
    } catch {
      res.status(500).json({ error: 'Failed to write approved prompts file' });
      return;
    }

    if (sourceDraft) {
      const safe = safeBaseName(String(sourceDraft));
      if (safe) {
        const src = path.join(DRAFTS_DIR, safe);
        const dst = path.join(DRAFTS_DIR, safe.replace(/\.json$/, '') + '_approved.json');
        try {
          if (fs.existsSync(src)) fs.renameSync(src, dst);
        } catch {
          // ignore
        }
      }
    }

    res.json({ status: 'ok', file: filename });
  });

  return router;
};
