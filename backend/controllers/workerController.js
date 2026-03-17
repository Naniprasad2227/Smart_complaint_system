const Worker = require('../models/Worker');
const { SPECIALTIES } = require('../models/Worker');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { logAdminActivity } = require('../utils/adminSecurityLogger');
const { notifyUsers } = require('../utils/notificationService');
const { buildComplaintScopeMatch, canAdminAccessByScope } = require('../utils/adminHierarchy');

// GET /api/workers — list managed workers + registered User workers from same area
const getWorkers = async (req, res) => {
  try {
    const admin = req.user;
    const includeInactive = String(req.query?.includeInactive || '').toLowerCase() === 'true';

    // Manually managed workers (created by this admin)
    const managedRaw = await Worker.find({
      adminId: admin._id,
      ...(includeInactive ? {} : { isActive: true }),
    }).sort({ createdAt: -1 });
    const managed = managedRaw.map((w) => ({
      _id: w._id,
      name: w.name,
      phone: w.phone || '',
      specialty: w.specialty,
      isAvailable: w.isAvailable,
      isActive: w.isActive !== false,
      type: 'managed',
    }));

    // Registered User-workers from same area (match by village or broader area)
    const areaQuery = {
      role: 'worker',
      ...(includeInactive ? {} : { accountStatus: 'active' }),
      ...buildComplaintScopeMatch(admin),
    };
    const registeredRaw = await User.find(areaQuery).select('name phone specialty createdAt accountStatus').lean();
    const registered = registeredRaw.map((u) => ({
      _id: u._id,
      name: u.name,
      phone: u.phone || '',
      specialty: u.specialty || '',
      isAvailable: u.accountStatus === 'active',
      isActive: u.accountStatus === 'active',
      type: 'registered',
    }));

    return res.json([...managed, ...registered]);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch workers', error: error.message });
  }
};

// GET /api/workers/specialties — list allowed specialties
const getSpecialties = async (_req, res) => {
  return res.json(SPECIALTIES);
};

// POST /api/workers — create a new worker
const createWorker = async (req, res) => {
  try {
    const { name, phone, specialty, isAvailable } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ message: 'Worker name must be at least 2 characters' });
    }

    if (!SPECIALTIES.includes(specialty)) {
      return res.status(400).json({ message: `Invalid specialty. Choose from: ${SPECIALTIES.join(', ')}` });
    }

    const worker = await Worker.create({
      name: name.trim(),
      phone: (phone || '').trim(),
      specialty,
      isAvailable: isAvailable !== false,
      isActive: true,
      adminId: req.user._id,
    });

    return res.status(201).json(worker);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create worker', error: error.message });
  }
};

// PATCH /api/workers/:id — update worker details
const updateWorker = async (req, res) => {
  try {
    const worker = await Worker.findOne({ _id: req.params.id, adminId: req.user._id });
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    const { name, phone, specialty, isAvailable, isActive } = req.body;

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ message: 'Worker name must be at least 2 characters' });
      }
      worker.name = name.trim();
    }

    if (phone !== undefined) worker.phone = String(phone).trim();

    if (specialty !== undefined) {
      if (!SPECIALTIES.includes(specialty)) {
        return res.status(400).json({ message: `Invalid specialty. Choose from: ${SPECIALTIES.join(', ')}` });
      }
      worker.specialty = specialty;
    }

    if (isAvailable !== undefined) worker.isAvailable = Boolean(isAvailable);
    if (isActive !== undefined) {
      worker.isActive = Boolean(isActive);
      if (!worker.isActive) {
        worker.isAvailable = false;
        worker.deactivatedAt = new Date();
      } else {
        worker.deactivatedAt = null;
        worker.deactivationReason = '';
      }
    }

    await worker.save();
    return res.json(worker);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update worker', error: error.message });
  }
};

