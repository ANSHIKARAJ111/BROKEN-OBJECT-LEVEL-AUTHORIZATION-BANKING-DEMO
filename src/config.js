require("dotenv").config();

const config = {
  port: process.env.PORT || 4000,
  jwtSecret: process.env.JWT_SECRET || "insecure-default-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
  // "vulnerable" -> account ownership is NOT checked (IDOR/BOLA demo)
  // "secure"     -> account ownership IS checked (403 on mismatch)
  authzMode: (process.env.AUTHZ_MODE || "vulnerable").toLowerCase(),
};

module.exports = config;
