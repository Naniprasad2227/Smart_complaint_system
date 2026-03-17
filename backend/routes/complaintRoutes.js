const express = require('express');
const {
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
  getEnhancedAnalytics,
  getSentimentAnalysis,
  getResponseMetrics,
} = require('../controllers/complaintController');
const { assignWorkerToComplaint, getMyAssignments, updateComplaintProgress } = require('../controllers/workerController');
const { protect, requireAdmin, requireWorker } = require('../middleware/authMiddleware');
const {
  validateSubmitComplaint,
  validateUpdateStatus,
  validateAssignWorker,
} = require('../middleware/validationMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

router.post('/', protect, validateSubmitComplaint, submitComplaint);
router.post('/create', protect, validateSubmitComplaint, submitComplaint);
router.get('/mine', protect, getMyComplaints);
router.get('/admin-check', protect, checkAdminMatch);
router.get('/analytics', protect, requireAdmin, getComplaintAnalytics);
router.get('/analytics/enhanced', protect, requireAdmin, getEnhancedAnalytics);
router.get('/analytics/sentiment', protect, requireAdmin, getSentimentAnalysis);
router.get('/analytics/response-metrics', protect, requireAdmin, getResponseMetrics);
router.get('/my-assignments', protect, requireWorker, getMyAssignments);
router.get('/', protect, requireAdmin, getAllComplaints);
router.post('/chat', protect, getChatbotResponse);
router.post('/detect-image', protect, upload.single('image'), detectImage);
router.get('/:id', protect, getComplaintById);
router.post('/:id/image', protect, upload.single('image'), attachComplaintImage);
router.put('/update/:id', protect, updateComplaint);
router.put('/:id', protect, updateComplaint);
router.patch('/:id/status', protect, requireAdmin, validateUpdateStatus, updateComplaintStatus);
router.patch('/:id/assign-worker', protect, requireAdmin, validateAssignWorker, assignWorkerToComplaint);
router.patch('/:id/progress', protect, requireWorker, updateComplaintProgress);
router.delete('/delete/:id', protect, deleteComplaint);
router.delete('/:id', protect, deleteComplaint);

module.exports = router;
