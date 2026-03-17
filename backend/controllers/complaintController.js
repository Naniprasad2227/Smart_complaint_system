const axios = require('axios');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const Worker = require('../models/Worker');
const { logAdminActivity } = require('../utils/adminSecurityLogger');
const { notifyUsers } = require('../utils/notificationService');
const {
  buildComplaintScopeMatch,
  canAdminAccessByScope,
  buildHigherLevelAdminQuery,
} = require('../utils/adminHierarchy');

const defaultAIResponse = {
  category: 'General',
  priority: 'Medium',
  department: 'General Operations',
  sentiment: 'Neutral',
};

const allowedStatus = ['Submitted', 'Under Review', 'In Progress', 'Resolved', 'Closed'];
const activeStatusSet = new Set(['Submitted', 'Under Review', 'In Progress']);

const priorityRank = {
  Low: 1,
  Medium: 2,
  High: 3,
};

const ESCALATION_HOURS = Math.max(1, Number(process.env.COMPLAINT_ESCALATION_HOURS || 48));

const isMajorOrRepeatedComplaint = (complaint) => {
  const priority = String(complaint?.priority || '').trim();
  const category = normalizeKey(complaint?.category || '');
  const reportCount = Number(complaint?.reportCount || 0);
  return priority === 'High' || reportCount >= 3 || category === 'sanitation' || category === 'electricity';
};

const isComplaintClosed = (status) => ['Resolved', 'Closed'].includes(String(status || ''));

const buildDefaultDeadline = () => new Date(Date.now() + ESCALATION_HOURS * 60 * 60 * 1000);

const predictComplaint = async (complaintText) => {
  try {
    const { data } = await axios.post(process.env.AI_SERVICE_URL, { text: complaintText }, { timeout: 7000 });
    return {
      category: data.category || defaultAIResponse.category,
      priority: data.priority || defaultAIResponse.priority,
      department: data.department || defaultAIResponse.department,
      sentiment: data.sentiment || defaultAIResponse.sentiment,
    };
  } catch (error) {
    return defaultAIResponse;
  }
};

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isLocationComplete = (entity) => {
  const requiredFields = ['village', 'mandal', 'district', 'state', 'country'];
  return requiredFields.every((field) => String(entity?.[field] || '').trim().length > 0);
};

const fieldRegex = (value) => ({ $regex: new RegExp(`^${escapeRegExp(String(value).trim())}$`, 'i') });

// Primary assignment goes to the village-level admin for that governance scope.
// If unavailable, fallback to broader levels to avoid dropping citizen complaints.
const findMatchingAdmin = async (location) => {
  const { village, mandal, district, state, country } = location;

  // 1. Village-level admin for exact scope
  let admin = await User.findOne({
    role: 'admin',
    accountStatus: 'active',
    adminLevel: 'village',
    village: fieldRegex(village),
    mandal: fieldRegex(mandal),
    district: fieldRegex(district),
    state: fieldRegex(state),
    country: fieldRegex(country),
  }).sort({ createdAt: -1 });
  if (admin) return admin;

  // 2. Mandal-level admin fallback
  admin = await User.findOne({
    role: 'admin',
    accountStatus: 'active',
    adminLevel: 'mandal',
    mandal: fieldRegex(mandal),
    district: fieldRegex(district),
    state: fieldRegex(state),
    country: fieldRegex(country),
  }).sort({ createdAt: -1 });
  if (admin) return admin;

  // 3. District-level fallback
  admin = await User.findOne({
    role: 'admin',
    accountStatus: 'active',
    adminLevel: 'district',
    district: fieldRegex(district),
    state: fieldRegex(state),
    country: fieldRegex(country),
  }).sort({ createdAt: -1 });
  if (admin) return admin;

  // 4. State-level fallback
  admin = await User.findOne({
    role: 'admin',
    accountStatus: 'active',
    adminLevel: 'state',
    state: fieldRegex(state),
    country: fieldRegex(country),
  }).sort({ createdAt: -1 });
  if (admin) return admin;

  // 5. Nation-level fallback
  admin = await User.findOne({
    role: 'admin',
    accountStatus: 'active',
    adminLevel: 'nation',
    country: fieldRegex(country),
  }).sort({ createdAt: -1 });
  return admin;
};

const cleanLocationField = (value) => String(value || '').trim();

const normalizeKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const getStreetOrVillageKey = (complaintLocation, userLocation) => {
  const fullAddress = cleanLocationField(complaintLocation?.fullAddress);
  if (fullAddress) {
    const firstSegment = fullAddress.split(',')[0];
    if (cleanLocationField(firstSegment)) {
      return normalizeKey(firstSegment);
    }
  }

  return normalizeKey(complaintLocation?.village || userLocation?.village);
};

const buildReporterSnapshot = (user) => ({
  name: String(user?.name || '').trim(),
  email: String(user?.email || '').trim(),
  phone: String(user?.phone || '').trim(),
  village: String(user?.village || '').trim(),
  mandal: String(user?.mandal || '').trim(),
  district: String(user?.district || '').trim(),
  state: String(user?.state || '').trim(),
  country: String(user?.country || '').trim(),
});

const createReportHistoryEntry = (user, complaintTitle, complaintDescription) => ({
  reporterId: user?._id,
  reporterSnapshot: buildReporterSnapshot(user),
  complaintTitle: String(complaintTitle || '').trim(),
  complaintDescription: String(complaintDescription || '').trim(),
  reportedAt: new Date(),
});

