const express = require('express');
const fs = require('fs');
const path = require('path');
const { KNOWLEDGE_DIR, safeBaseName, listFilesByMtimeDesc } = require('../lib/helpers');

module.exports = () => {
  const router = express.Router();

  router.get('/list', (_req, res) => {
    const files = listFilesByMtimeDesc(KNOWLEDGE_DIR, (name) => name.endsWith('.md') || name.endsWith('.txt'));
    res.json({ files });
  });

  router.get('/read', (req, res) => {
    const name = safeBaseName(String(req.query.name || ''));
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    if (!name.endsWith('.md') && !name.endsWith('.txt')) {
      res.status(400).json({ error: 'unsupported file type' });
      return;
    }

    try {
      const content = fs.readFileSync(path.join(KNOWLEDGE_DIR, name), 'utf8');
      res.json({ name, content });
    } catch {
      res.status(404).json({ error: 'file not found' });
    }
  });

  router.post('/upsert', (req, res) => {
    const { name, content } = req.body || {};
    const safe = safeBaseName(String(name || ''));
    if (!safe) {
      res.status(400).json({ error: 'invalid name' });
      return;
    }
    if (!safe.endsWith('.md') && !safe.endsWith('.txt')) {
      res.status(400).json({ error: 'only .md or .txt supported' });
      return;
    }

    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });

    try {
      fs.writeFileSync(path.join(KNOWLEDGE_DIR, safe), typeof content === 'string' ? content : '');
      res.json({ status: 'ok', file: safe });
    } catch {
      res.status(500).json({ error: 'failed to write file' });
    }
  });

  router.post('/delete', (req, res) => {
    const safe = safeBaseName(String((req.body || {}).name || ''));
    if (!safe) {
      res.status(400).json({ error: 'invalid name' });
      return;
    }

    try {
      const fullPath = path.join(KNOWLEDGE_DIR, safe);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      res.json({ status: 'ok' });
    } catch {
      res.status(500).json({ error: 'failed to delete file' });
    }
  });

  return router;
};
