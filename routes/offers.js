const express = require('express');
const mongoose = require('mongoose');
const Offer = require('../models/Offer');
const { adminAuth } = require('../middleware/adminAuth');

const router = express.Router();

const PUBLIC_DEMO_OFFERS = [
  {
    _id: 'demo-offer-1',
    title: 'Weekend combo',
    subtitle: 'Any two mains + beverage',
    description: 'Friday–Sunday. Discount applied at checkout.',
    active: true,
    sortOrder: 0,
  },
  {
    _id: 'demo-offer-2',
    title: 'Free delivery',
    subtitle: 'On orders above ₹499',
    description: 'Within Zone 1. Auto-applied when eligible.',
    active: true,
    sortOrder: 1,
  },
];

/** Public: active offers for menu page */
router.get('/', async (req, res) => {
  try {
    let list = [];
    if (mongoose.connection.readyState === 1) {
      list = await Offer.find({ active: true }).sort({ sortOrder: 1, createdAt: -1 }).lean();
    }
    if (list.length === 0) {
      list = PUBLIC_DEMO_OFFERS;
    }
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    const { title, subtitle = '', description = '', active = true, sortOrder = 0 } = req.body;
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'title is required' });
    }
    const doc = await Offer.create({
      title: title.trim(),
      subtitle: String(subtitle).trim(),
      description: String(description).trim(),
      active: Boolean(active),
      sortOrder: Number(sortOrder) || 0,
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
