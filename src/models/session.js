const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'userType',
    index: true
  },
  userType: {
    type: String,
    required: true,
    enum: ['Admin', 'MainVendor', 'Vendor']
  },
  token: {
    type: String,
    required: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { 
  timestamps: true 
});

// TTL Index: Automatically remove session documents after 5 minutes of inactivity
// This handles database-level cleanup for stale sessions.
sessionSchema.index({ lastActivity: 1 }, { expireAfterSeconds: 5 * 60 });

module.exports = mongoose.model("Session", sessionSchema);