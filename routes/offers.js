const express = require('express');
const mongoose = require('mongoose');
const Offer = require('../models/Offer');
const { adminAuth } = require('../middleware/adminAuth');
const {
  normalizeCouponCode,
  computeDiscountFromOffer,
  findActiveOfferByCouponCode,
  offerNotExpiredMongoFilter,
} = require('../lib/promoOffers');

const router = express.Router();

function validateOfferDiscounts(couponCodeRaw, discountPercent, discountFlat) {
  const code = typeof couponCodeRaw === 'string' ? couponCodeRaw.trim() : '';
  if (!code) {
    return { ok: false, error: 'couponCode is required' };
  }
  const pct = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const flat = Math.max(0, Number(discountFlat) || 0);
  const hasPct = pct > 0;
  const hasFlat = flat > 0;
  if (hasPct === hasFlat) {
    return {
      ok: false,
      error: 'Set exactly one discount: percent (1–100) or flat rupees, not both and not neither.',
    };
  }
  return { ok: true, couponCode: code, discountPercent: pct, discountFlat: flat };
}

function parseOfferExpiresAt(raw, { mustBeFuture } = {}) {
  if (raw == null || raw === '') {
    return { ok: false, error: 'expiresAt is required' };
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    return { ok: false, error: 'expiresAt must be a valid date' };
  }
  if (mustBeFuture && d.getTime() <= Date.now()) {
    return { ok: false, error: 'Expiry must be in the future' };
  }
  return { ok: true, expiresAt: d };
}

/** Public: active offers for menu page */
router.get('/', async (req, res) => {
  try {
    let list = [];
    if (mongoose.connection.readyState === 1) {
      list = await Offer.find({ active: true, ...offerNotExpiredMongoFilter() })
        .sort({ sortOrder: 1, createdAt: -1 })
        .lean();
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
      return res.json({ valid: false, message: 'Invalid, inactive, or expired code' });
    }
    const pct = Number(offer.discountPercent) || 0;
    const flat = Number(offer.discountFlat) || 0;
    if ((pct > 0) === (flat > 0)) {
      return res.json({ valid: false, message: 'This offer has no valid discount configured' });
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
      expiresAt: rawExpires,
    } = req.body;
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'title is required' });
    }
    const exp = parseOfferExpiresAt(rawExpires, { mustBeFuture: true });
    if (!exp.ok) {
      return res.status(400).json({ error: exp.error });
    }
    const pctIn = Math.min(100, Math.max(0, Number(discountPercent) || 0));
    const flatIn = Math.max(0, Number(discountFlat) || 0);
    const v = validateOfferDiscounts(couponCode, pctIn, flatIn);
    if (!v.ok) {
      return res.status(400).json({ error: v.error });
    }
    const doc = await Offer.create({
      title: title.trim(),
      subtitle: String(subtitle).trim(),
      description: String(description).trim(),
      active: Boolean(active),
      sortOrder: Number(sortOrder) || 0,
      couponCode: v.couponCode,
      discountPercent: v.discountPercent,
      discountFlat: v.discountFlat,
      expiresAt: exp.expiresAt,
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
    if (Object.prototype.hasOwnProperty.call(req.body, 'expiresAt')) {
      const raw = req.body.expiresAt;
      if (raw == null || raw === '') {
        return res.status(400).json({ error: 'expiresAt is required when updating expiry' });
      }
      const exp = parseOfferExpiresAt(raw, { mustBeFuture: false });
      if (!exp.ok) {
        return res.status(400).json({ error: exp.error });
      }
      patch.expiresAt = exp.expiresAt;
    }

    const existing = await Offer.findById(req.params.id).lean();
    if (!existing) {
      return res.status(404).json({ error: 'Not found' });
    }
    let mergedPct =
      patch.discountPercent !== undefined
        ? patch.discountPercent
        : Math.min(100, Math.max(0, Number(existing.discountPercent) || 0));
    let mergedFlat =
      patch.discountFlat !== undefined
        ? patch.discountFlat
        : Math.max(0, Number(existing.discountFlat) || 0);
    if (patch.discountPercent !== undefined && mergedPct > 0) {
      mergedFlat = 0;
    }
    if (patch.discountFlat !== undefined && mergedFlat > 0) {
      mergedPct = 0;
    }
    const mergedCoupon =
      patch.couponCode !== undefined ? String(patch.couponCode).trim() : String(existing.couponCode || '').trim();
    const check = validateOfferDiscounts(mergedCoupon, mergedPct, mergedFlat);
    if (!check.ok) {
      return res.status(400).json({ error: check.error });
    }
    if (patch.discountPercent !== undefined || patch.discountFlat !== undefined) {
      patch.discountPercent = check.discountPercent;
      patch.discountFlat = check.discountFlat;
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
