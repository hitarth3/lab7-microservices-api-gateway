const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      required: true,
      unique: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    price: {
      type: Number,
      required: [true, 'price is required'],
      min: [0, 'price must be positive']
    },
    stock: {
      type: Number,
      default: 100,
      min: [0, 'stock cannot be negative']
    },
    category: {
      type: String,
      default: 'General',
      trim: true
    }
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: function (_doc, ret) {
        delete ret._id;
        return ret;
      }
    }
  }
);

module.exports = mongoose.model('Product', productSchema);