// DELETE /api/workers/:id — delete worker
const deleteWorker = async (req, res) => {
  try {
    const worker = await Worker.findOne({ _id: req.params.id, adminId: req.user._id });
    if (!worker) {
      await logAdminActivity({
        req,
        adminId: req.user?._id,
        action: 'deactivate-managed-worker-target-not-found',
        severity: 'warning',
        metadata: { workerId: req.params.id },
      });
      return res.status(404).json({ message: 'Worker not found' });
    }

    // Soft-deactivate and unassign from active complaints while retaining worker history.
    worker.isActive = false;
    worker.isAvailable = false;
    worker.deactivatedAt = new Date();
    worker.deactivationReason = String(req.body?.reason || '').trim();
    await worker.save();

    await Complaint.updateMany(
      { 'assignedWorker.workerId': worker._id },
      { $unset: { assignedWorker: '' } }
    );

    await logAdminActivity({
      req,
      adminId: req.user?._id,
      action: 'deactivate-managed-worker',
      severity: 'warning',
      metadata: { workerId: worker._id, reason: worker.deactivationReason },
    });

    return res.json({ message: 'Worker deactivated successfully. Historical data has been retained.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to deactivate worker', error: error.message });
  }
};

const reactivateWorker = async (req, res) => {
  try {
    const { confirm } = req.body || {};
    if (!confirm) {
      await logAdminActivity({
        req,
        adminId: req.user?._id,
        action: 'reactivate-managed-worker-denied-no-confirmation',
        severity: 'warning',
        metadata: { workerId: req.params.id },
      });
      return res.status(400).json({ message: 'Admin confirmation is required to reactivate a worker.' });
    }

    const worker = await Worker.findOne({ _id: req.params.id, adminId: req.user._id });
    if (!worker) {
      await logAdminActivity({
        req,
        adminId: req.user?._id,
        action: 'reactivate-managed-worker-target-not-found',
        severity: 'warning',
        metadata: { workerId: req.params.id },
      });
      return res.status(404).json({ message: 'Worker not found' });
    }

    worker.isActive = true;
    worker.deactivatedAt = null;
    worker.deactivationReason = '';
    await worker.save();

    await logAdminActivity({
      req,
      adminId: req.user?._id,
      action: 'reactivate-managed-worker',
      severity: 'info',
      metadata: { workerId: worker._id },
    });

    return res.json({ message: 'Worker reactivated successfully', worker });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to reactivate worker', error: error.message });
  }
};

// PATCH /api/complaints/:id/assign-worker — assign (or unassign) a worker to a complaint
const assignWorkerToComplaint = async (req, res) => {
  try {
    const { workerId } = req.body;

    const complaint = await Complaint.findById(req.params.id);
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

    // Allow unassigning by passing workerId: null
    if (!workerId) {
      const previousWorkerUserId = complaint.assignedWorker?.workerId || null;
      complaint.assignedWorker = undefined;
      await complaint.save();

      if (previousWorkerUserId) {
        await notifyUsers({
          recipientUserIds: [previousWorkerUserId],
          complaintId: complaint._id,
          type: 'task-updated',
          title: 'Task assignment updated',
          message: `You were unassigned from complaint "${complaint.complaintTitle}".`,
          metadata: {
            complaintId: complaint._id,
            assignment: 'removed',
          },
        });
      }

      return res.json({ message: 'Worker unassigned', complaint });
    }

    // Try registered User worker first, then managed Worker record
    let workerData = null;
    const workerUser = await User.findOne({ _id: workerId, role: 'worker' });
    if (workerUser) {
      if (workerUser.accountStatus !== 'active') {
        return res.status(400).json({ message: 'Cannot assign an inactive worker account' });
      }
      workerData = {
        workerId: workerUser._id,
        name: workerUser.name,
        phone: workerUser.phone || '',
        specialty: workerUser.specialty || '',
      };
    } else {
      const managedWorker = await Worker.findOne({ _id: workerId, adminId: req.user._id });
      if (!managedWorker) {
        return res.status(404).json({ message: 'Worker not found or does not belong to you' });
      }
      if (managedWorker.isActive === false) {
        return res.status(400).json({ message: 'Cannot assign an inactive worker' });
      }
      workerData = {
        workerId: managedWorker._id,
        name: managedWorker.name,
        phone: managedWorker.phone,
        specialty: managedWorker.specialty,
      };
    }

    complaint.assignedWorker = workerData;

    await complaint.save();

    await notifyUsers({
      recipientUserIds: [workerData.workerId],
      complaintId: complaint._id,
      type: 'task-assigned',
      title: 'New task assigned',
      message: `You were assigned to complaint "${complaint.complaintTitle}".`,
      metadata: {
        complaintId: complaint._id,
        assignedByAdminId: req.user._id,
      },
    });

    await notifyUsers({
      recipientUserIds: [complaint.userId],
      complaintId: complaint._id,
      type: 'worker-assigned',
      title: 'Worker assigned',
      message: `A worker has been assigned to your complaint "${complaint.complaintTitle}".`,
      metadata: {
        complaintId: complaint._id,
        workerId: workerData.workerId,
        workerName: workerData.name,
      },
    });

    await notifyUsers({
      recipientUserIds: [req.user._id],
      complaintId: complaint._id,
      type: 'system',
      title: 'Complaint assigned to worker',
      message: `Complaint "${complaint.complaintTitle}" was assigned to ${workerData.name}.`,
      metadata: {
        complaintId: complaint._id,
        workerId: workerData.workerId,
      },
    });

    return res.json({ message: 'Worker assigned successfully', complaint });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to assign worker', error: error.message });
  }
};

