const express = require('express');
const router = express.Router();
const Hostel = require('../models/Hostel');
const { authMiddleware, ownerOnly } = require('../middleware/auth');

router.use(authMiddleware);

// List all hostels
router.get('/', async (req, res, next) => {
  try {
    const hostels = await Hostel.find({ isActive: true }).sort({ createdAt: 1 });
    res.json(hostels);
  } catch(err) { next(err); }
});

// Create hostel (owner only)
router.post('/', ownerOnly, async (req, res, next) => {
  try {
    const { name, address, city, mobile, totalRooms } = req.body;
    if (!name || !address) return res.status(400).json({ message: 'Name and address required' });
    const hostel = new Hostel({ name, address, city, mobile, totalRooms: totalRooms || 20, createdBy: req.user.id });
    await hostel.save();
    res.status(201).json(hostel);
  } catch(err) { next(err); }
});

// Update hostel (owner only)
router.put('/:id', ownerOnly, async (req, res, next) => {
  try {
    const { name, address, city, mobile, totalRooms } = req.body;
    if (totalRooms && totalRooms < 1) return res.status(400).json({ message: 'Must have at least 1 room' });
    const hostel = await Hostel.findByIdAndUpdate(req.params.id, { name, address, city, mobile, totalRooms }, { new: true });
    if (!hostel) return res.status(404).json({ message: 'Hostel not found' });
    res.json(hostel);
  } catch(err) { next(err); }
});

// Delete hostel (owner only)
router.delete('/:id', ownerOnly, async (req, res, next) => {
  try {
    const hostel = await Hostel.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!hostel) return res.status(404).json({ message: 'Hostel not found' });
    res.json({ message: 'Hostel removed' });
  } catch(err) { next(err); }
});

module.exports = router;
