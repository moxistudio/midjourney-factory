const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const { getNodeCommand, resolveSourcePath } = require('../lib/helpers');

module.exports = ({ io, getFactoryProcess, setFactoryProcess }) => {
  const router = express.Router();

  router.post('/toggle', (req, res) => {
    const { action } = req.body || {};

    if (action === 'start') {
      if (getFactoryProcess()) {
        res.json({ status: 'already_running' });
        return;
      }

      const botPath = resolveSourcePath('modules', 'factory', 'bot.js');
      const child = spawn(getNodeCommand(), [botPath], {
        cwd: path.dirname(botPath),
        env: { ...process.env },
      });
      setFactoryProcess(child);

      io.emit('status:factory', 'running');
      io.emit('log:factory', '\n🏭 FACTORY STARTED\n');
      child.stdout.on('data', (data) => io.emit('log:factory', data.toString()));
      child.stderr.on('data', (data) => io.emit('log:factory', `ERR: ${data.toString()}`));
      child.on('close', (code) => {
        setFactoryProcess(null);
        io.emit('status:factory', 'stopped');
        io.emit('log:factory', `\n🛑 Factory stopped (${code})\n`);
      });

      res.json({ status: 'started' });
      return;
    }

    if (action === 'stop') {
      const current = getFactoryProcess();
      if (current) {
        current.kill();
        setFactoryProcess(null);
      }
      io.emit('status:factory', 'stopped');
      res.json({ status: 'stopped' });
      return;
    }

    res.status(400).json({ error: 'Invalid action' });
  });

  return router;
};
