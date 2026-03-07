const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/adminMiddleware");
const vendorController = require("../controllers/vendorController");
const upload = require("../middleware/uploadMiddleware");

// Public routes
router.post("/login", vendorController.login);
router.post("/signup", upload.single("profilePic"), vendorController.signup);
router.post("/forgot-password", vendorController.forgotPassword);
router.post("/reset-password", vendorController.resetPassword);

// Accessible by admin and sub-admin (for now using just authMiddleware)
router.use(authMiddleware);

router.post("/change-password", vendorController.changePassword);
router.post("/export", vendorController.exportVendors);
router.post("/", upload.single("profilePic"), vendorController.createVendor);
router.get("/", vendorController.getVendors);
router.get("/purchases", vendorController.getAllPurchases);
router.get("/:id", vendorController.getVendorById);
router.get("/:id/purchases", vendorController.getVendorPurchasesById);
router.put("/:id", upload.single("profilePic"), vendorController.updateVendor);
router.delete("/:id", vendorController.deleteVendor);

module.exports = router;
