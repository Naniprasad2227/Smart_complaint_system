const Complaint = require('../models/Complaint');
const { maybeEscalateToHigherLevelAdmin } = require('../controllers/complaintController');

const ACTIVE_STATUSES = ['Submitted', 'Under Review', 'In Progress'];

let intervalId = null;

const runEscalationPass = async () => {
  const overdue = await Complaint.find({
    status: { $in: ACTIVE_STATUSES },
    deadlineAt: { $ne: null, $lte: new Date() },
  })
    .select('_id status deadlineAt assignedAdminId escalationHistory')
    .lean();

  if (!overdue.length) {
    return { scanned: 0, escalated: 0 };
  }

  let escalatedCount = 0;
  for (const item of overdue) {
    const result = await maybeEscalateToHigherLevelAdmin(
      item,
      'Auto-escalated by scheduler due to unresolved deadline breach'
    );
    if (result?.escalated) escalatedCount += 1;
  }

  return { scanned: overdue.length, escalated: escalatedCount };
};

const startEscalationScheduler = () => {
  if (intervalId) return intervalId;

  const rawMinutes = Number(process.env.ESCALATION_SCAN_INTERVAL_MINUTES || 15);
  const minutes = Number.isFinite(rawMinutes) && rawMinutes > 0 ? rawMinutes : 15;
  const intervalMs = minutes * 60 * 1000;

  intervalId = setInterval(async () => {
    try {
      const stats = await runEscalationPass();
      if (stats.escalated > 0) {
        console.log(`[EscalationScheduler] scanned=${stats.scanned} escalated=${stats.escalated}`);
      }
    } catch (error) {
      console.error('[EscalationScheduler] pass failed:', error.message);
    }
  }, intervalMs);

  // Run one pass shortly after startup to reduce stale overdue cases.
  setTimeout(async () => {
    try {
      await runEscalationPass();
    } catch (error) {
      console.error('[EscalationScheduler] startup pass failed:', error.message);
    }
  }, 10 * 1000);

  console.log(`[EscalationScheduler] started (every ${minutes} minute(s))`);
  return intervalId;
};

module.exports = {
  startEscalationScheduler,
  runEscalationPass,
};
