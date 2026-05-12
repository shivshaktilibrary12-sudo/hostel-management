const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  hostelId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', required: true, index: true },
  roomNumber:  { type: Number, required: true },
  rent:        { type: Number, default: 0 },      // Fixed monthly rent for the whole room
  advance:     { type: Number, default: 0 },      // Fixed advance for the room
  maxCapacity: { type: Number, default: 6 },      // Max members allowed
  notes:       { type: String, default: '' },     // Any owner notes about this room
}, { timestamps: true });

// Each room number is unique per hostel
roomSchema.index({ hostelId: 1, roomNumber: 1 }, { unique: true });

module.exports = mongoose.model('Room', roomSchema);
