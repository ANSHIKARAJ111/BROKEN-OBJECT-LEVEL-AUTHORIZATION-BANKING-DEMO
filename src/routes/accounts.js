const express = require("express");
const db = require("../db/database");
const config = require("../config");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/me", requireAuth, (req, res) => {
  const user = db
    .prepare("SELECT id, username, full_name, created_at FROM users WHERE id = ?")
    .get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json(user);
});

// Always filtered by owner_id from the token, never client input -> not IDOR-prone.
router.get("/accounts", requireAuth, (req, res) => {
  const accounts = db
    .prepare("SELECT id, account_number, account_type, balance, created_at FROM accounts WHERE owner_id = ?")
    .all(req.user.id);

  res.json(accounts);
});

// --- The security-critical endpoint pair ---------------------------------
// GET /api/accounts/:id and GET /api/accounts/:id/transactions both take a
// client-controlled :id. Whether that id's ownership is checked depends on
// config.authzMode:
//
//   "vulnerable" -> any existing account id is returned regardless of who
//                   owns it (the BOLA/IDOR bug: authentication is verified
//                   by requireAuth, but authorization is not).
//   "secure"     -> the account is only returned if owner_id matches the
//                   authenticated user, otherwise 403.
//
// Every call to either endpoint is recorded in access_logs, whether it was
// allowed or blocked, so account owners can see who has requested their
// account (logAccess below).
// ---------------------------------------------------------------------------

function findAccountById(id) {
  return db.prepare("SELECT * FROM accounts WHERE id = ?").get(id);
}

function resolveAccess(accountId, userId) {
  const account = findAccountById(accountId);
  if (!account) {
    return { account: null, exists: false, allowed: false };
  }
  const allowed = config.authzMode === "secure" ? account.owner_id === userId : true;
  return { account, exists: true, allowed };
}

const insertLog = db.prepare(`
  INSERT INTO access_logs (requester_id, requester_username, account_id, account_owner_id, endpoint, allowed, authz_mode)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

function logAccess({ requesterId, requesterUsername, accountId, accountOwnerId, endpoint, allowed }) {
  insertLog.run(
    requesterId,
    requesterUsername,
    accountId,
    accountOwnerId,
    endpoint,
    allowed ? 1 : 0,
    config.authzMode
  );
}

router.get("/accounts/:id", requireAuth, (req, res) => {
  const accountId = req.params.id;
  const { account, exists, allowed } = resolveAccess(accountId, req.user.id);

  logAccess({
    requesterId: req.user.id,
    requesterUsername: req.user.username,
    accountId: exists ? account.id : Number(accountId) || null,
    accountOwnerId: exists ? account.owner_id : null,
    endpoint: "GET /api/accounts/:id",
    allowed,
  });

  if (!exists) {
    return res.status(404).json({ error: "Account not found" });
  }
  if (!allowed) {
    return res.status(403).json({ error: "Forbidden: you do not own this account" });
  }

  res.json({
    id: account.id,
    account_number: account.account_number,
    account_type: account.account_type,
    balance: account.balance,
    owner_id: account.owner_id,
    created_at: account.created_at,
  });
});

router.get("/accounts/:id/transactions", requireAuth, (req, res) => {
  const accountId = req.params.id;
  const { account, exists, allowed } = resolveAccess(accountId, req.user.id);

  logAccess({
    requesterId: req.user.id,
    requesterUsername: req.user.username,
    accountId: exists ? account.id : Number(accountId) || null,
    accountOwnerId: exists ? account.owner_id : null,
    endpoint: "GET /api/accounts/:id/transactions",
    allowed,
  });

  if (!exists) {
    return res.status(404).json({ error: "Account not found" });
  }
  if (!allowed) {
    return res.status(403).json({ error: "Forbidden: you do not own this account" });
  }

  const transactions = db
    .prepare(
      "SELECT id, type, amount, description, timestamp FROM transactions WHERE account_id = ? ORDER BY timestamp DESC"
    )
    .all(account.id);

  res.json({ account_id: account.id, transactions });
});

// Shows access attempts relevant to the caller: attempts they made, and
// attempts anyone made against an account they own. This is what turns a
// silent IDOR into something detectable - the account owner can see if
// someone else's id ever hit their account, and whether it was blocked.
router.get("/security-log", requireAuth, (req, res) => {
  const entries = db
    .prepare(
      `SELECT id, requester_id, requester_username, account_id, account_owner_id, endpoint, allowed, authz_mode, created_at
       FROM access_logs
       WHERE requester_id = ? OR account_owner_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 50`
    )
    .all(req.user.id, req.user.id);

  res.json(entries);
});

module.exports = router;
