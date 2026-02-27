const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/adminMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const adminController = require('../controllers/adminController');


//Admin Login
router.post("/login", adminController.login);
router.post("/forgot-password", adminController.forgotPassword);
router.post("/reset-password", adminController.resetPassword);

//Admin Profile Update
router.put("/update-profile", authMiddleware, roleMiddleware("admin"), adminController.updateProfie);

//Admin Send Email Update OTP
router.post("/send-email-update-otp", authMiddleware, roleMiddleware("admin"), adminController.sendEmailUpdateOtp);
//Admin Password Update (Legacy)
router.put("/update-password", authMiddleware, roleMiddleware("admin"), adminController.updatePassword);
//Admin Change Password (New with current password verification)
router.post("/change-password", authMiddleware, adminController.changePassword);
//Admin Verify Password
router.post("/verify-password", authMiddleware, roleMiddleware("admin"), adminController.verifyPassword);

//Create Sub Admin
router.post("/create-sub-admin", authMiddleware, roleMiddleware("admin"), adminController.createSubAdmin);
//Get Sub Admin
router.get("/sub-admins", authMiddleware, roleMiddleware("admin"), adminController.getSubAdmins);
//Update Sub Admin
router.put("/update-sub-admin/:id", authMiddleware, roleMiddleware("admin"), adminController.updateSubAdmin);
//Delete Sub Admin
router.delete("/delete-sub-admin/:id", authMiddleware, roleMiddleware("admin"), adminController.deleteSubAdmin);



router.get('/admin', authMiddleware, roleMiddleware("admin"), adminController.getAdmin);
router.post('/update-password', authMiddleware, adminController.updatePassword);
router.get('/profile', authMiddleware, adminController.getAdmin);
router.put('/profile', authMiddleware, adminController.updateProfie);

// Get Profile for both Admin and Sub-Admin
router.get("/profile", authMiddleware, adminController.getAdmin);

module.exports = router;

