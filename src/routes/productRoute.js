const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/adminMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const productController = require("../controllers/productController");

// All product routes require authentication
router.use(authMiddleware);

router.post("/add", roleMiddleware("admin", "vendor", "main-vendor"), productController.addProduct);
router.get("/list", roleMiddleware("admin", "vendor", "main-vendor"), productController.getProducts);
router.put("/update/:id", roleMiddleware("admin", "vendor", "main-vendor"), productController.updateProduct);
router.delete("/delete/:id", roleMiddleware("admin", "vendor", "main-vendor"), productController.deleteProduct);

module.exports = router;
