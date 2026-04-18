const express = require('express');
const mongoose = require('mongoose');
const MenuItem = require('../models/MenuItem');
const { adminAuth } = require('../middleware/adminAuth');
const router = express.Router();

function calendarDayKey() {
  return new Date().toISOString().slice(0, 10);
}

/** Customer sees item only if not marked off for today */
function isHiddenForCustomersToday(item) {
  const today = calendarDayKey();
  return item.servingDayKey === today && item.unavailableToday === true;
}

function filterCustomerMenu(items) {
  return items.filter((item) => !isHiddenForCustomersToday(item));
}

// Get menu — public (only dishes available on the menu today)
router.get('/', async (req, res) => {
  try {
    const { category, search, veg, specials } = req.query;
    const query = { available: true };

    if (category) query.category = category;
    if (search) query.name = { $regex: search, $options: 'i' };
    if (veg !== undefined) query.veg = veg === 'true';
    if (specials === 'true') query.isSpecial = true;

    let items = await MenuItem.find(query).lean();
    if (mongoose.connection.readyState === 1) {
      items = filterCustomerMenu(items);
    }

    if (items.length === 0) {
      items = [
        {
          _id: 'demo1',
          name: 'Veg Noodles',
          category: 'Chinese',
          veg: true,
          halfPrice: 80,
          fullPrice: 140,
          available: true,
          isSpecial: true,
        },
        {
          _id: 'demo2',
          name: 'Chicken Momo',
          category: 'Momo',
          veg: false,
          halfPrice: 90,
          fullPrice: 160,
          available: true,
        },
        {
          _id: 'demo3',
          name: 'Tandoori Chicken',
          category: 'Tandoor',
          veg: false,
          halfPrice: 180,
          fullPrice: 320,
          available: true,
        },
      ];
    }
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Full menu for admin — includes items marked “off today”; daily flag resets visually when date changes
router.get('/admin', adminAuth, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    const today = calendarDayKey();
    let items = await MenuItem.find().sort({ category: 1, name: 1 }).lean();
    items = items.map((item) => {
      const appliesToday = item.servingDayKey === today;
      const offToday = appliesToday && item.unavailableToday === true;
      return {
        ...item,
        offToday,
        servingResetsNote: 'Turns “available” again automatically after midnight (new calendar day).',
      };
    });
    res.json({ items, calendarDay: today });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add menu item — admin only
router.post('/', adminAuth, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    const {
      name,
      category,
      veg = true,
      halfPrice,
      fullPrice,
      available = true,
      isSpecial = false,
      imageUrl,
    } = req.body;
    if (!name || !category || halfPrice == null || fullPrice == null) {
      return res.status(400).json({ error: 'name, category, halfPrice, fullPrice are required' });
    }
    const item = await MenuItem.create({
      name,
      category,
      veg: Boolean(veg),
      halfPrice: Number(halfPrice),
      fullPrice: Number(fullPrice),
      available: Boolean(available),
      isSpecial: Boolean(isSpecial),
      imageUrl: imageUrl || undefined,
      unavailableToday: false,
      servingDayKey: null,
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle “not serving today” — resets customer visibility next calendar day
router.patch('/:id/serving-today', adminAuth, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    const { unavailableToday } = req.body;
    if (typeof unavailableToday !== 'boolean') {
      return res.status(400).json({ error: 'unavailableToday boolean required' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const today = calendarDayKey();
    const item = await MenuItem.findByIdAndUpdate(
      req.params.id,
      {
        unavailableToday,
        servingDayKey: today,
      },
      { new: true },
    ).lean();
    if (!item) {
      return res.status(404).json({ error: 'Not found' });
    }
    const offToday = item.servingDayKey === today && item.unavailableToday === true;
    res.json({ ...item, offToday });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
