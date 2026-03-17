const fs = require('fs');
const path = require('path');

const SOURCE_ROOT = path.resolve(__dirname, '../../../');
const DATA_ROOT = path.resolve(process.env.MIDJOURNEY_FACTORY_HOME || SOURCE_ROOT);
const PROJECT_ROOT = DATA_ROOT;
const OUTPUT_DIR = path.join(DATA_ROOT, 'output');
const PROMPTS_DIR = path.join(OUTPUT_DIR, 'prompts');
const DRAFTS_DIR = path.join(OUTPUT_DIR, 'prompts_drafts');
const INCOMING_DIR = path.join(OUTPUT_DIR, 'incoming');
const BEST_DIR = path.join(OUTPUT_DIR, 'best');
const KNOWLEDGE_DIR = path.join(DATA_ROOT, 'modules', 'architect', 'knowledge');
const CONFIG_DIR = path.join(DATA_ROOT, 'config');
const CONFIG_PATH = path.join(CONFIG_DIR, 'settings.yaml');
const ENV_PATH = path.join(DATA_ROOT, '.env');
const SOURCE_KNOWLEDGE_DIR = path.join(SOURCE_ROOT, 'modules', 'architect', 'knowledge');
const SOURCE_CONFIG_PATH = path.join(SOURCE_ROOT, 'config', 'settings.yaml');
const SOURCE_ENV_EXAMPLE_PATH = path.join(SOURCE_ROOT, '.env.example');

function safeBaseName(value) {
  if (!value || typeof value !== 'string') return '';
  const base = path.basename(value);
  if (base !== value) return '';
  if (base.includes('..')) return '';
  return base;
}

function listFilesByMtimeDesc(dir, filter) {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((name) => !name.startsWith('.') && (!filter || filter(name)))
      .map((name) => ({ name, stat: fs.statSync(path.join(dir, name)) }))
      .filter((item) => item.stat.isFile())
      .sort((a, b) => (b.stat.mtimeMs || 0) - (a.stat.mtimeMs || 0))
      .map((item) => item.name);
  } catch {
    return [];
  }
}

function countVisibleFiles(dir) {
  try {
    return fs.readdirSync(dir).filter((name) => !name.startsWith('.')).length;
  } catch {
    return 0;
  }
}

function makePromptObject(prompt, niji) {
  const base = {
    prompt,
    parameters: {
      ar: '16:9',
      stylize: 300,
      chaos: 15,
    },
    description: 'imported prompt',
  };

  if (niji) {
    base.parameters.niji = 7;
    base.description = 'imported prompt (niji)';
  } else {
    base.parameters.v = 7;
  }

  return base;
}

function ensureDirSync(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFileIfMissing(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath) || fs.existsSync(targetPath)) return;
  ensureDirSync(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
}

function copyKnowledgeSeedFiles() {
  if (!fs.existsSync(SOURCE_KNOWLEDGE_DIR)) return;
  ensureDirSync(KNOWLEDGE_DIR);

  for (const entry of fs.readdirSync(SOURCE_KNOWLEDGE_DIR)) {
    const sourcePath = path.join(SOURCE_KNOWLEDGE_DIR, entry);
    const targetPath = path.join(KNOWLEDGE_DIR, entry);
    const stat = fs.statSync(sourcePath);
    if (!stat.isFile()) continue;
    if (!entry.endsWith('.md') && !entry.endsWith('.txt')) continue;
    if (!fs.existsSync(targetPath)) fs.copyFileSync(sourcePath, targetPath);
  }
}

function ensureRuntimeLayout() {
  ensureDirSync(DATA_ROOT);
  ensureDirSync(OUTPUT_DIR);
  ensureDirSync(PROMPTS_DIR);
  ensureDirSync(DRAFTS_DIR);
  ensureDirSync(INCOMING_DIR);
  ensureDirSync(BEST_DIR);
  ensureDirSync(path.join(OUTPUT_DIR, 'refs_tmp'));
  ensureDirSync(path.join(OUTPUT_DIR, 'logs'));
  ensureDirSync(path.join(DATA_ROOT, 'modules', 'architect'));

  copyFileIfMissing(SOURCE_CONFIG_PATH, CONFIG_PATH);
  copyFileIfMissing(SOURCE_ENV_EXAMPLE_PATH, ENV_PATH);
  copyKnowledgeSeedFiles();
}

function readSettingsYamlRaw() {
  ensureRuntimeLayout();
  return fs.readFileSync(CONFIG_PATH, 'utf8');
}

function stripInlineComment(value) {
  let out = '';
  let quote = '';

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (!quote && (char === '"' || char === '\'')) {
      quote = char;
      out += char;
      continue;
    }
    if (quote && char === quote) {
      quote = '';
      out += char;
      continue;
    }
    if (!quote && char === '#') break;
    out += char;
  }

  return out.trim();
}

