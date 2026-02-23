const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/adminMiddleware");
const subscriptionAccessMiddleware = require("../middleware/subscriptionAccessMiddleware");
const subscriptionController = require("../controllers/subscriptionController");

// Apply middleware automatically to all routes in this router
router.use(authMiddleware, subscriptionAccessMiddleware);

router.post("/", subscriptionController.createSubscription);
router.get("/", subscriptionController.getAllSubscriptions);
router.get("/:id", subscriptionController.getSubscriptionById);
router.put("/:id", subscriptionController.updateSubscription);
router.delete("/:id", subscriptionController.deleteSubscription);

module.exports = router;