const createReopenNotifications = async ({ complaint, previousStatus, trigger }) => {
  const reporter = complaint?.userId ? await User.findById(complaint.userId).select('accountStatus').lean() : null;
  const assignedAdmin = complaint?.assignedAdminId
    ? await User.findById(complaint.assignedAdminId).select('adminLevel village mandal district state country').lean()
    : null;
  const assignedWorkerUserId = complaint?.assignedWorker?.workerId || null;
  const assignedWorkerUser = assignedWorkerUserId
    ? await User.findById(assignedWorkerUserId).select('accountStatus').lean()
    : null;
  const assignedManagedWorker = assignedWorkerUserId
    ? await Worker.findById(assignedWorkerUserId).select('isActive').lean()
    : null;

  const deactivatedFlags = [];
  if (reporter?.accountStatus === 'inactive') {
    deactivatedFlags.push('reporter account is inactive');
  }
  if (assignedWorkerUser?.accountStatus === 'inactive') {
    deactivatedFlags.push('assigned worker account is inactive');
  }
  if (assignedManagedWorker && assignedManagedWorker.isActive === false) {
    deactivatedFlags.push('assigned managed worker is inactive');
  }

  if (deactivatedFlags.length === 0) {
    deactivatedFlags.push('reopened issue requires higher-level oversight');
  }

  const recipients = [];
  if (assignedAdmin) {
    const higherLevelQuery = buildHigherLevelAdminQuery(assignedAdmin);
    if (higherLevelQuery) {
      const higherLevelAdmin = await User.findOne(higherLevelQuery).select('_id').lean();
      if (higherLevelAdmin?._id) {
        recipients.push(String(higherLevelAdmin._id));
      }
    }
  }
  if (assignedWorkerUserId) {
    recipients.push(String(assignedWorkerUserId));
  }

  const message = `Complaint \"${complaint.complaintTitle || 'Untitled complaint'}\" was reopened from ${previousStatus} while ${deactivatedFlags.join(' and ')}.`;

  const uniqueRecipients = Array.from(new Set(recipients.filter(Boolean)));
  if (!uniqueRecipients.length) return;

  await notifyUsers({
    recipientUserIds: uniqueRecipients,
    complaintId: complaint._id,
    type: 'complaint-reopened',
    title: 'Complaint reopened and escalated',
    message,
    metadata: {
      complaintId: complaint._id,
      trigger,
      previousStatus,
    },
  });
};

const maybeEscalateToHigherLevelAdmin = async (complaint, reason = 'Complaint exceeded response time limit') => {
  if (!complaint || isComplaintClosed(complaint.status)) return { escalated: false };

  const deadline = complaint.deadlineAt ? new Date(complaint.deadlineAt) : null;
  if (!deadline || deadline.getTime() > Date.now()) {
    return { escalated: false };
  }

  const assignedAdmin = complaint.assignedAdminId
    ? await User.findById(complaint.assignedAdminId)
      .select('_id name adminLevel village mandal district state country accountStatus')
      .lean()
    : null;
  if (!assignedAdmin || assignedAdmin.accountStatus !== 'active') {
    return { escalated: false };
  }

  const higherLevelQuery = buildHigherLevelAdminQuery(assignedAdmin);
  if (!higherLevelQuery) return { escalated: false };

  const higherLevelAdmin = await User.findOne(higherLevelQuery)
    .select('_id name adminLevel accountStatus')
    .lean();
  if (!higherLevelAdmin || higherLevelAdmin.accountStatus !== 'active') {
    return { escalated: false };
  }

  const latestEscalation = Array.isArray(complaint.escalationHistory)
    ? complaint.escalationHistory[complaint.escalationHistory.length - 1]
    : null;
  if (
    latestEscalation &&
    String(latestEscalation.escalatedToAdminId || '') === String(higherLevelAdmin._id)
  ) {
    return { escalated: false };
  }

  complaint.escalationHistory = Array.isArray(complaint.escalationHistory) ? complaint.escalationHistory : [];
  complaint.escalationHistory.push({
    escalatedAt: new Date(),
    escalatedFromLevel: assignedAdmin.adminLevel,
    escalatedToLevel: higherLevelAdmin.adminLevel,
    escalatedFromAdminId: assignedAdmin._id,
    escalatedToAdminId: higherLevelAdmin._id,
    reason,
  });
  complaint.assignedAdminId = higherLevelAdmin._id;
  complaint.deadlineAt = buildDefaultDeadline();
  await complaint.save();

  await notifyUsers({
    recipientUserIds: [higherLevelAdmin._id],
    complaintId: complaint._id,
    type: 'complaint-escalated',
    title: 'Complaint escalated to your governance level',
    message: `Complaint "${complaint.complaintTitle}" was escalated from ${assignedAdmin.adminLevel} to ${higherLevelAdmin.adminLevel}.`,
    metadata: {
      complaintId: complaint._id,
      fromAdminId: assignedAdmin._id,
      toAdminId: higherLevelAdmin._id,
      reason,
    },
  });

  await notifyUsers({
    recipientUserIds: [complaint.userId],
    complaintId: complaint._id,
    type: 'complaint-escalated',
    title: 'Your complaint has been escalated',
    message: `Your complaint "${complaint.complaintTitle}" was escalated to ${higherLevelAdmin.adminLevel} administration for faster resolution.`,
    metadata: {
      complaintId: complaint._id,
      reason,
    },
  });

  return { escalated: true, escalatedToAdmin: higherLevelAdmin };
};

const appendReportToComplaint = (complaint, user, complaintTitle, complaintDescription) => {
  complaint.reportHistory = Array.isArray(complaint.reportHistory) ? complaint.reportHistory : [];
  complaint.reportHistory.push(createReportHistoryEntry(user, complaintTitle, complaintDescription));
  complaint.reportCount = Number(complaint.reportCount || 0) + 1;
  complaint.lastReportedAt = new Date();
};

