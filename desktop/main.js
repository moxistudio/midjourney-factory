const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const { app, BrowserWindow, Menu, dialog, shell } = require('electron');

const SOURCE_ROOT = path.resolve(__dirname, '..');
const COMMANDER_ENTRY = path.join(SOURCE_ROOT, 'modules', 'commander', 'server.js');
const SPLASH_PATH = path.join(__dirname, 'splash.html');
const DESKTOP_ROOT_URL = pathToFileURL(`${__dirname}${path.sep}`).toString();
const COMMANDER_RESTART_WINDOW_MS = 30000;
const COMMANDER_MAX_RESTARTS = 3;

let mainWindow = null;
let commanderProcess = null;
let commanderPort = 0;
let isQuitting = false;
let commanderLogTail = [];
let commanderRestartHistory = [];
let isRestartingCommander = false;

function getDataRoot() {
  return path.join(app.getPath('userData'), 'workspace');
}

function getDesktopLogPath() {
  return path.join(getDataRoot(), 'output', 'logs', 'desktop.log');
}

function appendDesktopLog(message) {
  try {
    const line = String(message || '');
    const logPath = getDesktopLogPath();
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, line);
  } catch {
    // Best-effort logging only.
  }
}

function logDesktop(message) {
  appendDesktopLog(`[${new Date().toISOString()}] ${String(message || '')}\n`);
}

function isAllowedNavigation(url) {
  if (!url) return false;
  if (url === 'about:blank') return true;
  if (url.startsWith(DESKTOP_ROOT_URL)) return true;
  if (commanderPort && url.startsWith(`http://127.0.0.1:${commanderPort}`)) return true;
  if (url.startsWith('http://localhost:3000')) return true;
  return false;
}

function shouldOpenExternally(url) {
  return /^https?:\/\//.test(url) || url.startsWith('mailto:');
}

function pushCommanderLog(prefix, data) {
  const text = `${prefix}${String(data || '')}`;
  commanderLogTail.push(text);
  if (commanderLogTail.length > 80) commanderLogTail = commanderLogTail.slice(-80);
  appendDesktopLog(`[${new Date().toISOString()}] ${text}`);
}

function requestUrl(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({
        statusCode: res.statusCode || 0,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
  });
}

function pickFreePort(start = 3101, end = 3199) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      if (port > end) {
        reject(new Error(`No free port found between ${start} and ${end}`));
        return;
      }

      const server = net.createServer();
      server.once('error', () => tryPort(port + 1));
      server.once('listening', () => {
        server.close(() => resolve(port));
      });
      server.listen(port, '127.0.0.1');
    };

    tryPort(start);
  });
}

async function waitForCommander(port, timeoutMs = 120000) {
  const started = Date.now();
  const healthUrl = `http://127.0.0.1:${port}/api/health`;

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await requestUrl(healthUrl);
      if (response.statusCode >= 200 && response.statusCode < 300) return;
    } catch {
      // Keep polling until timeout.
    }

    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  throw new Error(`Commander did not become ready within ${Math.round(timeoutMs / 1000)}s.`);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    backgroundColor: '#0f0f23',
    title: 'Midjourney Factory',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(SPLASH_PATH).catch((error) => {
    if (error && error.code !== 'ERR_ABORTED') {
      logDesktop(`failed to load splash screen: ${String(error.message || error)}`);
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (shouldOpenExternally(url)) shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAllowedNavigation(url)) return;
    event.preventDefault();
    if (shouldOpenExternally(url)) shell.openExternal(url).catch(() => {});
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (!isQuitting) stopCommander();
  });
}

async function resetMainWindowScrollPosition() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  await mainWindow.webContents.executeJavaScript(`
    (() => {
      const forceTop = () => {
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      };

      forceTop();
      requestAnimationFrame(() => requestAnimationFrame(forceTop));
      setTimeout(forceTop, 120);
    })();
  `, true).catch(() => {});
}

