const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    /** Checkout coupon — stored uppercase */
    couponCode: {
      type: String,
      trim: true,
      default: '',
      set: (v) => (v == null || v === '' ? '' : String(v).trim().toUpperCase()),
    },
    /** If &gt; 0, discount is this % of subtotal (takes precedence over flat when both set — see computeDiscountFromOffer) */
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    /** If &gt; 0 and percent is 0, fixed rupee discount off subtotal */
    discountFlat: { type: Number, default: 0, min: 0 },
    /** Offer valid through this instant (inclusive of that moment). Omit or null = no expiry (legacy). */
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Offer', offerSchema);