const canAccessComplaint = (complaint, user) => {
  if (!complaint || !user) return false;

  if (String(complaint.userId) === String(user._id)) return true;
  if (
    Array.isArray(complaint.reportHistory) &&
    complaint.reportHistory.some((entry) => String(entry?.reporterId || '') === String(user._id))
  ) {
    return true;
  }
  if (user.role === 'admin') {
    const complaintLocation = {
      village: complaint.complaintLocation?.village || complaint.village,
      mandal: complaint.complaintLocation?.mandal || complaint.mandal,
      district: complaint.complaintLocation?.district || complaint.district,
      state: complaint.complaintLocation?.state || complaint.state,
      country: complaint.complaintLocation?.country || complaint.country,
    };

    if (canAdminAccessByScope(user, complaintLocation)) return true;
  }
  if (user.role === 'worker' && String(complaint.assignedWorker?.workerId || '') === String(user._id)) return true;

  return false;
};

const buildComplaintLocation = (incomingLocation, userLocation) => {
  const source = incomingLocation && typeof incomingLocation === 'object' ? incomingLocation : {};

  const country = cleanLocationField(source.country) || cleanLocationField(userLocation.country);
  const state = cleanLocationField(source.state) || cleanLocationField(userLocation.state);
  const district = cleanLocationField(source.district) || cleanLocationField(userLocation.district);
  const mandal = cleanLocationField(source.mandal) || cleanLocationField(userLocation.mandal);
  const village = cleanLocationField(source.village) || cleanLocationField(userLocation.village);
  const fullAddress =
    cleanLocationField(source.fullAddress) ||
    [village, mandal, district, state, country].filter(Boolean).join(', ');

  return {
    country,
    state,
    district,
    mandal,
    village,
    fullAddress,
  };
};

