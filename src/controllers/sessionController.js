const Session = require("../models/session");

const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

exports.logout = async (req, res) => {
  try {
    const { sessionId } = req.user;
    if (sessionId) {
      await Session.findOneAndUpdate({ sessionId }, { isActive: false });
    }
    res.status(200).json({ status: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.heartbeat = async (req, res) => {
  try {
    const { sessionId } = req.user;
    if (!sessionId) {
      return res.status(400).json({ status: false, message: "No session ID" });
    }

    const session = await Session.findOneAndUpdate(
      { sessionId, isActive: true },
      { lastActivity: new Date() },
      { returnDocument: "after" },
    );
    if (!session) {
      return res
        .status(401)
        .json({
          status: true,
          message: "Session invalid or expired",
          sessionExpired: true,
        });
    }
    res.status(200).json({ status: true, message: "Heartbeat received" });
  } catch (error) {
    console.error("Heartbeat error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.cleanupExpiredSessions = async (userType) => {
  const cutoff = new Date(Date.now() - SESSION_TIMEOUT_MS);

  await Session.updateMany(
    {
      userType: userType,      // particular user type
      isActive: true,          // only active sessions
      lastActivity: { $lt: cutoff } // last activity older than 5 min
    },
    {
      $set: { isActive: false }
    }
  );
};
