const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/adminMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const auctionController = require("../controllers/auctionController");

// All auction routes require authentication
router.use(authMiddleware);

// ── Auction Products ──────────────────────────────────────────────────
router.get(
  "/products/list/:vendorId",
  roleMiddleware("admin", "vendor", "main-vendor"),
  auctionController.getAuctionProducts,
);
router.get(
  "/products/pending/:vendorId",
  roleMiddleware("admin", "vendor", "main-vendor"),
  auctionController.getPendingProducts,
);
router.post(
  "/products/add",
  roleMiddleware("admin", "vendor", "main-vendor"),
  auctionController.addAuctionProduct,
);
router.put(
  "/products/update/:id",
  roleMiddleware("admin", "vendor", "main-vendor"),
  auctionController.updateAuctionProduct,
);
router.delete(
  "/products/delete/:id",
  roleMiddleware("admin", "vendor", "main-vendor"),
  auctionController.deleteAuctionProduct,
);
router.patch(
  "/products/status/:id",
  roleMiddleware("admin", "vendor", "main-vendor"),
  auctionController.toggleProductStatus,
);

// ── Transactions ──────────────────────────────────────────────────────
router.get(
  "/transactions/list/:vendorId",
  roleMiddleware("admin", "vendor", "main-vendor"),
  auctionController.getTransactions,
);
router.post(
  "/transactions/add",
  roleMiddleware("admin", "vendor", "main-vendor"),
  auctionController.recordSale,
);
router.get(
  "/history/list/:vendorId",
  roleMiddleware("admin", "vendor", "main-vendor"),
  auctionController.getHistory,
);

module.exports = router;
