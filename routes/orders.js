const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const { adminAuth } = require('../middleware/adminAuth');
const {
  normalizeCouponCode,
  computeDiscountFromOffer,
  findActiveOfferByCouponCode,
} = require('../lib/promoOffers');

const router = express.Router();

const ALLOWED_STATUSES = ['Confirmed', 'Cooking', 'Out for Delivery', 'Delivered', 'Rejected'];

function emitOrderUpdate(io, order) {
  const doc = order && typeof order.toObject === 'function' ? order.toObject() : order;
  io.to('dashboard').emit('order-updated', doc);
  if (!doc) return;
  if (doc.orderNo) {
    io.to(`order:${doc.orderNo}`).emit('order-status', doc);
  }
  if (doc._id) {
    io.to(`order:${String(doc._id)}`).emit('order-status', doc);
  }
}

// Public: track by order number (orderNo) and/or MongoDB id (id)
router.get('/track', async (req, res) => {
  try {
    const orderNo = req.query.orderNo;
    const id = req.query.id;
    let order = null;

    if (id && typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findById(id).populate('items.item').lean();
    } else if (orderNo && typeof orderNo === 'string') {
      order = await Order.findOne({ orderNo }).populate('items.item').lean();
    } else {
      return res.status(400).json({
        error: 'Provide id (MongoDB order id) or orderNo query parameter',
      });
    }

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Place order - public (totals recomputed server-side; coupon applied to subtotal before tax)
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const {
      customer,
      items,
      paymentMethod = 'COD',
      sessionId,
      zone,
      couponCode: rawCoupon,
    } = body;

    const subtotal = Math.max(0, Number(body.subtotal) || 0);
    const orderType = body.orderType === 'takeaway' ? 'takeaway' : 'delivery';
    const deliveryCharge = orderType === 'delivery' && subtotal > 0 ? 30 : 0;

    let discountAmount = 0;
    let couponCodeSaved = '';
    const couponTrimmed =
      rawCoupon != null && typeof rawCoupon === 'string' ? rawCoupon.trim() : '';
    if (couponTrimmed) {
      const offer = await findActiveOfferByCouponCode(couponTrimmed);
      if (!offer) {
        return res.status(400).json({ error: 'Invalid or expired coupon code' });
      }
      discountAmount = computeDiscountFromOffer(subtotal, offer);
      couponCodeSaved = normalizeCouponCode(offer.couponCode || couponTrimmed);
    }

    const afterDisc = Math.max(0, subtotal - discountAmount);
    const tax = Math.round(afterDisc * 0.05);
    const total = afterDisc + tax + deliveryCharge;

    const clientTotal = Number(body.total);
    if (Number.isFinite(clientTotal) && Math.abs(clientTotal - total) > 2) {
      return res.status(400).json({
        error: 'Order total mismatch. Refresh checkout and try again.',
        serverTotal: total,
      });
    }

    const order = new Order({
      customer,
      items,
      subtotal,
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
      couponCode: couponCodeSaved || undefined,
      tax,
      deliveryCharge,
      total,
      paymentMethod: paymentMethod === 'UPI' ? 'UPI' : 'COD',
      orderType,
      sessionId,
      zone,
      orderNo: 'GENZ#' + Date.now().toString().slice(-6),
    });
    const savedOrder = await order.save();
    const populated = await Order.findById(savedOrder._id).populate('items.item');
    const obj = populated.toObject ? populated.toObject() : populated;
    req.io.to('dashboard').emit('new-order', obj);
    if (obj.orderNo) {
      req.io.to(`order:${obj.orderNo}`).emit('order-status', obj);
    }
    if (obj._id) {
      req.io.to(`order:${String(obj._id)}`).emit('order-status', obj);
    }
    res.json({ success: true, orderNo: savedOrder.orderNo, orderId: String(savedOrder._id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List orders — admin only
router.get('/', adminAuth, async (req, res) => {
  try {
    let orders = await Order.find().sort({ createdAt: -1 }).populate('items.item');
    if (orders.length === 0) {
      orders = [
        {
          _id: 'demo-order',
          orderNo: '0042',
          customer: { name: 'Demo Customer', phone: '+91 9876543210', address: 'Demo Address' },
          items: [{ size: 'full', quantity: 2, item: 'Chicken Momo' }],
          subtotal: 320,
          tax: 20,
          deliveryCharge: 30,
          total: 450,
          paymentMethod: 'UPI',
          status: 'Confirmed',
          zone: 'Zone 1'
        }
      ];
    }
    res.json(orders);
  } catch (err) {
    res.json([]);
  }
});

router.put('/:id/status', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status', allowed: ALLOWED_STATUSES });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid order id' });
    }
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    ).populate('items.item');
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    emitOrderUpdate(req.io, order);
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
