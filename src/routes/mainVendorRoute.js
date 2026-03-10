const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/adminMiddleware");
const mainVendorController = require("../controllers/mainVendorController");
const upload = require("../middleware/uploadMiddleware");

// Route to get all main vendors
router.get("/", authMiddleware, mainVendorController.getMainVendors);

// Route to create a main vendor
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

module.exports = router;
