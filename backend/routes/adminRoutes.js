const express = require('express');
const {
  getAllComplaints,
  adminUpdateComplaintStatus,
  adminAssignWorker,
} = require('../controllers/complaintController');
const { assignWorkerToComplaint } = require('../controllers/workerController');
const { questionLowerLevelAdmins } = require('../controllers/adminGovernanceController');
const { protect, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect, requireAdmin);

router.get('/allComplaints', getAllComplaints);
router.put('/updateStatus', adminUpdateComplaintStatus);
router.put('/assignWorker', adminAssignWorker, assignWorkerToComplaint);
router.post('/collector/question-lower-admins', questionLowerLevelAdmins);

module.exports = router;