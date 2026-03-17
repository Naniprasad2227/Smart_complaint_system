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
const { createRateLimiter } = require('../middleware/rateLimitMiddleware');

const router = express.Router();

const authLimiter = createRateLimiter({
	windowMs: 10 * 60 * 1000,
	maxRequests: 30,
	message: 'Too many authentication requests. Try again in a few minutes.',
});

const otpLimiter = createRateLimiter({
	windowMs: 10 * 60 * 1000,
	maxRequests: 8,
	message: 'Too many OTP requests. Please wait before trying again.',
});

router.post('/signup', authLimiter, signup);
router.post('/login', authLimiter, login);
router.post('/google', googleLogin);
router.post('/forgot-password', authLimiter, requestPasswordReset);
router.post('/reset-password', authLimiter, resetPassword);
router.post('/login/verify-otp', otpLimiter, verifyLoginOtp);
router.post('/login/resend-otp', otpLimiter, resendLoginOtp);
router.post('/refresh', refreshAccessToken);
router.post('/logout', logout);
router.get('/me', protect, getProfile);
router.patch('/me', protect, updateProfile);
router.delete('/me', protect, deleteMyAccount);
router.patch('/admin/users/:userId/deactivate', protect, requireAdmin, deactivateAccountByAdmin);
router.patch('/admin/users/:userId/reactivate', protect, requireAdmin, reactivateAccountByAdmin);
router.post('/admin/assign-admin', protect, requireAdmin, assignAdminByHigherLevel);
router.post('/mobile/request-otp', protect, otpLimiter, requestMobileOtp);
router.post('/mobile/verify-otp', protect, otpLimiter, verifyMobileOtp);

module.exports = router;
