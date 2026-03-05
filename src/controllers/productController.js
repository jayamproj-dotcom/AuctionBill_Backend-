const Product = require("../models/product");

exports.addProduct = async (req, res) => {
    try {
        const { name, varieties, units, vendorId } = req.body;
        
        if (!name) {
            return res.status(400).json({ message: "Product name is required" });
        }

        const newProduct = new Product({
            name,
            varieties,
            units,
            vendorId
        });

        await newProduct.save();
        res.status(201).json({ message: "Product added successfully", product: newProduct });
    } catch (error) {
        console.error("Add Product Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getProducts = async (req, res) => {
    try {
        const { vendorId } = req.query;
        const query = vendorId ? { vendorId } : {};
        const products = await Product.find(query).sort({ createdAt: -1 });
        res.status(200).json(products);
    } catch (error) {
        console.error("Get Products Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedProduct = await Product.findByIdAndDelete(id);
        
        if (!deletedProduct) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.status(200).json({ message: "Product deleted successfully" });
    } catch (error) {
        console.error("Delete Product Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, varieties, units } = req.body;

        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            { name, varieties, units },
            { new: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.status(200).json({ message: "Product updated successfully", product: updatedProduct });
    } catch (error) {
        console.error("Update Product Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
