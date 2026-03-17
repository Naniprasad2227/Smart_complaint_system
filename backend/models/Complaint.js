const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
    complaintLocation: {
      country: {
        type: String,
        trim: true,
        default: '',
      },
      state: {
        type: String,
        trim: true,
        default: '',
      },
      district: {
        type: String,
        trim: true,
        default: '',
      },
      mandal: {
        type: String,
        trim: true,
        default: '',
      },
      village: {
        type: String,
        trim: true,
        default: '',
      },
      fullAddress: {
        type: String,
        trim: true,
        default: '',
      },
    },
    complaintTitle: {
      type: String,
      required: true,
      trim: true,
    },
    complaintDescription: {
      type: String,
      required: true,
      trim: true,
    },
    complaintText: {
      type: String,
      required: true,
      trim: true,
    },
    problemTypeKey: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    locationIssueKey: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    reportCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    firstReportedAt: {
      type: Date,
      default: Date.now,
    },
    lastReportedAt: {
      type: Date,
      default: Date.now,
    },
    reportHistory: [
      {
        reporterId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        reporterSnapshot: {
          name: { type: String, trim: true, default: '' },
          email: { type: String, trim: true, default: '' },
          phone: { type: String, trim: true, default: '' },
          village: { type: String, trim: true, default: '' },
          mandal: { type: String, trim: true, default: '' },
          district: { type: String, trim: true, default: '' },
          state: { type: String, trim: true, default: '' },
          country: { type: String, trim: true, default: '' },
        },
        complaintTitle: { type: String, trim: true, default: '' },
        complaintDescription: { type: String, trim: true, default: '' },
        reportedAt: { type: Date, default: Date.now },
      },
    ],
    recurrenceHistory: [
      {
        reopenedAt: {
          type: Date,
          default: Date.now,
        },
        previousStatus: {
          type: String,
          trim: true,
          default: '',
        },
        reopenedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        reason: {
          type: String,
          trim: true,
          default: '',
        },
        trigger: {
          type: String,
          enum: ['new-report', 'admin-status-change'],
          default: 'new-report',
        },
      },
    ],
    deadlineAt: {
      type: Date,
      default: null,
    },
    escalationHistory: [
      {
        escalatedAt: {
          type: Date,
          default: Date.now,
        },
        escalatedFromLevel: {
          type: String,
          trim: true,
          default: '',
        },
        escalatedToLevel: {
          type: String,
          trim: true,
          default: '',
        },
        escalatedFromAdminId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        escalatedToAdminId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        reason: {
          type: String,
          trim: true,
          default: '',
        },
      },
    ],
    reporterSnapshot: {
      name: {
        type: String,
        trim: true,
        default: '',
      },
      email: {
        type: String,
        trim: true,
        default: '',
      },
      phone: {
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
    },
    category: {
      type: String,
      default: 'General',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    department: {
      type: String,
      default: 'General Operations',
    },
    status: {
      type: String,
      enum: ['Submitted', 'Under Review', 'In Progress', 'Resolved', 'Closed'],
      default: 'Submitted',
    },
    sentiment: {
      type: String,
      enum: ['Negative', 'Neutral', 'Positive'],
      default: 'Neutral',
    },
    assignedWorker: {
      workerId: {
        type: mongoose.Schema.Types.ObjectId,
      },
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      specialty: { type: String, trim: true },
    },
    progressNote: {
      type: String,
      trim: true,
      default: '',
    },
    images: [
      {
        fileName: {
          type: String,
        },
        filePath: {
          type: String,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

complaintSchema.index({ assignedAdminId: 1, problemTypeKey: 1, locationIssueKey: 1, status: 1 });

module.exports = mongoose.model('Complaint', complaintSchema);
