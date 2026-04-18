const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const ClientSession = require('../models/ClientSession');

const router = express.Router();

function bumpExpiry() {
  return new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
}

function mongoReady() {
  return mongoose.connection.readyState === 1;
}

// Create a new session id (server-generated)
router.post('/', async (req, res) => {
  try {
    if (!mongoReady()) {
      return res.json({ sessionId: crypto.randomUUID(), persisted: false });
    }
    const sessionId = crypto.randomUUID();
    const expiresAt = bumpExpiry();
    await ClientSession.create({
      sessionId,
      cart: { items: [], total: 0 },
      checkout: {},
      expiresAt,
    });
    return res.json({ sessionId, persisted: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get session snapshot
router.get('/:sessionId', async (req, res) => {
  try {
    if (!mongoReady()) {
      return res.status(404).json({ error: 'Persistence unavailable' });
    }
    const doc = await ClientSession.findOne({ sessionId: req.params.sessionId });
    if (!doc) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.json({
      sessionId: doc.sessionId,
      cart: doc.cart || { items: [], total: 0 },
      checkout: doc.checkout || {},
      updatedAt: doc.updatedAt,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Upsert + merge cart / checkout (extends TTL)
router.put('/:sessionId', async (req, res) => {
  try {
    const { cart, checkout } = req.body || {};
    const expiresAt = bumpExpiry();

    if (!mongoReady()) {
      return res.json({ ok: true, persisted: false });
    }

    const $set = { expiresAt };
    if (cart && typeof cart === 'object') {
      $set.cart = {
        items: Array.isArray(cart.items) ? cart.items : [],
        total: typeof cart.total === 'number' ? cart.total : 0,
      };
    }
    if (checkout && typeof checkout === 'object') {
      if (checkout.name !== undefined) $set['checkout.name'] = checkout.name;
      if (checkout.phone !== undefined) $set['checkout.phone'] = checkout.phone;
      if (checkout.address !== undefined) $set['checkout.address'] = checkout.address;
      if (checkout.orderType !== undefined) {
        $set['checkout.orderType'] = checkout.orderType === 'takeaway' ? 'takeaway' : 'delivery';
      }
      if (checkout.paymentMethod !== undefined) {
        $set['checkout.paymentMethod'] = checkout.paymentMethod === 'UPI' ? 'UPI' : 'COD';
      }
    }

    const doc = await ClientSession.findOneAndUpdate(
      { sessionId: req.params.sessionId },
      {
        $set,
        $setOnInsert: {
          sessionId: req.params.sessionId,
          cart: { items: [], total: 0 },
          checkout: {},
        },
      },
      { new: true, upsert: true, runValidators: true },
    );

    return res.json({
      ok: true,
      persisted: true,
      sessionId: doc.sessionId,
      cart: doc.cart,
      checkout: doc.checkout,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
