const AdminActivity = require('../models/AdminActivity');
const Notification = require('../models/Notification');
const User = require('../models/User');

const BURST_WINDOW_MS = 10 * 60 * 1000;
const BURST_THRESHOLD = 5;

const getClientIp = (req) => {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.connection?.remoteAddress || '';
};

const createSecurityAlert = async ({ actorId, action, count }) => {
  const tenMinutesAgo = new Date(Date.now() - BURST_WINDOW_MS);

  const existingAlert = await Notification.findOne({
    type: 'admin-security',
    'metadata.reason': 'sensitive-action-burst',
    'metadata.actorId': String(actorId),
    createdAt: { $gte: tenMinutesAgo },
  }).lean();

  if (existingAlert) {
    return;
  }

  const admins = await User.find({ role: 'admin', accountStatus: 'active' }).select('_id').lean();
  if (!admins.length) {
    return;
  }

  await Notification.insertMany(
    admins.map((admin) => ({
      recipientUserId: admin._id,
      type: 'admin-security',
      title: 'Unusual admin activity detected',
      message: `Admin account ${actorId} executed ${count} sensitive actions in the last 10 minutes. Latest action: ${action}.`,
      metadata: {
        reason: 'sensitive-action-burst',
        actorId: String(actorId),
        count,
        action,
      },
    }))
  );
};

const logAdminActivity = async ({ req, adminId, action, severity = 'info', metadata = {} }) => {
  if (!adminId || !action) return;

  await AdminActivity.create({
    adminUserId: adminId,
    action,
    severity,
    ipAddress: getClientIp(req),
    userAgent: String(req.headers['user-agent'] || ''),
    metadata,
  });

  if (severity === 'critical' || severity === 'warning') {
    const since = new Date(Date.now() - BURST_WINDOW_MS);
    const count = await AdminActivity.countDocuments({
      adminUserId: adminId,
      severity: { $in: ['warning', 'critical'] },
      createdAt: { $gte: since },
    });

    if (count >= BURST_THRESHOLD) {
      await createSecurityAlert({ actorId: adminId, action, count });
    }
  }
};

module.exports = {
  logAdminActivity,
};
