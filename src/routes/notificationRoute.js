const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const verifyToken = require("../middleware/adminMiddleware"); // This file handles token verification
const roleCheck = require("../middleware/roleMiddleware");

// Admin routes
router.get("/admin", verifyToken, notificationController.getNotifications);
router.put("/read/:id", verifyToken, notificationController.markAsRead);

// Vendor route
router.post("/request-upgrade", verifyToken, roleCheck("vendor"), notificationController.createUpgradeRequest);
router.get("/vendor", verifyToken, notificationController.getVendorNotifications);

module.exports = router;
