const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/adminMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const buyerController = require("../controllers/buyerController");

// All buyer routes require authentication
router.use(authMiddleware);

// ── Buyer CRUD ────────────────────────────────────────────────────────

// Get all buyers for a vendor
router.get("/list/:vendorId", roleMiddleware("admin", "vendor"), buyerController.getBuyers);

// Get comprehensive summary for a single buyer
router.get("/summary/:buyerId", roleMiddleware("admin", "vendor"), buyerController.getBuyerSummary);

// Get a single buyer
router.get("/:buyerId", roleMiddleware("admin", "vendor"), buyerController.getBuyerById);

// Add a new buyer
router.post("/add", roleMiddleware("admin", "vendor"), buyerController.addBuyer);

// Update buyer details (name, contact, email, state, city, address, status, password)
router.put("/update/:id", roleMiddleware("admin", "vendor"), buyerController.updateBuyer);

// Delete a buyer (cascades to their payments)
router.delete("/delete/:id", roleMiddleware("admin", "vendor"), buyerController.deleteBuyer);

// Toggle buyer login status
router.patch("/status/:id", roleMiddleware("admin", "vendor"), buyerController.toggleBuyerStatus);

// ── Buyer Payments ────────────────────────────────────────────────────

// Record a payment received from a buyer
router.post("/payments/add", roleMiddleware("admin", "vendor"), buyerController.addBuyerPayment);

// Get all payments for a vendor (optionally filtered by ?buyerId=...)
router.get("/payments/list/:vendorId", roleMiddleware("admin", "vendor"), buyerController.getBuyerPayments);

module.exports = router;
