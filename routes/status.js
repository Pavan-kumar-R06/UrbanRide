const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

router.get('/status', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  res.json({
    status: isConnected ? 'connected' : 'disconnected',
    database: 'MongoDB',
    readyState: mongoose.connection.readyState
  });
});

module.exports = router;