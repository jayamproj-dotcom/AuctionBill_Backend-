const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/adminMiddleware");
const vendorController = require("../controllers/vendorController");
const upload = require("../middleware/uploadMiddleware");

// Public routes
router.post("/login", vendorController.login);

// Protected routes (Admin only)
router.use(authMiddleware);

router.post("/export", vendorController.exportVendors);
router.post("/", upload.single("profilePic"), vendorController.createVendor);
router.get("/", vendorController.getVendors);
router.get("/:id", vendorController.getVendorById);
router.put("/:id", upload.single("profilePic"), vendorController.updateVendor);
router.delete("/:id", vendorController.deleteVendor);

module.exports = router;
