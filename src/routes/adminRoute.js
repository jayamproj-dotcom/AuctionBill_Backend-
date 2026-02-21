const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/adminMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const adminController = require('../controllers/adminController');

router.post('/login', adminController.login);

router.get(
    '/admin',
    authMiddleware,
    roleMiddleware('admin'),
    (req, res) => {
        res.json({ message: 'Welcome Admin' });
    }
);

router.post('/update-password', authMiddleware, adminController.updatePassword);
router.get('/profile', authMiddleware, adminController.getProfile);
router.put('/profile', authMiddleware, adminController.updateProfile);

module.exports = router;

