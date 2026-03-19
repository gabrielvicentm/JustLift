const express = require('express');
const router = express.Router();
const authController = require('../controller/authController');
const authGoogleController = require('../controller/authGoogleController');
const {
  authLimiter,
  otpLimiter,
  googleLimiter,
} = require('../middleware/rateLimit');


router.post('/register', authLimiter, authController.register);
router.post('/register/verify', otpLimiter, authController.verifyRegister);
router.post('/register/resend', otpLimiter, authController.resendRegisterCode);
router.post('/login', authLimiter, authController.login);
router.get('/google/config', authGoogleController.getGoogleConfig);
router.post('/google/login', googleLimiter, authGoogleController.googleLogin);
router.post('/google/register', googleLimiter, authGoogleController.googleRegister);
router.post('/refresh', authController.handleRefresh);
router.post('/logout', authController.logout);


module.exports = router;