const submitComplaint = async (req, res) => {
  try {
    const {
      complaintTitle,
      complaintDescription,
      complaintText,
      title,
      description,
      location,
    } = req.body;

    const normalizedTitle = (complaintTitle || title || '').trim();
    const normalizedDescription = (complaintDescription || description || '').trim();
    const normalizedText = (complaintText || '').trim();

    const finalTitle = normalizedTitle || normalizedText.slice(0, 80) || 'General Complaint';
    const finalDescription = normalizedDescription || normalizedText;
    const finalComplaintText = `${finalTitle}. ${finalDescription}`.trim();

    if (finalTitle.length < 5) {
      return res.status(400).json({ message: 'Complaint title must be at least 5 characters long' });
    }

    if (finalDescription.length < 10) {
      return res.status(400).json({ message: 'Complaint description must be at least 10 characters long' });
    }

    const normalizedMobile = String(req.user.phone || '').replace(/\D/g, '');
    if (!/^\d{10}$/.test(normalizedMobile)) {
      return res.status(400).json({
        message: 'Your mobile number must be exactly 10 digits. Please update your profile.',
      });
    }

    if (!req.user.mobileVerified) {
      return res.status(400).json({
        message: 'Your mobile number is not OTP verified. Please verify it in your profile before submitting a complaint.',
      });
    }

    if (!isLocationComplete(req.user)) {
      return res.status(400).json({
        message:
          'Your location profile is incomplete. Please ensure village, mandal, district, state and country are set.',
      });
    }

    const matchedAdmin = await findMatchingAdmin(req.user);
    if (!matchedAdmin) {
      return res.status(404).json({
        message:
          'No admin found for your village or area. Please contact support.',
      });
    }

    const aiResult = await predictComplaint(finalComplaintText);
    const complaintLocation = buildComplaintLocation(location, req.user);
    const reporterSnapshot = buildReporterSnapshot(req.user);
    const problemTypeKey = normalizeKey(aiResult.category);
    const locationIssueKey = getStreetOrVillageKey(complaintLocation, req.user);

    const activeMatch = await Complaint.findOne({
      assignedAdminId: matchedAdmin._id,
      problemTypeKey,
      locationIssueKey,
      status: { $in: Array.from(activeStatusSet) },
    }).sort({ lastReportedAt: -1, createdAt: -1 });

    if (activeMatch) {
      appendReportToComplaint(activeMatch, req.user, finalTitle, finalDescription);

      if ((priorityRank[aiResult.priority] || 0) > (priorityRank[activeMatch.priority] || 0)) {
        activeMatch.priority = aiResult.priority;
      }

      await activeMatch.save();

      await notifyUsers({
        recipientUserIds: [req.user._id],
        complaintId: activeMatch._id,
        type: 'complaint-accepted',
        title: 'Complaint report linked successfully',
        message: 'Your complaint report was linked to an existing active complaint in your location.',
        metadata: {
          complaintId: activeMatch._id,
          linkedToExisting: true,
        },
      });

      if (isMajorOrRepeatedComplaint(activeMatch)) {
        const stateAdmin = await User.findOne({
          role: 'admin',
          accountStatus: 'active',
          adminLevel: 'state',
          state: fieldRegex(activeMatch.state),
          country: fieldRegex(activeMatch.country),
        }).select('_id').lean();

        if (stateAdmin?._id) {
          await notifyUsers({
            recipientUserIds: [stateAdmin._id],
            complaintId: activeMatch._id,
            type: 'complaint-escalated',
            title: 'Major or repeated complaint alert',
            message: `Complaint "${activeMatch.complaintTitle}" is marked as major/repeated in your state scope.`,
            metadata: {
              complaintId: activeMatch._id,
              trigger: 'major-or-repeated',
            },
          });
        }
      }

      return res.status(201).json({
        ...activeMatch.toObject(),
        linkedToExisting: true,
        message: 'A matching active complaint already exists for this issue/location. Your report was linked to it.',
      });
    }

    const closedMatch = await Complaint.findOne({
      assignedAdminId: matchedAdmin._id,
      problemTypeKey,
      locationIssueKey,
      status: { $in: ['Resolved', 'Closed'] },
    }).sort({ updatedAt: -1, createdAt: -1 });

    if (closedMatch) {
      const previousStatus = closedMatch.status;
      appendReportToComplaint(closedMatch, req.user, finalTitle, finalDescription);
      closedMatch.recurrenceHistory = Array.isArray(closedMatch.recurrenceHistory)
        ? closedMatch.recurrenceHistory
        : [];
      closedMatch.recurrenceHistory.push({
        reopenedAt: new Date(),
        previousStatus,
        reopenedBy: req.user._id,
        reason: 'Issue re-reported after closure by a citizen report',
        trigger: 'new-report',
      });
      closedMatch.status = 'Under Review';
      closedMatch.progressNote = 'Re-opened automatically due to recurring reports on the same issue/location.';
      if ((priorityRank[aiResult.priority] || 0) > (priorityRank[closedMatch.priority] || 0)) {
        closedMatch.priority = aiResult.priority;
      }
      await closedMatch.save();
      await createReopenNotifications({
        complaint: closedMatch,
        previousStatus,
        trigger: 'new-report',
      });

      await notifyUsers({
        recipientUserIds: [req.user._id],
        complaintId: closedMatch._id,
        type: 'complaint-accepted',
        title: 'Complaint re-opened',
        message: 'A previous resolved complaint was reopened because the same issue was reported again.',
        metadata: {
          complaintId: closedMatch._id,
          reopenedFromResolved: true,
        },
      });

      return res.status(201).json({
        ...closedMatch.toObject(),
        linkedToExisting: true,
        reopenedFromResolved: true,
        message: 'A resolved/closed complaint for the same issue reoccurred and has been re-opened.',
      });
    }

    const complaint = await Complaint.create({
      userId: req.user._id,
      assignedAdminId: matchedAdmin._id,
      village: String(req.user.village).trim(),
      mandal: String(req.user.mandal).trim(),
      district: String(req.user.district).trim(),
      state: String(req.user.state).trim(),
      country: String(req.user.country).trim(),
      reporterSnapshot,
      complaintLocation,
      complaintTitle: finalTitle,
      complaintDescription: finalDescription,
      complaintText: finalComplaintText,
      problemTypeKey,
      locationIssueKey,
      reportCount: 1,
      firstReportedAt: new Date(),
      lastReportedAt: new Date(),
      reportHistory: [createReportHistoryEntry(req.user, finalTitle, finalDescription)],
      category: aiResult.category,
      priority: aiResult.priority,
      department: aiResult.department,
      sentiment: aiResult.sentiment,
      status: 'Submitted',
      deadlineAt: buildDefaultDeadline(),
    });

    await notifyUsers({
      recipientUserIds: [matchedAdmin._id],
      complaintId: complaint._id,
      type: 'new-complaint',
      title: 'New complaint received',
      message: `A new complaint "${complaint.complaintTitle}" was submitted in your governance scope.`,
      metadata: {
        complaintId: complaint._id,
        adminLevel: matchedAdmin.adminLevel,
      },
    });

    await notifyUsers({
      recipientUserIds: [req.user._id],
      complaintId: complaint._id,
      type: 'complaint-accepted',
      title: 'Complaint accepted',
      message: 'Your complaint was accepted and routed to the local administration.',
      metadata: {
        complaintId: complaint._id,
        status: complaint.status,
      },
    });

    if (isMajorOrRepeatedComplaint(complaint)) {
      const stateAdmin = await User.findOne({
        role: 'admin',
        accountStatus: 'active',
        adminLevel: 'state',
        state: fieldRegex(complaint.state),
        country: fieldRegex(complaint.country),
      }).select('_id').lean();

      if (stateAdmin?._id) {
        await notifyUsers({
          recipientUserIds: [stateAdmin._id],
          complaintId: complaint._id,
          type: 'complaint-escalated',
          title: 'Major complaint escalation alert',
          message: `Complaint "${complaint.complaintTitle}" requires state-level visibility due to severity or recurrence.`,
          metadata: {
            complaintId: complaint._id,
            trigger: 'major-or-repeated',
          },
        });
      }
    }

    return res.status(201).json({
      ...complaint.toObject(),
      assignedAdmin: {
        id: matchedAdmin._id,
        name: matchedAdmin.name,
        email: matchedAdmin.email,
        village: matchedAdmin.village,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to submit complaint', error: error.message });
  }
};

const getMyComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({
      $or: [{ userId: req.user._id }, { 'reportHistory.reporterId': req.user._id }],
    }).sort({ lastReportedAt: -1, createdAt: -1 });
    return res.json(complaints);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch complaints', error: error.message });
  }
};

const getComplaintById = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('userId', 'name email phone village mandal district state country accountStatus')
      .populate('assignedAdminId', 'name email village mandal district state country');

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    if (!canAccessComplaint(complaint, req.user)) {
      return res.status(403).json({ message: 'Forbidden: cannot access this complaint' });
    }

    await maybeEscalateToHigherLevelAdmin(complaint, 'Auto-escalated during complaint review due to deadline breach');

    const complaintObject = complaint.toObject();
    const normalizedPhone = String(complaintObject.userId?.phone || '').trim();
    if (!complaintObject.reporterSnapshot?.phone && normalizedPhone) {
      // Backfill legacy complaints so admin always sees reporter mobile in future fetches.
      await Complaint.updateOne(
        { _id: complaintObject._id },
        { $set: { 'reporterSnapshot.phone': normalizedPhone } }
      );
      complaintObject.reporterSnapshot = {
        ...(complaintObject.reporterSnapshot || {}),
        phone: normalizedPhone,
      };
    }

    return res.json(complaintObject);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch complaint', error: error.message });
  }
};

const getAllComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find(buildComplaintScopeMatch(req.user))
      .populate('userId', 'name email phone village mandal district state country accountStatus')
      .populate('assignedAdminId', 'name email adminLevel adminTitle village mandal district state country')
      .sort({ lastReportedAt: -1, createdAt: -1 });

    await Promise.all(
      complaints.map((complaint) =>
        maybeEscalateToHigherLevelAdmin(complaint, 'Auto-escalated during queue refresh due to deadline breach')
      )
    );

    const normalizedComplaints = await Promise.all(complaints.map(async (complaint) => {
      const complaintObject = complaint.toObject();
      const normalizedPhone = String(complaintObject.userId?.phone || '').trim();
      if (!complaintObject.reporterSnapshot?.phone && normalizedPhone) {
        // Backfill legacy complaints so admin always sees reporter mobile in future fetches.
        await Complaint.updateOne(
          { _id: complaintObject._id },
          { $set: { 'reporterSnapshot.phone': normalizedPhone } }
        );
        complaintObject.reporterSnapshot = {
          ...(complaintObject.reporterSnapshot || {}),
          phone: normalizedPhone,
        };
      }
      return complaintObject;
    }));

    return res.json(normalizedComplaints);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch all complaints', error: error.message });
  }
};

const updateComplaintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!allowedStatus.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const complaint = await Complaint.findById(id);

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    const complaintLocation = {
      village: complaint.complaintLocation?.village || complaint.village,
      mandal: complaint.complaintLocation?.mandal || complaint.mandal,
      district: complaint.complaintLocation?.district || complaint.district,
      state: complaint.complaintLocation?.state || complaint.state,
      country: complaint.complaintLocation?.country || complaint.country,
    };
    if (!canAdminAccessByScope(req.user, complaintLocation)) {
      return res.status(403).json({ message: 'Forbidden: complaint is outside your admin governance scope' });
    }

    const previousStatus = complaint.status;
    complaint.status = status;

    if (
      (previousStatus === 'Resolved' || previousStatus === 'Closed') &&
      activeStatusSet.has(status)
    ) {
      complaint.recurrenceHistory = Array.isArray(complaint.recurrenceHistory)
        ? complaint.recurrenceHistory
        : [];
      complaint.recurrenceHistory.push({
        reopenedAt: new Date(),
        previousStatus,
        reopenedBy: req.user._id,
        reason: 'Re-opened by admin status update',
        trigger: 'admin-status-change',
      });
      complaint.lastReportedAt = new Date();
      await createReopenNotifications({
        complaint,
        previousStatus,
        trigger: 'admin-status-change',
      });

      await logAdminActivity({
        req,
        adminId: req.user?._id,
        action: 'reopen-complaint-via-status-change',
        severity: 'warning',
        metadata: { complaintId: complaint._id, previousStatus, nextStatus: status },
      });
    } else {
      await logAdminActivity({
        req,
        adminId: req.user?._id,
        action: 'update-complaint-status',
        severity: 'info',
        metadata: { complaintId: complaint._id, previousStatus, nextStatus: status },
      });
    }

    await complaint.save();

    await maybeEscalateToHigherLevelAdmin(complaint, 'Auto-escalated after status update deadline breach');

    const baseMetadata = {
      complaintId: complaint._id,
      previousStatus,
      status,
    };

    if (status === 'In Progress') {
      await notifyUsers({
        recipientUserIds: [complaint.userId],
        complaintId: complaint._id,
        type: 'work-in-progress',
        title: 'Work in progress',
        message: `Work on complaint "${complaint.complaintTitle}" has started.`,
        metadata: baseMetadata,
      });
    }

    if (status === 'Resolved' || status === 'Closed') {
      await notifyUsers({
        recipientUserIds: [complaint.userId],
        complaintId: complaint._id,
        type: 'complaint-completed',
        title: 'Complaint completed',
        message: `Complaint "${complaint.complaintTitle}" was marked as ${status.toLowerCase()}.`,
        metadata: baseMetadata,
      });
    }

    if (complaint.assignedWorker?.workerId) {
      await notifyUsers({
        recipientUserIds: [complaint.assignedWorker.workerId],
        complaintId: complaint._id,
        type: 'task-updated',
        title: 'Task update alert',
        message: `Complaint "${complaint.complaintTitle}" status changed to ${status}.`,
        metadata: baseMetadata,
      });
    }

    return res.json(complaint);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update complaint status', error: error.message });
  }
};

const updateComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    const isOwner = String(complaint.userId) === String(req.user._id);
    const complaintLocation = {
      village: complaint.complaintLocation?.village || complaint.village,
      mandal: complaint.complaintLocation?.mandal || complaint.mandal,
      district: complaint.complaintLocation?.district || complaint.district,
      state: complaint.complaintLocation?.state || complaint.state,
      country: complaint.complaintLocation?.country || complaint.country,
    };
    const isScopedAdmin = req.user.role === 'admin' && canAdminAccessByScope(req.user, complaintLocation);

    if (!isOwner && !isScopedAdmin) {
      return res.status(403).json({ message: 'Forbidden: cannot update this complaint' });
    }

    const nextTitle = String(req.body.complaintTitle || req.body.title || complaint.complaintTitle).trim();
    const nextDescription = String(
      req.body.complaintDescription || req.body.description || complaint.complaintDescription
    ).trim();

    if (nextTitle.length < 5) {
      return res.status(400).json({ message: 'Complaint title must be at least 5 characters long' });
    }

    if (nextDescription.length < 10) {
      return res.status(400).json({ message: 'Complaint description must be at least 10 characters long' });
    }

    complaint.complaintTitle = nextTitle;
    complaint.complaintDescription = nextDescription;
    complaint.complaintText = `${nextTitle}. ${nextDescription}`.trim();

    if (req.body.location && typeof req.body.location === 'object') {
      complaint.complaintLocation = buildComplaintLocation(req.body.location, complaint.complaintLocation || req.user);
    }

    const aiResult = await predictComplaint(complaint.complaintText);
    complaint.category = aiResult.category;
    complaint.priority = aiResult.priority;
    complaint.department = aiResult.department;
    complaint.sentiment = aiResult.sentiment;
    complaint.problemTypeKey = normalizeKey(aiResult.category);
    complaint.locationIssueKey = getStreetOrVillageKey(complaint.complaintLocation, complaint);

    await complaint.save();

    return res.json({
      message: 'Complaint updated successfully',
      complaint,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update complaint', error: error.message });
  }
};

const deleteComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    const isOwner = String(complaint.userId) === String(req.user._id);
    const complaintLocation = {
      village: complaint.complaintLocation?.village || complaint.village,
      mandal: complaint.complaintLocation?.mandal || complaint.mandal,
      district: complaint.complaintLocation?.district || complaint.district,
      state: complaint.complaintLocation?.state || complaint.state,
      country: complaint.complaintLocation?.country || complaint.country,
    };
    const isScopedAdmin = req.user.role === 'admin' && canAdminAccessByScope(req.user, complaintLocation);

    if (!isOwner && !isScopedAdmin) {
      return res.status(403).json({ message: 'Forbidden: cannot delete this complaint' });
    }

    await complaint.deleteOne();
    return res.json({ message: 'Complaint deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete complaint', error: error.message });
  }
};

const attachComplaintImage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required' });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    const isOwner = String(complaint.userId) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';
    const isAssignedWorker =
      req.user.role === 'worker' &&
      String(complaint.assignedWorker?.workerId || '') === String(req.user._id);

    if (!isOwner && !isAdmin && !isAssignedWorker) {
      return res.status(403).json({ message: 'Forbidden: cannot update this complaint' });
    }

    complaint.images.push({
      fileName: req.file.originalname,
      filePath: `/uploads/${req.file.filename}`,
    });

    await complaint.save();

    return res.json({
      message: 'Image attached successfully',
      image: complaint.images[complaint.images.length - 1],
      complaintId: complaint._id,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to attach complaint image', error: error.message });
  }
};

