const express = require('express');
const {
	login,
	googleLogin,
	signup,
	refreshAccessToken,
	logout,
	updateProfile,
	getProfile,
	deleteMyAccount,
	deactivateAccountByAdmin,
	reactivateAccountByAdmin,
	assignAdminByHigherLevel,
	requestPasswordReset,
	resetPassword,
	requestMobileOtp,
	verifyMobileOtp,
	resendLoginOtp,
	verifyLoginOtp,
} = require('../controllers/authController');
const { protect, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.post('/login/verify-otp', verifyLoginOtp);
router.post('/login/resend-otp', resendLoginOtp);
router.post('/refresh', refreshAccessToken);
router.post('/logout', logout);
router.get('/me', protect, getProfile);
router.patch('/me', protect, updateProfile);
router.delete('/me', protect, deleteMyAccount);
router.patch('/admin/users/:userId/deactivate', protect, requireAdmin, deactivateAccountByAdmin);
router.patch('/admin/users/:userId/reactivate', protect, requireAdmin, reactivateAccountByAdmin);
router.post('/admin/assign-admin', protect, requireAdmin, assignAdminByHigherLevel);
router.post('/mobile/request-otp', protect, requestMobileOtp);
router.post('/mobile/verify-otp', protect, verifyMobileOtp);

module.exports = router;
