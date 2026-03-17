const AdminActivity = require('../models/AdminActivity');

const severityRank = {
  info: 1,
  warning: 2,
  critical: 3,
};

const getAdminActivities = async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 25)));
    const severity = String(req.query.severity || '').trim();
    const action = String(req.query.action || '').trim();

    const query = {};
    if (severity) {
      query.severity = severity;
    }
    if (action) {
      query.action = { $regex: action, $options: 'i' };
    }

    const items = await AdminActivity.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('adminUserId', 'name email adminLevel district mandal village');

    return res.json(items);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load admin activities', error: error.message });
  }
};

const getSecuritySummary = async (_req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [criticalCount, warningCount, topActions] = await Promise.all([
      AdminActivity.countDocuments({ severity: 'critical', createdAt: { $gte: since } }),
      AdminActivity.countDocuments({ severity: 'warning', createdAt: { $gte: since } }),
      AdminActivity.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$action', count: { $sum: 1 }, maxSeverity: { $max: '$severity' } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
    ]);

    const normalizedTopActions = topActions.map((item) => ({
      action: item._id,
      count: item.count,
      maxSeverity: item.maxSeverity,
      severityScore: severityRank[item.maxSeverity] || 0,
    }));

    return res.json({
      last24Hours: {
        criticalCount,
        warningCount,
      },
      topActions: normalizedTopActions,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load security summary', error: error.message });
  }
};

module.exports = {
  getAdminActivities,
  getSecuritySummary,
};
