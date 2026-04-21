const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

const PUBLIC_LINKS = [
  { to: '/home', label: 'Home' },
  { to: '/menu', label: 'Menu' },
  { to: '/cart', label: 'Cart' },
  { to: '/checkout', label: 'Checkout' },
  { to: '/track', label: 'Track' },
];

/** Shown when logged in as owner — no customer cart/checkout */
const OWNER_NAV_LINKS = [
  { to: '/home', label: 'Home' },
  { to: '/menu', label: 'Menu' },
  { to: '/admin/menu', label: 'Manage menu' },
  { to: '/admin/payment', label: 'Payment' },
  { to: '/track', label: 'Track' },
];

const ADMIN_ONLY_LINKS = [
  { to: '/admin/dashboard', label: 'Dashboard', admin: true },
  { to: '/admin/login', label: 'Admin login', admin: true },
];

router.get('/', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  let isAdmin = false;
  if (token && process.env.JWT_SECRET) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      isAdmin = payload.role === 'admin';
    } catch {
      isAdmin = false;
    }
  }

  const links = isAdmin
    ? [...OWNER_NAV_LINKS, ...ADMIN_ONLY_LINKS.filter((l) => l.to !== '/admin/login')]
    : PUBLIC_LINKS;

  res.json({ links, isAdmin });
});

module.exports = router;
