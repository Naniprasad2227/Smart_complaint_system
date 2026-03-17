const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: token missing' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized: user not found' });
    }

    if (user.accountStatus === 'inactive') {
      return res.status(403).json({ message: 'Account is inactive. Contact an admin for reactivation.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized: invalid token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: admin access required' });
  }

  next();
};

const requireWorker = (req, res, next) => {
  if (!req.user || req.user.role !== 'worker') {
    return res.status(403).json({ message: 'Forbidden: worker access required' });
  }
  next();
};

const requireAdminOrWorker = (req, res, next) => {
  if (!req.user || !['admin', 'worker'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden: admin or worker access required' });
  }
  next();
};

module.exports = { protect, requireAdmin, requireWorker, requireAdminOrWorker };
