const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const AppSettings = require('../models/AppSettings');
const { adminAuth } = require('../middleware/adminAuth');
const { resolveFrontendPublicDir } = require('../lib/frontendPublicDir');

const router = express.Router();

async function getOrCreateMain() {
  let doc = await AppSettings.findOne({ key: 'main' });
  if (!doc) {
    doc = await AppSettings.create({ key: 'main', upiId: '' });
  }
  return doc;
}

async function getQrUrlFromPublicDir() {
  try {
    const assetsDir = path.join(resolveFrontendPublicDir(), 'assets');
    const files = await fs.readdir(assetsDir);
    const match = files.find((f) => /^upi-qr\.(png|jpe?g|webp|gif)$/i.test(f));
    return match ? `/assets/${match}` : null;
  } catch {
    return null;
  }
}

async function clearExistingQrFiles() {
  const assetsDir = path.join(resolveFrontendPublicDir(), 'assets');
  let files = [];
  try {
    files = await fs.readdir(assetsDir);
  } catch {
    return;
  }
  for (const f of files) {
    if (/^upi-qr\./i.test(f)) {
      await fs.unlink(path.join(assetsDir, f)).catch(() => {});
    }
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/i.test(file.mimetype)) {
      cb(new Error('Only PNG, JPEG, WebP, or GIF images are allowed'));
      return;
    }
    cb(null, true);
  },
});

// Public — checkout reads UPI id + whether a QR file exists under /assets/
router.get('/checkout', async (req, res) => {
  try {
    let upiId = '';
    if (mongoose.connection.readyState === 1) {
      const doc = await AppSettings.findOne({ key: 'main' }).lean();
      upiId = (doc && doc.upiId) || '';
    }
    const qrUrl = await getQrUrlFromPublicDir();
    res.json({ upiId: String(upiId).trim(), qrUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/checkout', adminAuth, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    const { upiId } = req.body;
    if (upiId !== undefined && typeof upiId !== 'string') {
      return res.status(400).json({ error: 'upiId must be a string' });
    }
    const doc = await getOrCreateMain();
    if (upiId !== undefined) {
      doc.upiId = String(upiId).trim();
    }
    await doc.save();
    const qrUrl = await getQrUrlFromPublicDir();
    res.json({ upiId: doc.upiId, qrUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/checkout/qr', adminAuth, upload.single('qr'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Missing file field "qr"' });
    }
    const ext = path.extname(req.file.originalname).toLowerCase();
    const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
    const safeExt = allowed.includes(ext) ? ext : '.png';
    const publicRoot = resolveFrontendPublicDir();
    const assetsDir = path.join(publicRoot, 'assets');
    await fs.mkdir(assetsDir, { recursive: true });
    await clearExistingQrFiles();
    const dest = path.join(assetsDir, `upi-qr${safeExt}`);
    await fs.writeFile(dest, req.file.buffer);
    const qrUrl = `/assets/upi-qr${safeExt}`;
    res.json({ message: 'QR saved to frontend public assets', qrUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/checkout/qr', adminAuth, async (req, res) => {
  try {
    await clearExistingQrFiles();
    res.json({ message: 'QR removed', qrUrl: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
