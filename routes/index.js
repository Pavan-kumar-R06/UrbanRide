const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const shares = require('./shares');

router.use(require('./status'));
router.use('/auth', require('./auth'));
router.use(shares.publicRouter);           // /track/:token - no login, secret link
router.use(authenticateToken);
router.use(require('./bookings'));
router.use(require('./messages'));
router.use('/users', require('./users'));
router.use(require('./rides'));
router.use(require('./incidents'));
router.use(require('./wallet'));
router.use(require('./vehicle'));
router.use(require('./notifications'));
router.use(require('./networks'));
router.use(require('./disruptions'));
router.use(shares.router);
router.use(require('./journeys'));
router.use(require('./passport'));
router.use(require('./analytics'));

module.exports = router;
