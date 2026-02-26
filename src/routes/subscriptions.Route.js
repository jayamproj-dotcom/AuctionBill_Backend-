const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/adminMiddleware");
const subscriptionAccessMiddleware = require("../middleware/subscriptionAccessMiddleware");
const subscriptionController = require("../controllers/subscriptionController");

// Publicly accessible for signup page
router.get("/", subscriptionController.getAllSubscriptions);
router.get("/:id", subscriptionController.getSubscriptionById);

// Apply authMiddleware to administrative routes
router.use(authMiddleware);

router.post("/", subscriptionAccessMiddleware, subscriptionController.createSubscription);
router.put("/:id", subscriptionAccessMiddleware, subscriptionController.updateSubscription);
router.delete("/:id", subscriptionAccessMiddleware, subscriptionController.deleteSubscription);

module.exports = router;
