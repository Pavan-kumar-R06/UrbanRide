const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(require('./status'));
router.use('/auth', require('./auth'));
router.use(authenticateToken);
router.use(require('./bookings'));
router.use(require('./messages'));
router.use('/users', require('./users'));
router.use(require('./rides'));
router.use(require('./incidents'));

module.exports = router;