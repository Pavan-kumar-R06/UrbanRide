const jwt = require('jsonwebtoken');

const DEVELOPMENT_SECRET = 'urbanride-local-development-secret-change-before-deploy';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  return process.env.NODE_ENV === 'production' ? null : DEVELOPMENT_SECRET;
}

function createAccessToken(user) {
  const secret = getJwtSecret();
  if (!secret) throw new Error('Set JWT_SECRET to a random value of at least 32 characters.');
  return jwt.sign(
    { role: user.role, name: user.name },
    secret,
    { subject: user._id.toString(), expiresIn: '7d' }
  );
}

function authenticateToken(req, res, next) {
  const secret = getJwtSecret();
  if (!secret) return res.status(503).json({ error: 'JWT_SECRET is not configured.' });

  const authorization = req.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(token, secret);
    req.user = { id: payload.sub, role: payload.role, name: payload.name };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required.' });
  }
  next();
}

module.exports = { authenticateToken, createAccessToken, requireAdmin };