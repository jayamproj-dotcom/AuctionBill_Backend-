const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/adminMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const commissionController = require("../controllers/commissionController");

// All commission routes require admin/sub-admin authentication
router.use(authMiddleware);

// Get all vendor commissions
router.get("/", roleMiddleware("admin"), commissionController.getAllCommissions);

// Get commission for a specific vendor
router.get("/:vendorId", roleMiddleware("admin", "vendor"), commissionController.getVendorCommission);

// Update or create commission for a vendor
router.put("/:vendorId", roleMiddleware("admin", "vendor"), commissionController.updateVendorCommission);

// Delete commission for a vendor
router.delete("/:vendorId", roleMiddleware("admin"), commissionController.deleteCommission);

module.exports = router;
