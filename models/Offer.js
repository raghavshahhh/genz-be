const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  images: [String]
});

module.exports = mongoose.model('Offer', offerSchema);
