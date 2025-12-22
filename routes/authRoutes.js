const express = require('express');
const { loginLockMiddleware } = require('../middlewares/loginLock');
const { login, logout } = require('../controllers/authController');

const router = express.Router();

router.post('/login', loginLockMiddleware, login);
router.post('/logout', logout);

module.exports = router;
