const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/adminMiddleware");
const vendorController = require("../controllers/vendorController");

// Accessible by admin and sub-admin (for now using just authMiddleware)
router.use(authMiddleware);

router.post("/", vendorController.createVendor);
router.get("/", vendorController.getVendors);
router.put("/:id", vendorController.updateVendor);
router.delete("/:id", vendorController.deleteVendor);

module.exports = router;
