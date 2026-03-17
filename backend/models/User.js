const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    mobileVerified: {
      type: Boolean,
      default: false,
    },
    mobileOtpCode: {
      type: String,
      default: '',
    },
    mobileOtpExpiresAt: {
      type: Date,
      default: null,
    },
    mobileOtpAttempts: {
      type: Number,
      default: 0,
    },
    mobileOtpLastSentAt: {
      type: Date,
      default: null,
    },
    mobileOtpLockedUntil: {
      type: Date,
      default: null,
    },
    loginOtpCode: {
      type: String,
      default: '',
    },
    loginOtpExpiresAt: {
      type: Date,
      default: null,
    },
    loginOtpAttempts: {
      type: Number,
      default: 0,
    },
    loginOtpLastSentAt: {
      type: Date,
      default: null,
    },
    loginOtpLockedUntil: {
      type: Date,
      default: null,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'worker'],
      default: 'user',
    },
    adminLevel: {
      type: String,
      enum: ['village', 'mandal', 'district', 'state', 'nation', ''],
      default: '',
      index: true,
    },
    adminTitle: {
      type: String,
      trim: true,
      default: '',
    },
    specialty: {
      type: String,
      trim: true,
      default: '',
    },
    village: {
      type: String,
      trim: true,
      default: '',
    },
    mandal: {
      type: String,
      trim: true,
      default: '',
    },
    district: {
      type: String,
      trim: true,
      default: '',
    },
    state: {
      type: String,
      trim: true,
      default: '',
    },
    country: {
      type: String,
      trim: true,
      default: '',
    },
    refreshToken: {
      type: String,
      default: null,
    },
    accountStatus: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    deactivatedAt: {
      type: Date,
      default: null,
    },
    deactivatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deactivationReason: {
      type: String,
      trim: true,
      default: '',
    },
    adminScopeKey: {
      type: String,
      trim: true,
      default: '',
    },
    passwordResetToken: {
      type: String,
      default: '',
    },
    passwordResetExpiresAt: {
      type: Date,
      default: null,
    },
    passwordResetLastRequestedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.index(
  { adminScopeKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      role: 'admin',
      accountStatus: 'active',
      adminScopeKey: { $type: 'string', $ne: '' },
    },
  }
);

module.exports = mongoose.model('User', userSchema);
