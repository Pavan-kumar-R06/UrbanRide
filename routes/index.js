const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(require('./status'));
router.use('/auth', require('./auth'));
router.use(authenticateToken);
router.use(require('./bookings'));
router.use('/users', requireAdmin, require('./users'));
router.use(require('./rides'));

module.exports = router;