function parseYamlScalar(value) {
  const cleaned = stripInlineComment(String(value || '').trim());
  if (!cleaned) return '';
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith('\'') && cleaned.endsWith('\''))) {
    return cleaned.slice(1, -1);
  }
  if (/^(true|false)$/i.test(cleaned)) {
    return cleaned.toLowerCase() === 'true';
  }
  if (/^-?\d+(?:\.\d+)?$/.test(cleaned)) {
    return Number(cleaned);
  }
  return cleaned;
}

function parseSimpleYaml(raw) {
  const root = {};
  const stack = [{ indent: -1, target: root }];
  const lines = String(raw || '').split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const match = line.match(/^(\s*)([A-Za-z0-9_]+):(?:\s*(.*))?$/);
    if (!match) continue;

    const indent = match[1].length;
    const key = match[2];
    const hasValue = typeof match[3] === 'string' && match[3].trim() !== '';

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].target;
    if (!hasValue) {
      parent[key] = {};
      stack.push({ indent, target: parent[key] });
      continue;
    }

    parent[key] = parseYamlScalar(match[3]);
  }

  return root;
}

function toYamlScalar(value) {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return `"${String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function stringifySimpleYaml(value, indent = 0) {
  const lines = [];
  const padding = ' '.repeat(indent);

  for (const [key, child] of Object.entries(value || {})) {
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      lines.push(`${padding}${key}:`);
      lines.push(stringifySimpleYaml(child, indent + 2));
    } else {
      lines.push(`${padding}${key}: ${toYamlScalar(child)}`);
    }
  }

  return lines.filter(Boolean).join('\n');
}

function readSettingsObject() {
  try {
    return parseSimpleYaml(readSettingsYamlRaw());
  } catch {
    return {};
  }
}

function writeSettingsObject(settings) {
  ensureRuntimeLayout();
  fs.writeFileSync(CONFIG_PATH, `${stringifySimpleYaml(settings)}\n`, 'utf8');
}

function parseEnvFile(raw) {
  const values = {};
  const lines = String(raw || '').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1);
    if (key) values[key] = value;
  }
  return values;
}

function readEnvObject() {
  ensureRuntimeLayout();
  try {
    return parseEnvFile(fs.readFileSync(ENV_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function writeEnvObject(envValues) {
  ensureRuntimeLayout();
  const order = [
    'LLM_PRIMARY_API_KEY',
    'LLM_PRIMARY_BASE_URL',
    'LLM_FALLBACK_API_KEY',
    'LLM_FALLBACK_BASE_URL',
    'DISCORD_TOKEN',
    'MJ_CHANNEL_ID',
    'NIJI_CHANNEL_ID',
  ];
  const seen = new Set(order);
  const extraKeys = Object.keys(envValues || {}).filter((key) => !seen.has(key)).sort();
  const keys = [...order, ...extraKeys];
  const lines = keys.map((key) => `${key}=${String((envValues && envValues[key]) || '')}`);
  fs.writeFileSync(ENV_PATH, `${lines.join('\n')}\n`, 'utf8');
}

function getYamlString(raw, key) {
  const re = new RegExp(`^\\s*${key}\\s*:\\s*[\"']?([^\"'\\n#]+)[\"']?\\s*$`, 'm');
  const match = String(raw || '').match(re);
  return match ? String(match[1] || '').trim() : '';
}

function getEnvOrYamlString(raw, key, envKey) {
  if (Object.prototype.hasOwnProperty.call(process.env, envKey)) {
    return String(process.env[envKey] || '').trim();
  }
  return getYamlString(raw, key);
}

function resolveSourcePath(...segments) {
  return path.join(SOURCE_ROOT, ...segments);
}

function getNodeCommand() {
  return String(process.env.MIDJOURNEY_FACTORY_NODE_BIN || process.execPath || 'node');
}

module.exports = {
  SOURCE_ROOT,
  DATA_ROOT,
  PROJECT_ROOT,
  OUTPUT_DIR,
  PROMPTS_DIR,
  DRAFTS_DIR,
  INCOMING_DIR,
  BEST_DIR,
  KNOWLEDGE_DIR,
  CONFIG_DIR,
  CONFIG_PATH,
  ENV_PATH,
  safeBaseName,
  listFilesByMtimeDesc,
  countVisibleFiles,
  makePromptObject,
  ensureRuntimeLayout,
  readSettingsYamlRaw,
  readSettingsObject,
  writeSettingsObject,
  getYamlString,
  getEnvOrYamlString,
  parseSimpleYaml,
  stringifySimpleYaml,
  parseEnvFile,
  readEnvObject,
  writeEnvObject,
  resolveSourcePath,
  getNodeCommand,
};
