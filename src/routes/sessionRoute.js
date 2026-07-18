const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/adminMiddleware");
const sessionController = require("../controllers/sessionController");

// Protected session routes
router.post("/logout", authMiddleware, sessionController.logout);
router.post("/heartbeat", authMiddleware, sessionController.heartbeat);

module.exports = router;
