const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db/database");
const config = require("../config");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

function nextAccountNumber() {
  const row = db.prepare("SELECT COUNT(*) AS count FROM accounts").get();
  return `ACC-${1001 + row.count}`;
}

router.post("/signup", (req, res) => {
  const { username, password, full_name } = req.body || {};

  if (!username || !password || !full_name) {
    return res.status(400).json({ error: "username, password and full_name are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) {
    return res.status(409).json({ error: "Username already taken" });
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  let userId;
  db.exec("BEGIN");
  try {
    const userInfo = db
      .prepare("INSERT INTO users (username, password_hash, full_name) VALUES (?, ?, ?)")
      .run(username, passwordHash, full_name);

    userId = userInfo.lastInsertRowid;
    const accountNumber = nextAccountNumber();
    db.prepare(
      "INSERT INTO accounts (owner_id, account_number, account_type, balance) VALUES (?, ?, 'checking', 0)"
    ).run(userId, accountNumber);

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  const user = { id: userId, username };
  const token = signToken(user);

  res.status(201).json({ token, user: { id: userId, username, full_name } });
});

router.post("/login", (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required" });
  }

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  const token = signToken(user);
  res.json({ token, user: { id: user.id, username: user.username, full_name: user.full_name } });
});

// JWTs are stateless, so logout is a client-side action (discard the token).
// This endpoint exists for API-shape completeness per the project spec.
router.post("/logout", requireAuth, (req, res) => {
  res.json({ message: "Logged out" });
});

module.exports = router;
