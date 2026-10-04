const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
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
    email: {
      type: String,
      required: [true, 'email is required'],
      unique: true,
      lowercase: true,
      trim: true
    },
    department: {
      type: String,
      default: 'Computer Science',
      trim: true
    },
    role: {
      type: String,
      default: 'student',
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

module.exports = mongoose.model('User', userSchema);
