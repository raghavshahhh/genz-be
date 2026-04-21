const path = require('path');
const dns = require('dns');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static('uploads'));

/** Strip wrapping quotes some editors add to .env values */
function stripEnvUri(value) {
  if (value == null || typeof value !== 'string') return '';
  const t = value.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

const mongooseOpts = {
  serverSelectionTimeoutMS: 15_000,
};

async function connectMongoDB() {
  const direct = stripEnvUri(process.env.MONGO_URI_DIRECT);
  const primary = stripEnvUri(process.env.MONGO_URI);

  if (!direct && !primary) {
    console.log('ℹ️ No MONGO_URI — using demo fallbacks');
    return;
  }

  const attempts = [];
  if (direct) attempts.push({ uri: direct, label: 'MONGO_URI_DIRECT (standard / non-SRV)' });
  if (primary) attempts.push({ uri: primary, label: 'MONGO_URI' });

  const previousDns = dns.getServers();

  for (let i = 0; i < attempts.length; i += 1) {
    const { uri, label } = attempts[i];
    try {
      if (uri.startsWith('mongodb+srv://')) {
        try {
          dns.setDefaultResultOrder('ipv4first');
        } catch {
          /* Node < 17 */
        }
        dns.setServers(['8.8.8.8', '1.1.1.1']);
      }

      await mongoose.connect(uri, mongooseOpts);
      console.log(`✅ MongoDB connected (${label})`);
      if (previousDns.length) dns.setServers(previousDns);
      return;
    } catch (err) {
      await mongoose.disconnect().catch(() => {});
      console.error(`❌ MongoDB attempt failed (${label}):`, err.message || err);
      if (err.code === 'ECONNREFUSED' && err.syscall === 'querySrv') {
        console.error(
          '   SRV lookup failed. Add Atlas “standard connection string” as MONGO_URI_DIRECT in .env (mongodb://… with host list), or fix DNS/VPN.',
        );
      }
    }
  }

  if (previousDns.length) dns.setServers(previousDns);
  console.warn('⚠️ MongoDB unavailable — server still runs; routes use fallbacks where supported.');
}
// Socket.io - Real-time orders
io.on('connection', (socket) => {
  console.log('👤 Client connected:', socket.id);
  
  socket.on('join-dashboard', () => {
    socket.join('dashboard');
  });

  socket.on('join-order', (payload) => {
    if (!payload) return;
    if (typeof payload === 'string') {
      socket.join(`order:${payload}`);
      return;
    }
    if (typeof payload === 'object') {
      if (payload.orderNo && typeof payload.orderNo === 'string') {
        socket.join(`order:${payload.orderNo}`);
      }
      if (payload.orderId && typeof payload.orderId === 'string') {
        socket.join(`order:${payload.orderId}`);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('👤 Client disconnected:', socket.id);
  });
});

// Pass io to req
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Temp routes - Seed demo data
app.get('/api/seed', async (req, res) => {
  // Seed logic later
  res.json({ message: 'Seed endpoint ready' });
});

app.get('/api/test', (req, res) => res.json({ message: 'Backend running! 🎉' }));

// Routes
app.use('/api/menu', require('./routes/menu'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/nav', require('./routes/nav'));
app.use('/api/offers', require('./routes/offers'));

// Seed demo data
app.post('/api/seed', async (req, res) => {
  const MenuItem = require('./models/MenuItem');
  const DeliveryZone = require('./models/DeliveryZone');
  const Order = require('./models/Order');
  
  await MenuItem.deleteMany({});
  await DeliveryZone.deleteMany({});
  await Order.deleteMany({});

  const { getMenuSeedDocuments } = require('./lib/menuSeed');
  const demoItems = getMenuSeedDocuments();

  const createdItems = await MenuItem.insertMany(demoItems);
  const zones = await DeliveryZone.insertMany([
    { name: 'Zone 1 (0-3km)', charge: 30, minOrder: 200 },
    { name: 'Zone 2 (3-6km)', charge: 50, minOrder: 300 },
    { name: 'Zone 3 (6-10km)', charge: 70, minOrder: 400 },
  ]);

  const sampleCustomers = [
    { name: 'Aarav Singh', phone: '+91 9000011111', address: 'Sector 12, Downtown' },
    { name: 'Ishita Sharma', phone: '+91 9000022222', address: 'Lake Road, City Center' },
    { name: 'Rohan Das', phone: '+91 9000033333', address: 'Green Park, Block B' },
    { name: 'Meera Patel', phone: '+91 9000044444', address: 'Hill View Apartments' },
    { name: 'Kabir Khan', phone: '+91 9000055555', address: 'Sunrise Colony' },
  ];

  const seededOrders = [];
  for (let i = 0; i < 15; i += 1) {
    const firstItem = createdItems[i % createdItems.length];
    const secondItem = createdItems[(i + 7) % createdItems.length];
    const zone = zones[i % zones.length];
    const items = [
      { item: firstItem._id, size: i % 2 === 0 ? 'full' : 'half', quantity: (i % 3) + 1 },
      { item: secondItem._id, size: i % 2 === 0 ? 'half' : 'full', quantity: 1 },
    ];

    const subtotal = items.reduce((sum, line) => {
      const priceSource = createdItems.find((menu) => String(menu._id) === String(line.item));
      const unitPrice = line.size === 'half' ? priceSource.halfPrice : priceSource.fullPrice;
      return sum + unitPrice * line.quantity;
    }, 0);
    const tax = Math.round(subtotal * 0.05);
    const deliveryCharge = zone.charge;
    const total = subtotal + tax + deliveryCharge;
    const customer = sampleCustomers[i % sampleCustomers.length];

    seededOrders.push({
      orderNo: `GENZ#${String(100001 + i)}`,
      customer,
      items,
      subtotal,
      tax,
      deliveryCharge,
      total,
      paymentMethod: i % 2 === 0 ? 'UPI' : 'COD',
      status: ['Confirmed', 'Cooking', 'Out for Delivery', 'Delivered'][i % 4],
      zone: zone.name,
    });
  }

  await Order.insertMany(seededOrders);
  
  res.json({
    message: 'Demo data seeded successfully',
    counts: {
      menuItems: createdItems.length,
      deliveryZones: zones.length,
      orders: seededOrders.length,
    },
  });
});

app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }
  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, success: true });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

app.get('/api/admin/me', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token || !process.env.JWT_SECRET) {
    return res.json({ admin: false });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return res.json({ admin: payload.role === 'admin' });
  } catch {
    return res.json({ admin: false });
  }
});

const PORT = process.env.PORT || 5000;

async function start() {
  await connectMongoDB();
  server.listen(PORT, () => {
    console.log(`🚀 Backend running on http://localhost:${PORT}`);
  });
}

start().catch((e) => {
  console.error('Fatal startup error:', e);
  server.listen(PORT, () => {
    console.log(`🚀 Backend running on http://localhost:${PORT} (Mongo skipped)`);
  });
});
