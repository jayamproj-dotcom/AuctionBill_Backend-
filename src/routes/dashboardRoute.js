const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/adminMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const dashboardController = require("../controllers/dashboardController");

// Protect dashboard routes
router.use(authMiddleware);

// Get dashboard summary data
router.get("/summary/:vendorId", roleMiddleware("admin", "vendor"), dashboardController.getDashboardData);

module.exports = router;
