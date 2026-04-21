const mongoose = require('mongoose');

const appSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'main' },
    upiId: { type: String, default: '' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('AppSettings', appSettingsSchema);
