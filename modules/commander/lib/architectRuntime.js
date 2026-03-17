const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { DATA_ROOT, SOURCE_ROOT } = require('./helpers');

const REQUIRED_IMPORTS = 'import typer, yaml, rich, openai';

function getArchitectPaths(
  sourceRoot = SOURCE_ROOT,
  dataRoot = DATA_ROOT,
  platform = process.platform
) {
  const architectDir = path.join(sourceRoot, 'modules', 'architect');
  const architectRuntimeDir = path.join(dataRoot, 'modules', 'architect');
  const venvDir = path.join(architectRuntimeDir, '.venv');
  const venvPython = platform === 'win32'
    ? path.join(venvDir, 'Scripts', 'python.exe')
    : path.join(venvDir, 'bin', 'python');

  return {
    architectDir,
    architectRuntimeDir,
    requirementsPath: path.join(architectDir, 'requirements.txt'),
    venvDir,
    venvPython,
  };
}

function emitArchitectLog(io, message, isError = false) {
  if (!io || typeof io.emit !== 'function' || !message) return;
  io.emit('log:architect', isError ? `ERR: ${message}` : message);
}

function forwardSpawnOutput(io, result) {
  if (!result) return;
  if (result.stdout) emitArchitectLog(io, result.stdout);
  if (result.stderr) emitArchitectLog(io, result.stderr, true);
}

function formatSpawnError(action, command, result) {
  const errorMessage = result?.error?.message ? ` ${result.error.message}` : '';
  const stderr = String(result?.stderr || '').trim();
  const detail = stderr ? ` ${stderr}` : '';
  return `${action} failed while running ${command}.${errorMessage}${detail}`.trim();
}

function runChecked(spawnSyncImpl, command, args, options, action, io) {
  const result = spawnSyncImpl(command, args, { encoding: 'utf8', ...options });
  forwardSpawnOutput(io, result);

  if (result.error || result.status !== 0) {
    throw new Error(formatSpawnError(action, command, result));
  }

  return result;
}

function ensureArchitectPython({
  io,
  sourceRoot = SOURCE_ROOT,
  dataRoot = DATA_ROOT,
  platform = process.platform,
  spawnSyncImpl = spawnSync,
} = {}) {
  const { architectDir, architectRuntimeDir, requirementsPath, venvDir, venvPython } = getArchitectPaths(sourceRoot, dataRoot, platform);
  const systemPython = platform === 'win32' ? 'python' : 'python3';
  let pythonCmd = fs.existsSync(venvPython) ? venvPython : systemPython;

  fs.mkdirSync(architectRuntimeDir, { recursive: true });

  if (!fs.existsSync(venvPython)) {
    emitArchitectLog(io, '\n📦 Preparing Architect Python environment...\n');
    runChecked(
      spawnSyncImpl,
      systemPython,
      ['-m', 'venv', venvDir],
      { cwd: dataRoot },
      'Creating Architect virtual environment',
      io
    );
    pythonCmd = venvPython;
  }

  const healthCheck = spawnSyncImpl(
    pythonCmd,
    ['-c', REQUIRED_IMPORTS],
    { cwd: architectDir, encoding: 'utf8' }
  );

  if (!healthCheck.error && healthCheck.status === 0) {
    return pythonCmd;
  }

  emitArchitectLog(io, '\n📦 Installing Architect Python dependencies...\n');
  runChecked(
    spawnSyncImpl,
    pythonCmd,
    ['-m', 'pip', 'install', '-r', requirementsPath],
    { cwd: dataRoot },
    'Installing Architect dependencies',
    io
  );

  runChecked(
    spawnSyncImpl,
    pythonCmd,
    ['-c', REQUIRED_IMPORTS],
    { cwd: architectDir },
    'Verifying Architect dependencies',
    io
  );

  return pythonCmd;
}

module.exports = {
  REQUIRED_IMPORTS,
  ensureArchitectPython,
  getArchitectPaths,
};
