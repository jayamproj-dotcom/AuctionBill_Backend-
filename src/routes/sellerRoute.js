const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/adminMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const sellerController = require("../controllers/sellerController");

// All seller routes require authentication
router.use(authMiddleware);

// ── Seller CRUD ──────────────────────────────────────────────────────

// Get all sellers for a vendor
router.get("/list/:vendorId", roleMiddleware("admin", "vendor"), sellerController.getSellers);

// Get a single seller
router.get("/:sellerId", roleMiddleware("admin", "vendor"), sellerController.getSellerById);

// Add a new seller
router.post("/add", roleMiddleware("admin", "vendor"), sellerController.createSeller);

// Update seller details
router.put("/update/:sellerId", roleMiddleware("admin", "vendor"), sellerController.updateSeller);

// Delete a seller
router.delete("/delete/:sellerId", roleMiddleware("admin", "vendor"), sellerController.deleteSeller);

// Toggle seller login status
router.patch("/status/:sellerId", roleMiddleware("admin", "vendor"), sellerController.toggleSellerStatus);

// ── Seller Payments ──────────────────────────────────────────────────

// Record a payment (payout to seller)
router.post("/payment/add", roleMiddleware("admin", "vendor"), sellerController.addSellerPayment);

// Get all payments for a seller
router.get("/payment/list/:sellerId", roleMiddleware("admin", "vendor"), sellerController.getSellerPayments);

module.exports = router;
