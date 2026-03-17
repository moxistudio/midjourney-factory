const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { DRAFTS_DIR, listFilesByMtimeDesc, makePromptObject, resolveSourcePath } = require('../lib/helpers');
const { ensureArchitectPython } = require('../lib/architectRuntime');

module.exports = ({ io }) => {
  const router = express.Router();

  router.post('/run', (req, res) => {
    const { topic, count, niji, requirements, detailLevel, useKnowledge } = req.body || {};
    if (!topic || !String(topic).trim()) {
      res.status(400).json({ error: 'topic is required' });
      return;
    }

    fs.mkdirSync(DRAFTS_DIR, { recursive: true });

    const scriptPath = resolveSourcePath('modules', 'architect', 'main.py');
    const args = [
      scriptPath,
      String(topic),
      '--count',
      String(count || 20),
      '--output-dir',
      DRAFTS_DIR,
      '--detail',
      String(detailLevel || 3),
    ];

    if (niji) args.push('--niji');
    if (useKnowledge === false) args.push('--no-knowledge');
    if (requirements && String(requirements).trim()) {
      args.push('--requirements', String(requirements));
    }

    io.emit('log:architect', `\n🚀 ARCHITECT STARTED (${niji ? 'NIJI' : 'MJ'})\n`);
    io.emit('status:architect', { state: 'running' });
    let pythonCmd;

    try {
      pythonCmd = ensureArchitectPython({ io });
    } catch (error) {
      const message = String(error.message || error);
      io.emit('log:architect', `ERR: ${message}\n`);
      io.emit('status:architect', { state: 'failed', code: 1, message });
      io.emit('log:architect', '\n❌ Architect finished with code 1\n');
      res.status(500).json({ error: message });
      return;
    }

    const py = spawn(pythonCmd, args, { cwd: path.dirname(scriptPath) });
    py.stdout.on('data', (data) => io.emit('log:architect', data.toString()));
    py.stderr.on('data', (data) => io.emit('log:architect', `ERR: ${data.toString()}`));
    py.on('close', (code) => {
      const status = code === 0 ? 'succeeded' : 'failed';
      const icon = code === 0 ? '✅' : '❌';
      const file = code === 0 ? listFilesByMtimeDesc(DRAFTS_DIR, (name) => name.endsWith('.json') && !name.includes('_done'))[0] || '' : '';
      io.emit('status:architect', { state: status, code, file });
      io.emit('log:architect', `\n${icon} Architect finished with code ${code}\n`);
    });

    res.json({ status: 'started' });
  });

  router.post('/import', (req, res) => {
    const { promptsText, niji } = req.body || {};
    const lines = String(promptsText || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      res.status(400).json({ error: 'No prompts provided' });
      return;
    }

    const prompts = lines.map((line) => makePromptObject(line, Boolean(niji)));
    fs.mkdirSync(DRAFTS_DIR, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}_import${niji ? '_niji' : ''}.json`;
    const outputPath = path.join(DRAFTS_DIR, filename);
    const payload = {
      topic: 'manual-import',
      mode: niji ? 'niji' : 'standard',
      generated_at: new Date().toISOString(),
      count: prompts.length,
      prompts,
    };

    fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
    io.emit('log:architect', `\n📥 Imported ${prompts.length} prompts -> ${filename}\n`);
    res.json({ status: 'ok', count: prompts.length, file: filename });
  });

  return router;
};
