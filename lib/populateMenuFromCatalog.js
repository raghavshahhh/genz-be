const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MenuItem = require('../models/MenuItem');
const { getMenuSeedDocuments } = require('./menuSeed');
const { connectMongoFromEnv } = require('./mongoConnectFromEnv');

/**
 * Loads `backend/data/menuCatalog.json` (via menuSeed) into MongoDB.
 *
 * @param {{ clearExisting?: boolean }} [options]
 * @param {boolean} [options.clearExisting=true] When true, removes all menu documents first.
 * @returns {Promise<{ count: number }>}
 */
async function populateMenuFromCatalog(options = {}) {
  const { clearExisting = true } = options;
  await connectMongoFromEnv();
  if (clearExisting) {
    await MenuItem.deleteMany({});
  }
  const docs = getMenuSeedDocuments();
  const inserted = await MenuItem.insertMany(docs);
  return { count: inserted.length };
}

module.exports = { populateMenuFromCatalog };

if (require.main === module) {
  populateMenuFromCatalog()
    .then(async ({ count }) => {
      console.log(`Menu populated: ${count} items`);
      await mongoose.disconnect().catch(() => {});
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await mongoose.disconnect().catch(() => {});
      process.exit(1);
    });
}
