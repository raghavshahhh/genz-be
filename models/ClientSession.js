const mongoose = require('mongoose');

const clientSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  cart: {
    items: { type: Array, default: [] },
    total: { type: Number, default: 0 },
  },
  checkout: {
    name: String,
    phone: String,
    address: String,
    orderType: { type: String, enum: ['delivery', 'takeaway'], default: 'delivery' },
    paymentMethod: { type: String, enum: ['UPI', 'COD'], default: 'COD' },
    couponCode: { type: String, trim: true, default: '' },
  },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

clientSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ClientSession', clientSessionSchema);
