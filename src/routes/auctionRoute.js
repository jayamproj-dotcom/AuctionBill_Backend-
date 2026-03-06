const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/adminMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const auctionController = require("../controllers/auctionController");

// All auction routes require authentication
router.use(authMiddleware);

// ── Auction Products ──────────────────────────────────────────────────
router.get("/products/list/:vendorId", roleMiddleware("admin", "vendor"), auctionController.getAuctionProducts);
router.post("/products/add", roleMiddleware("admin", "vendor"), auctionController.addAuctionProduct);
router.put("/products/update/:id", roleMiddleware("admin", "vendor"), auctionController.updateAuctionProduct);
router.delete("/products/delete/:id", roleMiddleware("admin", "vendor"), auctionController.deleteAuctionProduct);
router.patch("/products/status/:id", roleMiddleware("admin", "vendor"), auctionController.toggleProductStatus);

// ── Buyers ────────────────────────────────────────────────────────────
router.get("/buyers/list/:vendorId", roleMiddleware("admin", "vendor"), auctionController.getBuyers);
router.post("/buyers/add", roleMiddleware("admin", "vendor"), auctionController.addBuyer);
router.put("/buyers/update/:id", roleMiddleware("admin", "vendor"), auctionController.updateBuyer);
router.delete("/buyers/delete/:id", roleMiddleware("admin", "vendor"), auctionController.deleteBuyer);

// ── Transactions ──────────────────────────────────────────────────────
router.get("/transactions/list/:vendorId", roleMiddleware("admin", "vendor"), auctionController.getTransactions);
router.post("/transactions/add", roleMiddleware("admin", "vendor"), auctionController.recordSale);

// ── Payments ──────────────────────────────────────────────────────────
router.get("/payments/list/:vendorId", roleMiddleware("admin", "vendor"), auctionController.getBuyerPayments);
router.post("/payments/add", roleMiddleware("admin", "vendor"), auctionController.addBuyerPayment);

module.exports = router;
