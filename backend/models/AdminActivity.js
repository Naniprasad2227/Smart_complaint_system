const mongoose = require('mongoose');

const adminActivitySchema = new mongoose.Schema(
  {
    adminUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      trim: true,
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info',
      index: true,
    },
    ipAddress: {
      type: String,
      trim: true,
      default: '',
    },
    userAgent: {
      type: String,
      trim: true,
      default: '',
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true }
);

adminActivitySchema.index({ adminUserId: 1, createdAt: -1 });

module.exports = mongoose.model('AdminActivity', adminActivitySchema);
