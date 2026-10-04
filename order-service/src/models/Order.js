const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      required: true,
      unique: true,
      index: true
    },
    userId: {
      type: Number,
      required: [true, 'userId is required']
    },
    productId: {
      type: Number,
      required: [true, 'productId is required']
    },
    quantity: {
      type: Number,
      required: [true, 'quantity is required'],
      min: [1, 'quantity must be at least 1'],
      default: 1
    },
    totalAmount: {
      type: Number,
      required: [true, 'totalAmount is required']
    },
    status: {
      type: String,
      default: 'CONFIRMED',
      enum: ['PENDING', 'CONFIRMED', 'CANCELLED']
    },
    userDetails: {
      name: String,
      email: String,
      department: String
    },
    productDetails: {
      name: String,
      price: Number,
      category: String
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

module.exports = mongoose.model('Order', orderSchema);
