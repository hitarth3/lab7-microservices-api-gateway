const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    sequence: { type: Number, default: 1000 }
  },
  { versionKey: false }
);

module.exports = mongoose.model('OrderCounter', counterSchema);
