const express = require('express');
const { getMyAssignments, updateWorkerStatus } = require('../controllers/workerController');
const { protect, requireWorker } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect, requireWorker);

router.get('/assignedComplaints', getMyAssignments);
router.put('/updateStatus', updateWorkerStatus);

module.exports = router;