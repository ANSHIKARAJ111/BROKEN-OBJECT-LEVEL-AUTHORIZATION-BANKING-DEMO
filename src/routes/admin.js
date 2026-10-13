const express = require("express");
const config = require("../config");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Lets the running server switch AUTHZ_MODE at runtime, purely in-memory -
// .env is untouched, so a restart falls back to whatever .env says. This
// exists only so the vulnerable/secure comparison can be demoed live
// without stopping and restarting the process each time.
router.post("/authz-mode", requireAuth, (req, res) => {
  const { mode } = req.body || {};
  if (mode !== "vulnerable" && mode !== "secure") {
    return res.status(400).json({ error: "mode must be 'vulnerable' or 'secure'" });
  }

  config.authzMode = mode;
  console.log(`AUTHZ_MODE switched to ${mode.toUpperCase()} via API (in-memory only, .env unchanged)`);
  res.json({ authzMode: config.authzMode });
});

module.exports = router;
