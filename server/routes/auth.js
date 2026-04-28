const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Hostel = require('../models/Hostel');
const { JWT_SECRET, authMiddleware, ownerOnly } = require('../middleware/auth');
const logger = require('../utils/logger');

const allowRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Access denied' });
  next();
};

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username and password required' });
    const user = await User.findOne({ username: username.toLowerCase().trim() });
    if (!user || !user.isActive) return res.status(401).json({ message: 'Invalid credentials or account disabled' });
    if (user.isLocked) {
      const remaining = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({ message: `Account locked. Try again in ${remaining} minute(s).` });
    }
    const valid = await user.comparePassword(password);
    if (!valid) {
      await user.incLoginAttempts();
      const attempts = user.loginAttempts + 1;
      const left = 5 - attempts;
      return res.status(401).json({ message: left > 0 ? `Invalid credentials. ${left} attempt(s) remaining.` : 'Account locked for 15 minutes due to too many failed attempts.' });
    }
    await user.updateOne({ $set: { loginAttempts: 0, lastLogin: new Date() }, $unset: { lockUntil: 1 } });
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role, name: user.name, hostelId: user.hostelId },
      JWT_SECRET, { expiresIn: '12h' }
    );
    logger.info('User logged in', { username: user.username, role: user.role });
    res.json({ token, user: { id: user._id, username: user.username, name: user.name, role: user.role, hostelId: user.hostelId, lastLogin: user.lastLogin } });
  } catch(err) { next(err); }
});

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch(err) { next(err); }
});

router.post('/change-password', authMiddleware, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Both passwords required' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    const user = await User.findById(req.user.id);
    const valid = await user.comparePassword(currentPassword);
    if (!valid) return res.status(400).json({ message: 'Current password is incorrect' });
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password changed successfully' });
  } catch(err) { next(err); }
});

router.post('/users/:id/reset-password', authMiddleware, ownerOnly, async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.password = newPassword;
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();
    logger.info('Password reset by owner', { target: user.username, by: req.user.username });
    res.json({ message: `Password reset for ${user.name}` });
  } catch(err) { next(err); }
});

router.get('/users', authMiddleware, ownerOnly, async (req, res, next) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch(err) { next(err); }
});

router.post('/users', authMiddleware, ownerOnly, async (req, res, next) => {
  try {
    const { username, password, name, mobile, hostelId } = req.body;
    if (!username || !password || !name) return res.status(400).json({ message: 'username, password and name required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    const user = new User({ username: username.toLowerCase().trim(), password, name, mobile, role: 'manager', hostelId: hostelId || null });
    await user.save();
    res.status(201).json({ message: 'Manager created', user: { username: user.username, name: user.name, role: user.role } });
  } catch(err) { next(err); }
});

router.put('/users/:id/toggle', authMiddleware, ownerOnly, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'owner') return res.status(400).json({ message: 'Cannot disable owner account' });
    user.isActive = !user.isActive;
    await user.save();
    res.json({ message: `User ${user.isActive ? 'enabled' : 'disabled'}`, isActive: user.isActive });
  } catch(err) { next(err); }
});

router.get('/users/:id/activity', authMiddleware, ownerOnly, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('name username role recentActivity lastLogin');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch(err) { next(err); }
});

router.delete('/users/:id', authMiddleware, ownerOnly, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'owner') return res.status(400).json({ message: 'Cannot delete owner account' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Manager deleted' });
  } catch(err) { next(err); }
});

router.put('/users/:id/hostel', authMiddleware, ownerOnly, async (req, res, next) => {
  try {
    const { hostelId } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { hostelId: hostelId || null }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch(err) { next(err); }
});

router.post('/setup', async (req, res, next) => {
  try {
    const count = await User.countDocuments();
    if (count > 0) return res.status(400).json({ message: 'Setup already done' });
    const { username, password, name } = req.body;
    if (!username || !password || !name) return res.status(400).json({ message: 'username, password and name required' });
    const user = new User({ username, password, name, role: 'owner' });
    await user.save();
    res.json({ message: 'Owner account created' });
  } catch(err) { next(err); }
});

module.exports = router;
