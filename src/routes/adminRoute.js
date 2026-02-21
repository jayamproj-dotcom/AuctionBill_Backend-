const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/adminMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const adminController = require("../controllers/adminController");


//Admin Login
router.post("/login", adminController.login);

//Admin Profile Update
router.put("/update-profile", authMiddleware, roleMiddleware("admin"), adminController.updateProfie);

//Admin Password Update
router.put("/update-password", authMiddleware, roleMiddleware("admin"), adminController.updatePassword);

//Admin Verify Password
router.post("/verify-password", authMiddleware, roleMiddleware("admin"), adminController.verifyPassword);


router.get(
    "/admin",
    authMiddleware,
    roleMiddleware("admin"),
    adminController.getAdmin
);

module.exports = router;
