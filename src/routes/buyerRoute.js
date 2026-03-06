const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/adminMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const buyerController = require("../controllers/buyerController");

// All buyer routes require authentication
router.use(authMiddleware);

// ── Buyers ────────────────────────────────────────────────────────────
router.get("/list/:vendorId", roleMiddleware("admin", "vendor"), buyerController.getBuyers);
router.post("/add", roleMiddleware("admin", "vendor"), buyerController.addBuyer);
router.put("/update/:id", roleMiddleware("admin", "vendor"), buyerController.updateBuyer);
router.delete("/delete/:id", roleMiddleware("admin", "vendor"), buyerController.deleteBuyer);

// ── Payments ──────────────────────────────────────────────────────────
router.get("/payments/list/:vendorId", roleMiddleware("admin", "vendor"), buyerController.getBuyerPayments);
router.post("/payments/add", roleMiddleware("admin", "vendor"), buyerController.addBuyerPayment);

module.exports = router;
