const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  veg: { type: Boolean, default: true },
  halfPrice: { type: Number, required: true },
  fullPrice: { type: Number, required: true },
  available: { type: Boolean, default: true },
  imageUrl: String,
  isSpecial: { type: Boolean, default: false },
  /** When true, hidden from customer menu for the calendar day in servingDayKey */
  unavailableToday: { type: Boolean, default: false },
  /** YYYY-MM-DD (UTC) — day the unavailableToday flag applies; new day resets availability */
  servingDayKey: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('MenuItem', menuItemSchema);
