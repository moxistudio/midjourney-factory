const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const request = require('supertest');

const helpers = require('../lib/helpers');
const { ensureArchitectPython, getArchitectPaths } = require('../lib/architectRuntime');
const createKnowledgeRouter = require('../routes/knowledge');
const createPromptsRouter = require('../routes/prompts');

const cleanupPaths = [];

function buildApp(basePath, createRouter) {
  const app = express();
  app.use(express.json());
  app.use(basePath, createRouter());
  return app;
}

function uniqueName(prefix, extension) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`;
}

function track(filePath) {
  cleanupPaths.push(filePath);
  return filePath;
}

afterEach(() => {
  while (cleanupPaths.length > 0) {
    fs.rmSync(cleanupPaths.pop(), { force: true, recursive: true });
  }
});

describe('commander helpers', () => {
  it('safeBaseName blocks path traversal', () => {
    expect(helpers.safeBaseName('../secret.txt')).toBe('');
    expect(helpers.safeBaseName('/tmp/secret.txt')).toBe('');
    expect(helpers.safeBaseName('notes.md')).toBe('notes.md');
  });

  it('makePromptObject creates a standard prompt payload', () => {
    expect(helpers.makePromptObject('city skyline', false)).toEqual({
      prompt: 'city skyline',
      parameters: {
        ar: '16:9',
        stylize: 300,
        chaos: 15,
        v: 7,
      },
      description: 'imported prompt',
    });
  });

  it('makePromptObject creates a niji prompt payload', () => {
    expect(helpers.makePromptObject('anime hero', true)).toEqual({
      prompt: 'anime hero',
      parameters: {
        ar: '16:9',
        stylize: 300,
        chaos: 15,
        niji: 7,
      },
      description: 'imported prompt (niji)',
    });
  });

  it('parseSimpleYaml reads nested scalar settings', () => {
    const parsed = helpers.parseSimpleYaml(`
llm:
  primary:
    provider: "openai"
    model: "qwen3.5-plus"
    temperature: 0.7
factory:
  discord_navigation_timeout_ms: 180000
`);

    expect(parsed).toEqual({
      llm: {
        primary: {
          provider: 'openai',
          model: 'qwen3.5-plus',
          temperature: 0.7,
        },
      },
      factory: {
        discord_navigation_timeout_ms: 180000,
      },
    });
  });

  it('ensureArchitectPython repairs an existing venv when imports are missing', () => {
    const projectRoot = track(fs.mkdtempSync(path.join(os.tmpdir(), 'mj-architect-')));
    const { architectDir, requirementsPath, venvPython } = getArchitectPaths(projectRoot, projectRoot, 'linux');

    fs.mkdirSync(path.dirname(venvPython), { recursive: true });
    fs.writeFileSync(venvPython, '');
    fs.mkdirSync(path.dirname(requirementsPath), { recursive: true });
    fs.writeFileSync(requirementsPath, 'typer\n');

    const calls = [];
    const logs = [];
    const spawnSyncImpl = (command, args) => {
      calls.push({ command, args });
      if (args[0] === '-c') {
        const checkCount = calls.filter((call) => call.args[0] === '-c').length;
        return { status: checkCount === 1 ? 1 : 0, stdout: '', stderr: '' };
      }
      if (args[0] === '-m' && args[1] === 'pip') {
        return { status: 0, stdout: 'installed\n', stderr: '' };
      }
      throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
    };

    const pythonCmd = ensureArchitectPython({
      io: { emit: (_event, message) => logs.push(message) },
      platform: 'linux',
      sourceRoot: projectRoot,
      dataRoot: projectRoot,
      spawnSyncImpl,
    });

    expect(pythonCmd).toBe(venvPython);
    expect(calls).toEqual([
      { command: venvPython, args: ['-c', 'import typer, yaml, rich, openai'] },
      { command: venvPython, args: ['-m', 'pip', 'install', '-r', requirementsPath] },
      { command: venvPython, args: ['-c', 'import typer, yaml, rich, openai'] },
    ]);
    expect(logs.join('')).toContain('Installing Architect Python dependencies');
    expect(logs.join('')).toContain('installed');
    expect(fs.existsSync(architectDir)).toBe(true);
  });
});

describe('commander routes', () => {
  it('POST /api/prompts/approve writes approved prompts and renames the draft', async () => {
    fs.mkdirSync(helpers.DRAFTS_DIR, { recursive: true });
    fs.mkdirSync(helpers.PROMPTS_DIR, { recursive: true });

    const draftName = uniqueName('draft', '.json');
    const draftPath = track(path.join(helpers.DRAFTS_DIR, draftName));
    fs.writeFileSync(draftPath, JSON.stringify({ topic: 'draft', prompts: [] }, null, 2));

    const app = buildApp('/api/prompts', createPromptsRouter);
    const response = await request(app)
      .post('/api/prompts/approve')
      .send({
        topic: 'Neon City',
        mode: 'niji',
        sourceDraft: draftName,
        prompts: [{ prompt: 'rainy skyline', parameters: { niji: 7 } }],
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');

    const outputFile = track(path.join(helpers.PROMPTS_DIR, response.body.file));
    const payload = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    expect(payload).toMatchObject({
      topic: 'Neon City',
      mode: 'niji',
      count: 1,
      prompts: [{ prompt: 'rainy skyline', parameters: { niji: 7 } }],
    });

    const approvedDraft = track(
      path.join(helpers.DRAFTS_DIR, draftName.replace(/\.json$/, '_approved.json'))
    );
    expect(fs.existsSync(approvedDraft)).toBe(true);
    expect(fs.existsSync(draftPath)).toBe(false);
  });

  it('POST /api/knowledge/upsert persists a markdown knowledge file', async () => {
    fs.mkdirSync(helpers.KNOWLEDGE_DIR, { recursive: true });

    const fileName = uniqueName('style-guide', '.md');
    const filePath = track(path.join(helpers.KNOWLEDGE_DIR, fileName));
    const app = buildApp('/api/knowledge', createKnowledgeRouter);
    const response = await request(app)
      .post('/api/knowledge/upsert')
      .send({
        name: fileName,
        content: '# Style guide\nuse cinematic lighting',
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', file: fileName });
    expect(fs.readFileSync(filePath, 'utf8')).toBe('# Style guide\nuse cinematic lighting');
  });

  it('POST /api/knowledge/upsert rejects unsupported extensions', async () => {
    const app = buildApp('/api/knowledge', createKnowledgeRouter);
    const response = await request(app)
      .post('/api/knowledge/upsert')
      .send({
        name: uniqueName('style-guide', '.exe'),
        content: 'bad',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('only .md or .txt supported');
  });
});
