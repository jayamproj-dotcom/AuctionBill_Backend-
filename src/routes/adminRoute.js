const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/adminMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const adminController = require('../controllers/adminController');


//Admin Login
router.post("/login", adminController.login);
//Admin Profile Update
router.put("/update-profile", authMiddleware, roleMiddleware("admin"), adminController.updateProfie);
//Admin Password Update
router.put("/update-password", authMiddleware, roleMiddleware("admin"), adminController.updatePassword);
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



router.get('/admin',authMiddleware,roleMiddleware("admin"),adminController.getAdmin);
router.post('/update-password', authMiddleware, adminController.updatePassword);
router.get('/profile', authMiddleware, adminController.getAdmin);
router.put('/profile', authMiddleware, adminController.updateProfie);

module.exports = router;

