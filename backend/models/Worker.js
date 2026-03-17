const mongoose = require('mongoose');

const SPECIALTIES = [
  'Civil Engineer',
  'Electrician',
  'Plumber',
  'Road Contractor',
  'Environmental Inspector',
  'Sanitation Worker',
  'Building Inspector',
  'Water Engineer',
  'IT Technician',
  'General Contractor',
];

// Suggested specialty based on complaint category / department keywords
const SPECIALTY_SUGGESTIONS = {
  infrastructure: 'Civil Engineer',
  road: 'Road Contractor',
  transport: 'Road Contractor',
  water: 'Water Engineer',
  sanitation: 'Sanitation Worker',
  sewage: 'Plumber',
  plumbing: 'Plumber',
  electricity: 'Electrician',
  power: 'Electrician',
  electrical: 'Electrician',
  environment: 'Environmental Inspector',
  pollution: 'Environmental Inspector',
  building: 'Building Inspector',
  construction: 'Civil Engineer',
  it: 'IT Technician',
  technology: 'IT Technician',
  general: 'General Contractor',
};

const workerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    specialty: {
      type: String,
      enum: SPECIALTIES,
      required: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    deactivatedAt: {
      type: Date,
      default: null,
    },
    deactivationReason: {
      type: String,
      trim: true,
      default: '',
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

const Worker = mongoose.model('Worker', workerSchema);

module.exports = Worker;
module.exports.SPECIALTIES = SPECIALTIES;
module.exports.SPECIALTY_SUGGESTIONS = SPECIALTY_SUGGESTIONS;
