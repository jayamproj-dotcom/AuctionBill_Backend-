const mongoose = require("mongoose");
const { generateSequence } = require("../utils/generateId.js");

const planSchema = new mongoose.Schema({
    planId: {
        type: Number,
        unique: true
    },
    slug: {
        type: String,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    durationValue: {
        type: Number,
        default: 1
    },
    durationType: {
        type: String,
        enum: ['month', 'year'],
        default: 'month'
    },
    status: {
        type: String,
        default: 'Active'
    },
    features: [
        {
            type: String
        }
    ],
    description: {
        type: String,
        default: ''
    },
    isPopular: {
        type: Boolean,
        default: false
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    // isDeleted: { type: Boolean, default: false },
    // deletedAt: { type: Date }
}, { timestamps: true });

// Auto increment planId
planSchema.pre("save", async function () {
    if (this.isNew) {
        this.planId = await generateSequence("planId");
    }
});

module.exports = mongoose.model("Plan", planSchema);