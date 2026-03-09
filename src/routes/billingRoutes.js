const express = require("express");
const router = express.Router();
const billingController = require("../controllers/billingController");
const authMiddleware = require("../middleware/adminMiddleware");

router.get("/export-data", authMiddleware, billingController.getBillingData);

module.exports = router;
