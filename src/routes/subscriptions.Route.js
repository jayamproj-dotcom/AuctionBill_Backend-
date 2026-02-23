const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/adminMiddleware");
const subscriptionAccessMiddleware = require("../middleware/subscriptionAccessMiddleware");
const subscriptionController = require("../controllers/subscriptionController");

// Apply authMiddleware to all routes for token validation
router.use(authMiddleware);

router.post("/", subscriptionAccessMiddleware, subscriptionController.createSubscription);
router.get("/", subscriptionController.getAllSubscriptions);
router.get("/:id", subscriptionController.getSubscriptionById);
router.put("/:id", subscriptionAccessMiddleware, subscriptionController.updateSubscription);
router.delete("/:id", subscriptionAccessMiddleware, subscriptionController.deleteSubscription);

module.exports = router;
