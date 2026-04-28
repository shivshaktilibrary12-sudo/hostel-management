const mongoose = require('mongoose');

const hostelSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  address: { type: String, required: true },
  city: { type: String, default: 'Indore' },
  mobile: { type: String },
  totalRooms: { type: Number, default: 20, min: 1, max: 200 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

hostelSchema.index({ name: 1 });
module.exports = mongoose.model('Hostel', hostelSchema);
