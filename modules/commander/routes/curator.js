const express = require('express');

module.exports = ({ startCurator, curatorUrl }) => {
  const router = express.Router();

  const startHandler = (_req, res) => {
    startCurator();
    res.json({ status: 'started', url: curatorUrl });
  };

  router.post('/open', startHandler);
  router.post('/start', startHandler);

  return router;
};
