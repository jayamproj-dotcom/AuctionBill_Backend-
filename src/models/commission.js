const mongoose = require("mongoose");

const commissionSchema = new mongoose.Schema({
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, unique: true },
    value: { type: Number, required: true, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model("Commission", commissionSchema);
