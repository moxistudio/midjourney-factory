const path = require('path');
const express = require('express');
const next = require('next');
const http = require('http');
const { Server } = require('socket.io');
const { spawn, exec } = require('child_process');
const createArchitectRouter = require('./routes/architect');
const createFactoryRouter = require('./routes/factory');
const createCuratorRouter = require('./routes/curator');
const createPromptsRouter = require('./routes/prompts');
const createKnowledgeRouter = require('./routes/knowledge');
const createSettingsRouter = require('./routes/settings');
const createRefsRouter = require('./routes/refs');
const {
  DATA_ROOT,
  ENV_PATH,
  INCOMING_DIR,
  BEST_DIR,
  countVisibleFiles,
  ensureRuntimeLayout,
  getNodeCommand,
  resolveSourcePath,
} = require('./lib/helpers');

ensureRuntimeLayout();
require('dotenv').config({ path: ENV_PATH });

const app = next({ dev: process.env.NODE_ENV !== 'production', dir: __dirname });
const handle = app.getRequestHandler();
const CURATOR_URL = 'http://localhost:3000';

let factoryProcess = null;
let curatorProcess = null;
let desktopKeepalive = null;

const openUrl = (url) => {
  if (process.env.NO_AUTO_OPEN === '1') return;
  if (process.platform === 'darwin') exec(`open "${url}"`);
  else if (process.platform === 'win32') exec(`start "" "${url}"`);
  else exec(`xdg-open "${url}"`);
};

const ensureCurator = (io) => {
  if (curatorProcess) return;
  const curatorPath = resolveSourcePath('modules', 'curator', 'server.js');
  curatorProcess = spawn(getNodeCommand(), [curatorPath], {
    cwd: path.dirname(curatorPath),
    env: { ...process.env, FACTORY_INCOMING_DIR: INCOMING_DIR, FACTORY_BEST_DIR: BEST_DIR },
  });
  curatorProcess.stdout.on('data', (data) => io.emit('log:curator', data.toString()));
  curatorProcess.stderr.on('data', (data) => io.emit('log:curator', `ERR: ${data.toString()}`));
  curatorProcess.on('close', () => {
    curatorProcess = null;
  });
};

const stopCurator = () => {
  if (!curatorProcess) return;
  curatorProcess.kill();
  curatorProcess = null;
};

async function main() {
  if (process.env.MIDJOURNEY_FACTORY_DESKTOP === '1' && !desktopKeepalive) {
    // Keep one referenced handle alive for the packaged desktop runtime.
    desktopKeepalive = setInterval(() => {}, 60000);
  }

  await app.prepare();
  const server = express();
  const httpServer = http.createServer(server);
  const io = new Server(httpServer);
  const port = Number(process.env.PORT || 3001);
  const commanderUrl = `http://localhost:${port}`;

  server.use(express.json({ limit: '10mb' }));
  server.use('/api/architect', createArchitectRouter({ io }));
  server.use('/api/factory', createFactoryRouter({ io, getFactoryProcess: () => factoryProcess, setFactoryProcess: (processRef) => { factoryProcess = processRef; } }));
  server.use('/api/curator', createCuratorRouter({ startCurator: () => ensureCurator(io), curatorUrl: CURATOR_URL }));
  server.use('/api/prompts', createPromptsRouter());
  server.use('/api/knowledge', createKnowledgeRouter());
  server.use('/api/settings', createSettingsRouter({ io }));
  server.use('/api/refs', createRefsRouter());
  server.get('/api/health', (_req, res) => res.json({ status: 'ok', dataRoot: DATA_ROOT }));
  server.get('/api/stats', (_req, res) => res.json({
    incoming: countVisibleFiles(INCOMING_DIR),
    best: countVisibleFiles(BEST_DIR),
  }));
  server.all('*', (req, res) => handle(req, res));

  httpServer.listen(port, (err) => {
    if (err) throw err;
    ensureCurator(io);
    console.log(`> Commander Dashboard ready on ${commanderUrl}`);
    openUrl(commanderUrl);
  });

  process.on('SIGINT', () => {
    if (desktopKeepalive) clearInterval(desktopKeepalive);
    stopCurator();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    if (desktopKeepalive) clearInterval(desktopKeepalive);
    stopCurator();
    process.exit(0);
  });
  process.on('SIGHUP', () => {
    if (desktopKeepalive) clearInterval(desktopKeepalive);
    stopCurator();
    process.exit(0);
  });
  process.on('exit', () => {
    if (desktopKeepalive) {
      clearInterval(desktopKeepalive);
      desktopKeepalive = null;
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
