const express = require('express');
const router = express.Router();
const authController = require('../controller/authController');
const authGoogleController = require('../controller/authGoogleController');
//const authMiddleware = require('../middleware/authMiddleware');


router.post('/register',  authController.register);
router.post('/register/verify', authController.verifyRegister);
router.post('/register/resend', authController.resendRegisterCode);
router.post('/login', authController.login);
router.get('/google/config', authGoogleController.getGoogleConfig);
router.post('/google/login', authGoogleController.googleLogin);
router.post('/google/register', authGoogleController.googleRegister);
//router.post('/refresh', authController.handleRefresh);


module.exports = router;
