const mongoose = require('mongoose');

const receiptSchema = new mongoose.Schema({
  hostelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', required: true, index: true },
  receiptNumber: { type: Number },
  billNumber: { type: String },
  billYear: { type: String },
  billSerial: { type: Number },
  roomNumber: { type: Number, required: true },
  month: { type: String },
  monthYear: { type: String },
  memberName: { type: String },
  memberMobile: { type: String },
  memberId: { type: String },
  members: [{ name: String, memberId: String, memberUniqueId: String }],
  packageName: { type: String, enum: ['rent','advance','electric','final','other'], default: 'rent' },
  paymentType: { type: String, enum: ['rent','advance','electric','final','other'], default: 'rent' },
  fromDate: { type: Date },
  toDate: { type: Date },
  rent: { type: Number, default: 0 },
  advance: { type: Number, default: 0 },
  electric: { type: Number, default: 0 },
  other: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  amountInWords: { type: String },
  modeOfPayment: { type: String, enum: ['cash','online'], default: 'cash' },
  receiptDate: { type: Date, default: Date.now },
  notes: { type: String },
  isPaid: { type: Boolean, default: true },
}, { timestamps: true });

receiptSchema.index({ hostelId: 1, roomNumber: 1 });
receiptSchema.index({ hostelId: 1, receiptDate: -1 });
module.exports = mongoose.model('Receipt', receiptSchema);
