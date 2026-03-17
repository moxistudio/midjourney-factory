const express = require('express');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const {
  CONFIG_PATH,
  DATA_ROOT,
  ENV_PATH,
  ensureRuntimeLayout,
  getNodeCommand,
  readEnvObject,
  readSettingsObject,
  resolveSourcePath,
  writeEnvObject,
  writeSettingsObject,
} = require('../lib/helpers');

const ENV_KEYS = [
  'LLM_PRIMARY_API_KEY',
  'LLM_PRIMARY_BASE_URL',
  'LLM_FALLBACK_API_KEY',
  'LLM_FALLBACK_BASE_URL',
  'DISCORD_TOKEN',
  'MJ_CHANNEL_ID',
  'NIJI_CHANNEL_ID',
];

function normalizeText(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildSettingsPayload(rawSettings = {}, rawEnv = {}) {
  const pythonCheck = spawnSync('python3', ['--version'], { encoding: 'utf8' });
  const playwrightCliPath = resolveSourcePath('modules', 'factory', 'node_modules', 'playwright', 'cli.js');
  const llm = rawSettings.llm && typeof rawSettings.llm === 'object' ? rawSettings.llm : {};
  const primary = llm.primary && typeof llm.primary === 'object' ? llm.primary : {};
  const fallback = llm.fallback && typeof llm.fallback === 'object' ? llm.fallback : {};
  const factory = rawSettings.factory && typeof rawSettings.factory === 'object' ? rawSettings.factory : {};

  return {
    runtime: {
      dataRoot: DATA_ROOT,
      configPath: CONFIG_PATH,
      envPath: ENV_PATH,
      isDesktop: process.env.MIDJOURNEY_FACTORY_DESKTOP === '1',
      pythonAvailable: !pythonCheck.error && pythonCheck.status === 0,
      pythonVersion: String((pythonCheck.stdout || pythonCheck.stderr || '')).trim(),
      playwrightCliPath,
    },
    env: {
      LLM_PRIMARY_API_KEY: String(rawEnv.LLM_PRIMARY_API_KEY || ''),
      LLM_PRIMARY_BASE_URL: String(rawEnv.LLM_PRIMARY_BASE_URL || ''),
      LLM_FALLBACK_API_KEY: String(rawEnv.LLM_FALLBACK_API_KEY || ''),
      LLM_FALLBACK_BASE_URL: String(rawEnv.LLM_FALLBACK_BASE_URL || ''),
      DISCORD_TOKEN: String(rawEnv.DISCORD_TOKEN || ''),
      MJ_CHANNEL_ID: String(rawEnv.MJ_CHANNEL_ID || ''),
      NIJI_CHANNEL_ID: String(rawEnv.NIJI_CHANNEL_ID || ''),
    },
    settings: {
      llm: {
        primary: {
          provider: normalizeText(primary.provider, 'openai') || 'openai',
          model: normalizeText(primary.model, 'qwen3.5-plus'),
          temperature: normalizeNumber(primary.temperature, 0.7),
        },
        fallback: {
          provider: normalizeText(fallback.provider, 'openai') || 'openai',
          model: normalizeText(fallback.model, ''),
          temperature: normalizeNumber(fallback.temperature, 0.7),
        },
      },
      factory: {
        browser_path: normalizeText(factory.browser_path, ''),
        discord_navigation_timeout_ms: normalizeNumber(factory.discord_navigation_timeout_ms, 180000),
      },
    },
  };
}

function buildSettingsDocument(body = {}) {
  const incomingSettings = body.settings && typeof body.settings === 'object' ? body.settings : {};
  const llm = incomingSettings.llm && typeof incomingSettings.llm === 'object' ? incomingSettings.llm : {};
  const primary = llm.primary && typeof llm.primary === 'object' ? llm.primary : {};
  const fallback = llm.fallback && typeof llm.fallback === 'object' ? llm.fallback : {};
  const factory = incomingSettings.factory && typeof incomingSettings.factory === 'object' ? incomingSettings.factory : {};

  return {
    llm: {
      primary: {
        provider: normalizeText(primary.provider, 'openai') || 'openai',
        base_url: '',
        api_key: '',
        model: normalizeText(primary.model, 'qwen3.5-plus'),
        temperature: normalizeNumber(primary.temperature, 0.7),
      },
      fallback: {
        provider: normalizeText(fallback.provider, 'openai') || 'openai',
        base_url: '',
        api_key: '',
        model: normalizeText(fallback.model, ''),
        temperature: normalizeNumber(fallback.temperature, 0.7),
      },
    },
    midjourney: {
      discord_token: '',
      channel_id: '',
      niji_channel_id: '',
    },
    factory: {
      browser_path: normalizeText(factory.browser_path, ''),
      discord_navigation_timeout_ms: normalizeNumber(factory.discord_navigation_timeout_ms, 180000),
    },
  };
}

module.exports = ({ io } = {}) => {
  const router = express.Router();

  router.get('/', (_req, res) => {
    ensureRuntimeLayout();
    res.json(buildSettingsPayload(readSettingsObject(), readEnvObject()));
  });

  router.post('/save', (req, res) => {
    ensureRuntimeLayout();
    const incomingEnv = req.body && req.body.env && typeof req.body.env === 'object' ? req.body.env : {};
    const nextEnv = { ...readEnvObject() };

    for (const key of ENV_KEYS) {
      nextEnv[key] = String(incomingEnv[key] || '').trim();
      process.env[key] = nextEnv[key];
    }

    writeEnvObject(nextEnv);
    const nextSettings = buildSettingsDocument(req.body || {});
    writeSettingsObject(nextSettings);

    if (io && typeof io.emit === 'function') {
      io.emit('log:architect', '\n🧩 Settings updated\n');
      io.emit('log:factory', '\n🧩 Settings updated\n');
    }

    res.json({
      status: 'ok',
      ...buildSettingsPayload(nextSettings, nextEnv),
    });
  });

  router.post('/discord-login', (req, res) => {
    const profile = String((req.body || {}).profile || 'factory').toLowerCase() === 'uploader' ? 'uploader' : 'factory';
    const scriptPath = resolveSourcePath('modules', 'factory', 'login.js');
    const child = spawn(getNodeCommand(), [scriptPath, '--profile', profile], {
      cwd: path.dirname(scriptPath),
      env: { ...process.env, FACTORY_PROFILE: profile },
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    if (io && typeof io.emit === 'function') {
      io.emit('log:factory', `\n🔐 Opened Discord login window (${profile})\n`);
    }

    res.json({ status: 'started', profile });
  });

  router.post('/install-playwright', async (_req, res) => {
    const cliPath = resolveSourcePath('modules', 'factory', 'node_modules', 'playwright', 'cli.js');
    const started = Date.now();

    try {
      const result = await new Promise((resolve, reject) => {
        const child = spawn(getNodeCommand(), [cliPath, 'install', 'chromium'], {
          cwd: path.dirname(cliPath),
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
        child.on('error', reject);
        child.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(stderr || stdout || `Playwright install failed with code ${code}`));
            return;
          }
          resolve({ stdout, stderr });
        });
      });

      if (io && typeof io.emit === 'function') {
        io.emit('log:factory', '\n🌐 Playwright Chromium installed\n');
      }

      res.json({
        status: 'ok',
        durationMs: Date.now() - started,
        output: String(result.stdout || result.stderr || '').trim(),
      });
    } catch (error) {
      res.status(500).json({ error: String(error && error.message ? error.message : error) });
    }
  });

  return router;
};
