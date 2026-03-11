const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/adminMiddleware");
const mainVendorController = require("../controllers/mainVendorController");
const upload = require("../middleware/uploadMiddleware");

// Route to get all main vendors
router.get("/", authMiddleware, mainVendorController.getMainVendors);

// Auth Routes (Public)
router.post("/signup", mainVendorController.signup);
router.post("/login", mainVendorController.login);
router.post("/forgot-password", mainVendorController.forgotPassword);
router.post("/reset-password", mainVendorController.resetPassword);

// Vendor specific routes
router.get("/profile/:id", mainVendorController.getMainVendorProfile);
router.post(
  "/change-password",
  authMiddleware,
  mainVendorController.changePassword,
);

// Route to create a main vendor (Admin only)
router.post(
  "/",
  authMiddleware,
  upload.single("profilePic"),
  mainVendorController.createMainVendor,
);

// Route to update a main vendor
router.put(
  "/:id",
  authMiddleware,
  upload.single("profilePic"),
  mainVendorController.updateMainVendor,
);

// Route to delete a main vendor
router.delete("/:id", authMiddleware, mainVendorController.deleteMainVendor);

// Route to export main vendors
router.post("/export", authMiddleware, mainVendorController.exportMainVendors);

// Route to get main vendor purchases
router.get(
  "/purchases",
  authMiddleware,
  mainVendorController.getMainVendorPurchases,
);

// Route to get specific main vendor purchases
router.get(
  "/:id/purchases",
  authMiddleware,
  mainVendorController.getMainVendorPurchasesById,
);

// Route to get all branches under a main vendor
router.get("/branches", authMiddleware, mainVendorController.getBranches);

// Route to get all sellers under a main vendor's branches
router.get("/sellers", authMiddleware, mainVendorController.getSellers);

module.exports = router;
