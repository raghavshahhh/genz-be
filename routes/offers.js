const express = require('express');
const mongoose = require('mongoose');
const Offer = require('../models/Offer');
const { adminAuth } = require('../middleware/adminAuth');
const { normalizeCouponCode, computeDiscountFromOffer, findActiveOfferByCouponCode } = require('../lib/promoOffers');

const router = express.Router();

/** Public: active offers for menu page */
router.get('/', async (req, res) => {
  try {
    let list = [];
    if (mongoose.connection.readyState === 1) {
      list = await Offer.find({ active: true }).sort({ sortOrder: 1, createdAt: -1 }).lean();
    }
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Public: validate coupon for checkout (subtotal = cart subtotal before tax) */
router.post('/validate-coupon', async (req, res) => {
  try {
    const raw = req.body?.code ?? req.body?.couponCode;
    const subtotal = Math.max(0, Number(req.body?.subtotal) || 0);
    const code = normalizeCouponCode(raw);
    if (!code) {
      return res.status(400).json({ valid: false, message: 'Enter a coupon code' });
    }
    const offer = await findActiveOfferByCouponCode(code);
    if (!offer) {
      return res.json({ valid: false, message: 'Invalid or inactive code' });
    }
    const hasDiscount =
      (Number(offer.discountPercent) || 0) > 0 || (Number(offer.discountFlat) || 0) > 0;
    if (!hasDiscount) {
      return res.json({ valid: false, message: 'This offer has no discount configured' });
    }
    const discountAmount = computeDiscountFromOffer(subtotal, offer);
    return res.json({
      valid: true,
      couponCode: normalizeCouponCode(offer.couponCode || code),
      discountAmount,
      title: offer.title,
    });
  } catch (err) {
    res.status(500).json({ valid: false, error: err.message });
  }
});

/** Admin: all offers */
router.get('/admin', adminAuth, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    const list = await Offer.find().sort({ sortOrder: 1, createdAt: -1 }).lean();
    res.json({ offers: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', adminAuth, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    const {
      title,
      subtitle = '',
      description = '',
      active = true,
      sortOrder = 0,
      couponCode = '',
      discountPercent = 0,
      discountFlat = 0,
    } = req.body;
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'title is required' });
    }
    const doc = await Offer.create({
      title: title.trim(),
      subtitle: String(subtitle).trim(),
      description: String(description).trim(),
      active: Boolean(active),
      sortOrder: Number(sortOrder) || 0,
      couponCode: typeof couponCode === 'string' ? couponCode.trim() : '',
      discountPercent: Math.min(100, Math.max(0, Number(discountPercent) || 0)),
      discountFlat: Math.max(0, Number(discountFlat) || 0),
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', adminAuth, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const patch = {};
    if (typeof req.body.title === 'string') patch.title = req.body.title.trim();
    if (typeof req.body.subtitle === 'string') patch.subtitle = req.body.subtitle.trim();
    if (typeof req.body.description === 'string') patch.description = req.body.description.trim();
    if (typeof req.body.active === 'boolean') patch.active = req.body.active;
    if (req.body.sortOrder != null) patch.sortOrder = Number(req.body.sortOrder) || 0;
    if (typeof req.body.couponCode === 'string') patch.couponCode = req.body.couponCode.trim();
    if (req.body.discountPercent != null) {
      patch.discountPercent = Math.min(100, Math.max(0, Number(req.body.discountPercent) || 0));
    }
    if (req.body.discountFlat != null) {
      patch.discountFlat = Math.max(0, Number(req.body.discountFlat) || 0);
    }
    const doc = await Offer.findByIdAndUpdate(req.params.id, patch, { new: true }).lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', adminAuth, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const r = await Offer.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
