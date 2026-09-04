const express = require('express');
const { login, register, me, changePassword, logout } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// register এখন protected — নতুন অ্যাডমিন অ্যাকাউন্ট শুধু লগইন করা
// অ্যাডমিনই তৈরি করতে পারবে। এতে যে কেউ নিজে অ্যাকাউন্ট বানিয়ে
// প্যানেলে ঢোকার ফাঁক বন্ধ হয়।
router.post('/register', protect, register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', protect, me);
router.put('/change-password', protect, changePassword);

module.exports = router;