function startCommander(port) {
  commanderLogTail = [];
  const env = {
    ...process.env,
    PORT: String(port),
    NODE_ENV: 'production',
    NO_AUTO_OPEN: '1',
    MIDJOURNEY_FACTORY_HOME: getDataRoot(),
    MIDJOURNEY_FACTORY_DESKTOP: '1',
    MIDJOURNEY_FACTORY_NODE_BIN: process.execPath,
    ELECTRON_RUN_AS_NODE: '1',
  };

  commanderProcess = spawn(process.execPath, [COMMANDER_ENTRY], {
    cwd: path.dirname(COMMANDER_ENTRY),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  logDesktop(`starting commander on port ${port}`);
  logDesktop(`commander entry: ${COMMANDER_ENTRY}`);

  commanderProcess.stdout.on('data', (data) => {
    process.stdout.write(`[commander] ${data}`);
    pushCommanderLog('[commander] ', data);
  });
  commanderProcess.stderr.on('data', (data) => {
    process.stderr.write(`[commander:err] ${data}`);
    pushCommanderLog('[commander:err] ', data);
  });
  commanderProcess.on('close', (code, signal) => {
    commanderProcess = null;
    if (isQuitting) return;
    logDesktop(`commander exited with code ${code} signal ${signal || 'none'}`);

    if (!mainWindow || mainWindow.isDestroyed()) return;

    const now = Date.now();
    commanderRestartHistory = commanderRestartHistory.filter((time) => now - time < COMMANDER_RESTART_WINDOW_MS);
    if (commanderRestartHistory.length < COMMANDER_MAX_RESTARTS && !isRestartingCommander) {
      commanderRestartHistory.push(now);
      recoverCommander().catch((error) => {
        logDesktop(`commander restart failed: ${String(error && error.message ? error.message : error)}`);
        const message = `Commander failed to restart.\n\n${String(error && error.message ? error.message : error)}\n\nFull log: ${getDesktopLogPath()}`;
        dialog.showErrorBox('Midjourney Factory stopped', message);
        if (mainWindow) mainWindow.close();
      });
      return;
    }

    const recentLogs = commanderLogTail
      .slice(-12)
      .join('')
      .trim()
      .slice(-1800);
    const message = recentLogs
      ? `Commander exited with code ${code}.\nSignal: ${signal || 'none'}\n\nRecent log:\n${recentLogs}\n\nFull log: ${getDesktopLogPath()}`
      : `Commander exited with code ${code}.\nSignal: ${signal || 'none'}\n\nFull log: ${getDesktopLogPath()}`;
    dialog.showErrorBox(
      'Midjourney Factory stopped',
      message
    );
    if (mainWindow) mainWindow.close();
  });
}

function stopCommander() {
  if (!commanderProcess) return;
  commanderProcess.kill('SIGTERM');
  commanderProcess = null;
}

async function recoverCommander() {
  if (isQuitting || isRestartingCommander) return;
  isRestartingCommander = true;

  try {
    logDesktop(`restarting commander on port ${commanderPort}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      await mainWindow.loadFile(SPLASH_PATH).catch((error) => {
        if (error && error.code !== 'ERR_ABORTED') {
          logDesktop(`failed to reload splash screen: ${String(error.message || error)}`);
        }
      });
    }
    startCommander(commanderPort);
    await waitForCommander(commanderPort, 30000);
    commanderRestartHistory = [];

    if (mainWindow && !mainWindow.isDestroyed()) {
      await mainWindow.loadURL(`http://127.0.0.1:${commanderPort}`);
      await resetMainWindowScrollPosition();
      mainWindow.show();
    }
    logDesktop('commander restart succeeded');
  } finally {
    isRestartingCommander = false;
  }
}

async function boot() {
  Menu.setApplicationMenu(null);
  createWindow();

  commanderPort = await pickFreePort();
  startCommander(commanderPort);
  await waitForCommander(commanderPort);
  commanderRestartHistory = [];

  if (!mainWindow) return;
  await mainWindow.loadURL(`http://127.0.0.1:${commanderPort}`);
  await resetMainWindowScrollPosition();
  mainWindow.show();
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', async () => {
  if (!mainWindow) {
    await boot().catch((error) => {
      dialog.showErrorBox('Midjourney Factory failed to start', String(error && error.message ? error.message : error));
      app.quit();
    });
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopCommander();
});

app.whenReady().then(() => boot()).catch((error) => {
  dialog.showErrorBox('Midjourney Factory failed to start', String(error && error.message ? error.message : error));
  app.quit();
});