// GET /api/complaints/my-assignments — worker sees complaints assigned to them
const getMyAssignments = async (req, res) => {
  try {
    const complaints = await Complaint.find({ 'assignedWorker.workerId': req.user._id })
      .sort({ updatedAt: -1 })
      .populate('userId', 'name email phone village');
    return res.json(complaints);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch assignments', error: error.message });
  }
};

// PATCH /api/complaints/:id/progress — worker updates progress on assigned complaint
const PROGRESS_STATUSES = ['In Progress', 'Resolved'];

const updateComplaintProgress = async (req, res) => {
  try {
    const { status, progressNote } = req.body;

    if (!PROGRESS_STATUSES.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${PROGRESS_STATUSES.join(', ')}` });
    }

    const complaint = await Complaint.findOne({
      _id: req.params.id,
      'assignedWorker.workerId': req.user._id,
    });

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found or not assigned to you' });
    }

    complaint.status = status;
    if (progressNote) {
      complaint.progressNote = String(progressNote).trim().slice(0, 500);
    }
    await complaint.save();

    const assignedAdminId = complaint.assignedAdminId || null;
    const metadata = {
      complaintId: complaint._id,
      workerId: req.user._id,
      status,
    };

    if (status === 'In Progress') {
      await notifyUsers({
        recipientUserIds: [complaint.userId],
        complaintId: complaint._id,
        type: 'work-in-progress',
        title: 'Work in progress',
        message: `A worker started progress on complaint "${complaint.complaintTitle}".`,
        metadata,
      });
    }

    if (status === 'Resolved') {
      await notifyUsers({
        recipientUserIds: [complaint.userId],
        complaintId: complaint._id,
        type: 'complaint-completed',
        title: 'Complaint completed',
        message: `Your complaint "${complaint.complaintTitle}" was marked as resolved by the assigned worker.`,
        metadata,
      });
    }

    if (assignedAdminId) {
      await notifyUsers({
        recipientUserIds: [assignedAdminId],
        complaintId: complaint._id,
        type: 'task-updated',
        title: 'Task update alert',
        message: `Worker updated complaint "${complaint.complaintTitle}" to ${status}.`,
        metadata,
      });
    }

    return res.json({ message: 'Progress updated', complaint });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update progress', error: error.message });
  }
};

const updateWorkerStatus = async (req, res) => {
  req.params.id = req.body?.complaintId;
  return updateComplaintProgress(req, res);
};

module.exports = {
  getWorkers,
  getSpecialties,
  createWorker,
  updateWorker,
  deleteWorker,
  reactivateWorker,
  assignWorkerToComplaint,
  getMyAssignments,
  updateComplaintProgress,
  updateWorkerStatus,
};

