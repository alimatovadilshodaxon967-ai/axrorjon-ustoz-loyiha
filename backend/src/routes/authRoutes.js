const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  validateRegister,
  validateLogin,
  validateOtpVerify,
} = require('../middleware/validationMiddleware');

router.post('/register', validateRegister, authController.register);
router.post('/verify-otp', validateOtpVerify, authController.verifyEmailOtp);
router.post('/resend-otp', authController.resendOtp);
router.post('/login', validateLogin, authController.login);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.me);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPasswordWithOtp);

module.exports = router;
