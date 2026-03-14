const jwt = require("jsonwebtoken");
const Session = require("../models/session");

module.exports = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token)
    return res.status(401).json({ status: false, message: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Session validation
    if (decoded.sessionId) {
      const session = await Session.findOne({ sessionId: decoded.sessionId });

      if (!session || !session.isActive) {
        return res.status(401).json({
          status: false,
          message: "Session expired or invalidated. Please login again.",
          sessionExpired: true,
        });
      }

      // Check inactivity (5 minutes)
      const now = new Date();
      const lastActive = new Date(session.lastActivity);
      const diffMinutes = (now - lastActive) / (1000 * 60);

      if (diffMinutes > 5) {
        session.isActive = false;
        await session.save();
        return res.status(401).json({
          message: "Session timed out due to inactivity. Please login again.",
          sessionExpired: true,
        });
      }
    }

    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};
