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
    ]
}, { timestamps: true });

// Auto increment planId
planSchema.pre("save", async function () {
    if (this.isNew) {
        this.planId = await generateSequence("planId");
    }
});

module.exports = mongoose.model("Plan", planSchema);