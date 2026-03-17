const express = require('express');
const {
  getWorkers,
  getSpecialties,
  createWorker,
  updateWorker,
  deleteWorker,
  reactivateWorker,
} = require('../controllers/workerController');
const { protect, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// Public: return specialties list (needed during signup, no auth required)
router.get('/specialties', getSpecialties);

router.use(protect, requireAdmin);

router.get('/', getWorkers);
router.post('/', createWorker);
router.patch('/:id', updateWorker);
router.patch('/:id/reactivate', reactivateWorker);
router.delete('/:id', deleteWorker);

module.exports = router;
