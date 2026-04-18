const mongoose = require('mongoose');

const deliveryZoneSchema = new mongoose.Schema({
  name: { type: String, required: true },
  charge: { type: Number, required: true },
  minOrder: { type: Number, default: 0 }
});

module.exports = mongoose.model('DeliveryZone', deliveryZoneSchema);
