const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors');

const DEFAULT_PORT = 3000;
const DEFAULT_INCOMING_DIR = path.join(__dirname, '../../output/incoming');
const DEFAULT_BEST_DIR = path.join(__dirname, '../../output/best');

function createCuratorApp(options = {}) {
  const incomingDir = path.resolve(options.incomingDir || process.env.FACTORY_INCOMING_DIR || DEFAULT_INCOMING_DIR);
  const bestDir = path.resolve(options.bestDir || process.env.FACTORY_BEST_DIR || DEFAULT_BEST_DIR);
  const app = express();

  fs.ensureDirSync(incomingDir);
  fs.ensureDirSync(bestDir);

  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));
  app.use('/images', express.static(incomingDir));

  app.get('/api/images', async (_req, res) => {
    try {
      const files = await fs.readdir(incomingDir);
      const images = files.filter((fileName) => /\.(png|jpg|jpeg|webp)$/i.test(fileName));
      const sorted = images
        .map((fileName) => ({
          name: fileName,
          time: fs.statSync(path.join(incomingDir, fileName)).mtime.getTime(),
        }))
        .sort((left, right) => right.time - left.time);

      res.json(sorted.map((item) => item.name));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/action', async (req, res) => {
    const { filename, action } = req.body || {};
    const srcPath = path.join(incomingDir, filename);

    if (!fs.existsSync(srcPath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    try {
      if (action === 'keep') {
        const destPath = path.join(bestDir, filename);
        await fs.move(srcPath, destPath);
      } else if (action === 'discard') {
        await fs.remove(srcPath);
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return {
    app,
    paths: {
      incomingDir,
      bestDir,
    },
  };
}

function startCuratorServer(options = {}) {
  const port = Number(options.port || process.env.PORT || DEFAULT_PORT);
  const runtime = createCuratorApp(options);
  const server = runtime.app.listen(port, () => {
    console.log(`Curator UI running at http://localhost:${port}`);
    console.log(`Watching: ${runtime.paths.incomingDir}`);
  });

  return {
    ...runtime,
    server,
  };
}

if (require.main === module) {
  startCuratorServer();
}

module.exports = {
  createCuratorApp,
  startCuratorServer,
};
