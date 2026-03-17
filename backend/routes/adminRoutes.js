const express = require('express');
const {
  getAllComplaints,
  adminUpdateComplaintStatus,
  adminAssignWorker,
} = require('../controllers/complaintController');
const { assignWorkerToComplaint } = require('../controllers/workerController');
const { questionLowerLevelAdmins } = require('../controllers/adminGovernanceController');
const { getAdminActivities, getSecuritySummary } = require('../controllers/adminActivityController');
const { protect, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect, requireAdmin);

router.get('/allComplaints', getAllComplaints);
router.put('/updateStatus', adminUpdateComplaintStatus);
router.put('/assignWorker', adminAssignWorker, assignWorkerToComplaint);
router.post('/collector/question-lower-admins', questionLowerLevelAdmins);
router.get('/activities', getAdminActivities);
router.get('/activities/security-summary', getSecuritySummary);

module.exports = router;