const getComplaintAnalytics = async (req, res) => {
  try {
    const adminScope = buildComplaintScopeMatch(req.user);

    const total = await Complaint.countDocuments(adminScope);
    const resolved = await Complaint.countDocuments({ ...adminScope, status: 'Resolved' });
    const pending = await Complaint.countDocuments({
      ...adminScope,
      status: { $in: ['Submitted', 'Under Review', 'In Progress'] },
    });

    const byCategory = await Complaint.aggregate([
      { $match: adminScope },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const byStatus = await Complaint.aggregate([
      { $match: adminScope },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const trendByDay = await Complaint.aggregate([
      { $match: adminScope },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      {
        $project: {
          _id: 0,
          label: {
            $concat: [
              { $toString: '$_id.year' },
              '-',
              { $toString: '$_id.month' },
              '-',
              { $toString: '$_id.day' },
            ],
          },
          count: 1,
        },
      },
    ]);

    const bySentiment = await Complaint.aggregate([
      { $match: adminScope },
      { $group: { _id: '$sentiment', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const departmentPerformance = await Complaint.aggregate([
      { $match: adminScope },
      {
        $group: {
          _id: '$department',
          total: { $sum: 1 },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
        },
      },
      {
        $project: {
          department: '$_id',
          total: 1,
          resolved: 1,
          resolutionRate: {
            $cond: [
              { $gt: ['$total', 0] },
              { $multiply: [{ $divide: ['$resolved', '$total'] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { total: -1 } },
    ]);

    const avgResolutionTime = await Complaint.aggregate([
      { $match: { ...adminScope, status: 'Resolved' } },
      {
        $project: {
          department: 1,
          resolutionHours: {
            $divide: [{ $subtract: ['$updatedAt', '$createdAt'] }, 3600000],
          },
        },
      },
      {
        $group: {
          _id: '$department',
          avgHours: { $avg: '$resolutionHours' },
        },
      },
      { $sort: { avgHours: 1 } },
    ]);

    return res.json({
      total,
      resolved,
      pending,
      byCategory,
      byStatus,
      trendByDay,
      bySentiment,
      departmentPerformance,
      avgResolutionTime,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load analytics', error: error.message });
  }
};

const getChatbotResponse = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const userId = req.user._id;
    const lowerMsg = message.toLowerCase().trim();

    if (lowerMsg.match(/^(hi|hello|hey|howdy)\b/)) {
      return res.json({
        reply: `Hello ${req.user.name}! I can help you check your complaint status, view pending or resolved complaints, or guide you on submitting a new one. What would you like to know?`,
      });
    }

    if (lowerMsg.includes('status') || lowerMsg.includes('latest') || lowerMsg.includes('update') || lowerMsg.includes('my complaint')) {
      const complaints = await Complaint.find({ userId }).sort({ createdAt: -1 }).limit(3);
      if (complaints.length === 0) {
        return res.json({ reply: "You haven't submitted any complaints yet. Go to 'Submit Complaint' in the sidebar to raise a new one." });
      }
      const latest = complaints[0];
      const reply =
        complaints.length === 1
          ? `Your complaint is currently: "${latest.status}". Category: ${latest.category}, Priority: ${latest.priority}.`
          : `Your latest complaint (${latest.category}) is currently: "${latest.status}". You have ${complaints.length} recent complaints.`;
      return res.json({ reply });
    }

    if (lowerMsg.includes('pending') || lowerMsg.includes('open') || lowerMsg.includes('not resolved')) {
      const count = await Complaint.countDocuments({
        userId,
        status: { $in: ['Submitted', 'Under Review', 'In Progress'] },
      });
      return res.json({ reply: `You have ${count} pending complaint(s) currently being processed.` });
    }

    if (lowerMsg.includes('resolved') || lowerMsg.includes('closed') || lowerMsg.includes('done') || lowerMsg.includes('fixed')) {
      const count = await Complaint.countDocuments({ userId, status: { $in: ['Resolved', 'Closed'] } });
      return res.json({ reply: `You have ${count} resolved or closed complaint(s).` });
    }

    if (lowerMsg.includes('how') && lowerMsg.includes('submit')) {
      return res.json({
        reply: "To submit a complaint, click on 'Submit Complaint' in the sidebar. Describe your issue in detail — our AI will automatically categorize it, set the priority, and assign it to the correct department!",
      });
    }

    if (lowerMsg.includes('category') || lowerMsg.includes('department') || lowerMsg.includes('priority')) {
      const complaints = await Complaint.find({ userId }).sort({ createdAt: -1 }).limit(1);
      if (complaints.length > 0) {
        const c = complaints[0];
        return res.json({
          reply: `Your latest complaint is categorized as: ${c.category}, priority: ${c.priority}, assigned to: ${c.department}.`,
        });
      }
      return res.json({ reply: 'You have no complaints yet. Submit one and AI will automatically categorize and assign it!' });
    }

    if (lowerMsg.includes('image') || lowerMsg.includes('photo') || lowerMsg.includes('picture')) {
      return res.json({
        reply: "You can upload an image with your complaint from the 'My Complaints' page. Our AI will analyze the image and detect the type of issue automatically!",
      });
    }

    if (lowerMsg.includes('total') || lowerMsg.includes('how many') || lowerMsg.includes('count')) {
      const total = await Complaint.countDocuments({ userId });
      return res.json({ reply: `You have submitted ${total} complaint(s) in total.` });
    }

    return res.json({
      reply: "I can help you with: complaint status, pending complaints, resolved complaints, how to submit a complaint, or complaint categories. What would you like to know?",
    });
  } catch (error) {
    return res.status(500).json({ message: 'Chatbot error', error: error.message });
  }
};

const detectImage = async (req, res) => {
  const fs = require('fs');
  const FormData = require('form-data');

  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required' });
    }

    const aiBaseUrl = (process.env.AI_SERVICE_URL || 'http://ai-model:8000/predict').replace(/\/predict$/, '');

    const formData = new FormData();
    formData.append('file', fs.createReadStream(req.file.path), {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    const { data } = await axios.post(`${aiBaseUrl}/analyze-image`, formData, {
      headers: formData.getHeaders(),
      timeout: 15000,
    });

    fs.unlink(req.file.path, () => {});
    return res.json(data);
  } catch (error) {
    if (req.file?.path) {
      require('fs').unlink(req.file.path, () => {});
    }
    return res.status(500).json({ message: 'Image analysis failed', error: error.message });
  }
};

const checkAdminMatch = async (req, res) => {
  try {
    const userLocation = {
      village: String(req.user.village || '').trim(),
      mandal: String(req.user.mandal || '').trim(),
      district: String(req.user.district || '').trim(),
      state: String(req.user.state || '').trim(),
      country: String(req.user.country || '').trim(),
    };
    const locationComplete = isLocationComplete(req.user);
    const matchedAdmin = locationComplete ? await findMatchingAdmin(req.user) : null;

    return res.json({
      userLocation,
      locationComplete,
      matchedAdmin: matchedAdmin
        ? { name: matchedAdmin.name, email: matchedAdmin.email, village: matchedAdmin.village }
        : null,
      message: matchedAdmin
        ? `Your complaints will be routed to admin "${matchedAdmin.name}" (${matchedAdmin.village}).`
        : locationComplete
        ? 'No admin found for your village/area. Ask your admin to register with the same village.'
        : 'Your profile location is incomplete. Please update your profile with village, mandal, district, state and country.',
    });
  } catch (error) {
    return res.status(500).json({ message: 'Check failed', error: error.message });
  }
};

const adminUpdateComplaintStatus = async (req, res) => {
  req.params.id = req.body?.complaintId;
  return updateComplaintStatus(req, res);
};

const adminAssignWorker = async (req, res, next) => {
  req.params.id = req.body?.complaintId;
  return next();
};

// Enhanced Analytics Endpoints
const getEnhancedAnalytics = async (req, res) => {
  try {
    const adminScope = buildComplaintScopeMatch(req.user);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const scopeWith30Days = { ...adminScope, createdAt: { $gte: thirtyDaysAgo } };

    // High-priority complaints tracking
    const highPriority = await Complaint.countDocuments({
      ...adminScope,
      priority: 'High',
      status: { $in: ['Submitted', 'Under Review', 'In Progress'] },
    });

    // Complaints by priority
    const byPriority = await Complaint.aggregate([
      { $match: adminScope },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // SLA Compliance (complaints resolved within 48 hours)
    const slaMet = await Complaint.countDocuments({
      ...adminScope,
      status: 'Resolved',
      createdAt: { $gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    });

    const totalResolved = await Complaint.countDocuments({
      ...adminScope,
      status: 'Resolved',
    });

    const slaComplianceRate = totalResolved > 0 ? Math.round((slaMet / totalResolved) * 100) : 0;

    // Average resolution time
    const avgResolutionStats = await Complaint.aggregate([
      { $match: { ...adminScope, status: 'Resolved' } },
      {
        $project: {
          resolutionHours: {
            $divide: [{ $subtract: ['$updatedAt', '$createdAt'] }, 3600000],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgHours: { $avg: '$resolutionHours' },
          minHours: { $min: '$resolutionHours' },
          maxHours: { $max: '$resolutionHours' },
        },
      },
    ]);

    const avgResolution = avgResolutionStats[0] || { avgHours: 0, minHours: 0, maxHours: 0 };

    // Category trend (last 30 days)
    const categoryTrend = await Complaint.aggregate([
      { $match: scopeWith30Days },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    // Monthly trend
    const monthlyTrend = await Complaint.aggregate([
      { $match: adminScope },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 },
      {
        $project: {
          _id: 0,
          month: {
            $concat: [
              { $toString: '$_id.year' },
              '-',
              { $toString: '$_id.month' },
            ],
          },
          total: '$count',
          resolved: 1,
        },
      },
    ]);

    // Worker performance
    const workerPerformance = await Complaint.aggregate([
      { $match: { ...adminScope, 'assignedWorker.workerId': { $exists: true } } },
      {
        $group: {
          _id: '$assignedWorker.workerId',
          total: { $sum: 1 },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
        },
      },
      {
        $project: {
          workerId: '$_id',
          total: 1,
          resolved: 1,
          inProgress: 1,
          resolutionRate: {
            $cond: [
              { $gt: ['$total', 0] },
              { $multiply: [{ $divide: ['$resolved', '$total'] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { total: -1 } },
    ]);

    return res.json({
      summary: {
        highPriorityCount: highPriority,
        slaComplianceRate,
        avgResolutionHours: Math.round(avgResolution.avgHours * 10) / 10,
        minResolutionHours: Math.round(avgResolution.minHours * 10) / 10,
        maxResolutionHours: Math.round(avgResolution.maxHours * 10) / 10,
      },
      byPriority,
      categoryTrend,
      monthlyTrend,
      workerPerformance,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load enhanced analytics', error: error.message });
  }
};

const getSentimentAnalysis = async (req, res) => {
  try {
    const adminScope = buildComplaintScopeMatch(req.user);

    // Sentiment distribution
    const sentimentDistribution = await Complaint.aggregate([
      { $match: adminScope },
      { $group: { _id: '$sentiment', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Sentiment by priority
    const sentimentByPriority = await Complaint.aggregate([
      { $match: adminScope },
      {
        $group: {
          _id: { sentiment: '$sentiment', priority: '$priority' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.sentiment': 1, count: -1 } },
    ]);

    // Sentiment trend (daily for last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sentimentTrend = await Complaint.aggregate([
      { $match: { ...adminScope, createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            sentiment: '$sentiment',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    // Negative sentiment complaints (requiring immediate attention)
    const negativeSentimentComplaints = await Complaint.find({
      ...adminScope,
      sentiment: { $in: ['Negative', 'Very Negative'] },
      status: { $in: ['Submitted', 'Under Review', 'In Progress'] },
    })
      .select('_id complaintTitle sentiment priority status createdAt')
      .limit(10)
      .sort({ createdAt: -1 });

    return res.json({
      distribution: sentimentDistribution,
      byPriority: sentimentByPriority,
      trend: sentimentTrend,
      negativeComplaints: negativeSentimentComplaints,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load sentiment analysis', error: error.message });
  }
};

const getResponseMetrics = async (req, res) => {
  try {
    const adminScope = buildComplaintScopeMatch(req.user);

    // Response time metrics
    const responseTimeMetrics = await Complaint.aggregate([
      { $match: { ...adminScope, 'assignedWorker.assignedAt': { $exists: true } } },
      {
        $project: {
          department: 1,
          priority: 1,
          responseTimeHours: {
            $divide: [
              { $subtract: ['$assignedWorker.assignedAt', '$createdAt'] },
              3600000,
            ],
          },
        },
      },
      {
        $group: {
          _id: '$priority',
          avgResponseTime: { $avg: '$responseTimeHours' },
          medianResponseTime: { $avg: '$responseTimeHours' },
          maxResponseTime: { $max: '$responseTimeHours' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Complaints awaiting action
    const awaitingAction = await Complaint.countDocuments({
      ...adminScope,
      status: 'Under Review',
    });

    // Reopened complaints
    const reopenedCount = await Complaint.countDocuments({
      ...adminScope,
      'recurrenceHistory.0': { $exists: true },
    });

    // Escalated complaints
    const escalatedCount = await Complaint.countDocuments({
      ...adminScope,
      'escalationHistory.0': { $exists: true },
    });

    return res.json({
      responseTime: responseTimeMetrics,
      awaitingAction,
      reopenedComplaints: reopenedCount,
      escalatedComplaints: escalatedCount,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load response metrics', error: error.message });
  }
};

module.exports = {
  submitComplaint,
  getMyComplaints,
  getComplaintById,
  getAllComplaints,
  updateComplaint,
  updateComplaintStatus,
  deleteComplaint,
  attachComplaintImage,
  getComplaintAnalytics,
  getChatbotResponse,
  detectImage,
  checkAdminMatch,
  adminUpdateComplaintStatus,
  adminAssignWorker,
  getEnhancedAnalytics,
  getSentimentAnalysis,
  getResponseMetrics,
  maybeEscalateToHigherLevelAdmin,
};

