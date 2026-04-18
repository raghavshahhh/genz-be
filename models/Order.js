const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNo: { type: String, required: true, unique: true },
  customer: {
    name: String,
    phone: String,
    address: String
  },
  items: [{
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
    size: { type: String, enum: ['half', 'full'] },
    quantity: { type: Number, default: 1 }
  }],
  subtotal: Number,
  tax: Number,
  deliveryCharge: Number,
  total: Number,
  paymentMethod: { type: String, enum: ['UPI', 'COD'] },
  status: {
    type: String,
    enum: ['Confirmed', 'Cooking', 'Out for Delivery', 'Delivered', 'Rejected'],
    default: 'Confirmed',
  },
  zone: String,
  sessionId: String,
  orderType: { type: String, enum: ['delivery', 'takeaway'], default: 'delivery' },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
