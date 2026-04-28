const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'hostel_super_secret_change_in_production';

const authMiddleware = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    req.user = decoded;
    next();
  } catch(err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ message: 'Session expired. Please log in again.' });
    return res.status(401).json({ message: 'Invalid token. Please log in again.' });
  }
};

const ownerOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'owner') return res.status(403).json({ message: 'Owner access only' });
  next();
};

const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: 'Access denied' });
  next();
};

module.exports = { JWT_SECRET, authMiddleware, ownerOnly, allowRoles };
