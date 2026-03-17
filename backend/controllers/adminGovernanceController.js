const User = require('../models/User');
const { logAdminActivity } = require('../utils/adminSecurityLogger');
const { notifyUsers } = require('../utils/notificationService');

const questionLowerLevelAdmins = async (req, res) => {
  try {
    if (req.user.adminLevel !== 'district') {
      return res.status(403).json({
        message: 'Only district-level collectors can initiate cross-level governance questions.',
      });
    }

    const { subject, message, mandal, village } = req.body || {};
    if (!subject || !message) {
      return res.status(400).json({ message: 'subject and message are required' });
    }

    const targetQuery = {
      role: 'admin',
      accountStatus: 'active',
      adminLevel: { $in: ['mandal', 'village'] },
      district: { $regex: new RegExp(`^${String(req.user.district).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      state: { $regex: new RegExp(`^${String(req.user.state).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      country: { $regex: new RegExp(`^${String(req.user.country).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    };

    if (mandal) {
      targetQuery.mandal = { $regex: new RegExp(`^${String(mandal).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
    }
    if (village) {
      targetQuery.village = { $regex: new RegExp(`^${String(village).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
    }

    const targets = await User.find(targetQuery).select('_id adminLevel village mandal').lean();
    if (!targets.length) {
      return res.status(404).json({ message: 'No matching village/mandal admins found for this district scope.' });
    }

    await notifyUsers({
      recipientUserIds: targets.map((target) => target._id),
      type: 'system',
      title: `Collector Query: ${String(subject).trim()}`,
      message: String(message).trim(),
      metadata: {
        sourceAdminId: req.user._id,
        sourceAdminLevel: req.user.adminLevel,
        districtCoordination: true,
      },
    });

    await logAdminActivity({
      req,
      adminId: req.user._id,
      action: 'district-collector-question-lower-admins',
      severity: 'warning',
      metadata: {
        subject: String(subject).trim(),
        targetCount: targets.length,
        mandal: String(mandal || '').trim(),
        village: String(village || '').trim(),
      },
    });

    return res.json({
      message: `Question sent to ${targets.length} lower-level admin(s).`,
      targets: targets.map((item) => ({ id: item._id, adminLevel: item.adminLevel, village: item.village, mandal: item.mandal })),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to send governance question', error: error.message });
  }
};

module.exports = {
  questionLowerLevelAdmins,
};
