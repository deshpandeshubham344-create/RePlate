const jwt = require("jsonwebtoken");
console.log("SECRET:", process.env.JWT_SECRET);

exports.verifyToken = (req, res, next) => {

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Access denied" });
  }

  const token = authHeader.split(" ")[1];

  try {

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();

  } catch (error) {

    res.status(401).json({ message: "Invalid token" });

  }

};


exports.authorizeRoles = (...roles) => {

  return (req, res, next) => {

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Access forbidden"
      });
    }

    next();

  };

};