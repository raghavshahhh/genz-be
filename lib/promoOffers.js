const mongoose = require('mongoose');
const Offer = require('../models/Offer');

/** Fallback when DB is empty — must stay in sync with routes/offers public behavior */
const PUBLIC_DEMO_OFFERS = [
  {
    _id: 'demo-offer-1',
    title: 'Weekend combo',
    subtitle: 'Any two mains + beverage',
    description: 'Friday–Sunday. Use code WEEKEND15 at checkout.',
    active: true,
    sortOrder: 0,
    couponCode: 'WEEKEND15',
    discountPercent: 15,
    discountFlat: 0,
  },
  {
    _id: 'demo-offer-2',
    title: 'Free delivery',
    subtitle: 'On orders above ₹499',
    description: 'Within Zone 1. Code DELIVERY30 takes ₹30 off your order.',
    active: true,
    sortOrder: 1,
    couponCode: 'DELIVERY30',
    discountPercent: 0,
    discountFlat: 30,
  },
  {
    _id: 'demo-offer-burger',
    title: '25% OFF ALL BURGERS THIS WEEK!',
    subtitle: 'Fresh patties · limited time',
    description: 'Use code GZ25 at checkout.',
    active: true,
    sortOrder: 2,
    couponCode: 'GZ25',
    discountPercent: 25,
    discountFlat: 0,
  },
];

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeCouponCode(code) {
  return String(code || '').trim().toUpperCase();
}

function computeDiscountFromOffer(subtotal, offer) {
  const s = Math.max(0, Number(subtotal) || 0);
  if (!offer || s <= 0) return 0;
  const pct = Number(offer.discountPercent) || 0;
  const flat = Number(offer.discountFlat) || 0;
  let d = 0;
  if (pct > 0) d = Math.round((s * pct) / 100);
  else if (flat > 0) d = Math.min(flat, s);
  return Math.min(Math.max(0, d), s);
}

async function findActiveOfferByCouponCode(rawCode) {
  const code = normalizeCouponCode(rawCode);
  if (!code) return null;

  if (mongoose.connection.readyState === 1) {
    const fromDb = await Offer.findOne({ active: true, couponCode: code }).lean();
    if (fromDb) return fromDb;
  }

  return (
    PUBLIC_DEMO_OFFERS.find((o) => o.couponCode && normalizeCouponCode(o.couponCode) === code) ||
    null
  );
}

module.exports = {
  PUBLIC_DEMO_OFFERS,
  normalizeCouponCode,
  computeDiscountFromOffer,
  findActiveOfferByCouponCode,
};
