const express = require('express');
const router = express.Router();
const Member = require('../models/Member');
const Hostel = require('../models/Hostel');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

const getHostelId = async (req) => {
  if (req.user.role === 'owner') {
    const hId = req.query.hostelId || req.body?.hostelId;
    if (hId) return hId;
    const first = await Hostel.findOne({ isActive: true }).sort({ createdAt: 1 });
    return first?._id;
  }
  return req.user.hostelId;
};

router.get('/', async (req, res, next) => {
  try {
    const hostelId = await getHostelId(req);
    if (!hostelId) return res.status(400).json({ message: 'No hostel assigned' });
    const hostel = await Hostel.findById(hostelId);
    if (!hostel) return res.status(404).json({ message: 'Hostel not found' });
    const totalRooms = hostel.totalRooms || 20;
    const rooms = [];
    for (let i = 1; i <= totalRooms; i++) {
      const members = await Member.find({ hostelId, roomNumber: i, isActive: true });
      rooms.push({ roomNumber: i, memberCount: members.length, members });
    }
    res.json(rooms);
  } catch(err) { next(err); }
});

router.get('/:roomNumber', async (req, res, next) => {
  try {
    const hostelId = await getHostelId(req);
    if (!hostelId) return res.status(400).json({ message: 'No hostel assigned' });
    const members = await Member.find({ hostelId, roomNumber: parseInt(req.params.roomNumber), isActive: true });
    res.json({ roomNumber: parseInt(req.params.roomNumber), memberCount: members.length, members });
  } catch(err) { next(err); }
});

module.exports = router;
