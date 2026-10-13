# Broken Object-Level Authorization (IDOR) Banking Demo

An educational, local-only banking web app demonstrating a BOLA/IDOR
vulnerability on `GET /api/accounts/{id}/transactions`, then fixing it with
a server-side ownership check.

**Stack:** Node.js (v22.5+) + Express + SQLite (built-in `node:sqlite`, no
native compilation needed), JWT auth (`jsonwebtoken`), password hashing
(`bcryptjs`), plain HTML/CSS/JS frontend served statically by the same
server.

**Extra features beyond the base spec:**
- **Live request/response inspector** on the transactions page — every time
  you load an account id it shows the exact `GET` request, HTTP status, and
  JSON response, making the vulnerable endpoint's shape visible in the UI.
- **Security Log page** (`security-log.html`) — every call to
  `GET /api/accounts/:id` and `GET /api/accounts/:id/transactions` is
  recorded in an `access_logs` table with requester, target account, and
  ALLOWED/BLOCKED outcome. Log in as Bob, request Alice's account id, then
  log in as Alice and open her Security Log — you'll see Bob's attempt
  recorded against her account, showing how logging turns a silent IDOR
  into a detectable one. An "Export JSON" button downloads the current log
  as evidence.
- **Live mode toggle** — the "Switch mode" button next to the mode badge
  calls `POST /api/admin/authz-mode` and flips `AUTHZ_MODE` in memory
  immediately, no `.env` edit or server restart required. This only changes
  the running process's state — `.env` is untouched, so the next `npm start`
  reverts to whatever `.env` says.

## Setup

```powershell
npm install
npm run seed     # creates data/bank.sqlite with two demo users
npm start        # http://localhost:4000
```

Demo credentials (created by the seed script):

| Username | Password |
|---|---|
| alice | AlicePass123! |
| bob | BobPass123! |

You can also sign up new users from the app itself — signup automatically
creates a checking account for the new user.

## Switching between vulnerable and secure mode

Authorization behavior is controlled by `AUTHZ_MODE` in `.env`:

```
AUTHZ_MODE=vulnerable   # default: ownership check SKIPPED (the bug)
AUTHZ_MODE=secure       # ownership check ENFORCED (403 on mismatch)
```

Change the value, save `.env`, and restart the server (`npm start`) to
switch modes. The active mode is shown in the server startup log and as a
badge in the app's top bar (red = vulnerable, green = secure).

For quick live demos, you can instead click the **"Switch mode"** button
next to the badge in any page's top bar — it flips `AUTHZ_MODE` instantly
without a restart (see "Live mode toggle" above). Editing `.env` is still
what controls the mode a fresh `npm start` boots into.

## Demonstrating the vulnerability

1. Set `AUTHZ_MODE=vulnerable` (default) and start the server.
2. Log in as `alice` / `AlicePass123!`.
3. Open her account from the dashboard (note its account id, e.g. `1`).
4. On the transactions page, use the **"IDOR / BOLA test"** box to enter a
   *different* account id (e.g. `2`, which belongs to `bob`) and click
   "Load transactions".
5. Observe that Bob's account balance and transaction history load even
   though you are authenticated as Alice — the server only checked that
   *a* valid user was logged in, not that the requested account belongs to
   that user.

Equivalent via `curl`, once you have Alice's token from `localStorage`
(`idor_demo_token`) or from the Network tab after login:

```powershell
$token = "<alice's JWT>"
curl.exe -H "Authorization: Bearer $token" http://localhost:4000/api/accounts/2/transactions
```

This returns Bob's transactions while authenticated as Alice — the IDOR.

## Fixing and re-testing

1. Set `AUTHZ_MODE=secure` in `.env` and restart the server.
2. Repeat the exact same steps (or `curl` request) above.
3. Expected result: `403 Forbidden: you do not own this account` instead of
   Bob's data. The fix lives in [src/routes/accounts.js](src/routes/accounts.js),
   where `findOwnedAccount(id, ownerId)` adds an `owner_id = ?` clause to
   the query instead of trusting the client-supplied id alone.

## Project structure

```
src/
  server.js           Express app entry point
  config.js            env/config, including AUTHZ_MODE toggle
  db/
    database.js        SQLite schema (users, accounts, transactions)
    seed.js             demo data
  middleware/
    auth.js             JWT verification middleware
  routes/
    auth.js             signup, login, logout
    accounts.js          /api/me, /api/accounts, /api/accounts/:id,
                          /api/accounts/:id/transactions (the IDOR endpoint)
public/
  login.html, signup.html, dashboard.html, transactions.html,
  security-log.html, favicon.svg
  css/style.css
  js/api.js, login.js, signup.js, dashboard.js, transactions.js,
  security-log.js
data/
  bank.sqlite           created on first run (gitignored)
```

## Security notes

- This app is intended to run **locally only**, with fictitious seeded
  data. Never point the vulnerable build at real user data.
- Passwords are hashed with bcrypt; never stored in plaintext.
- `GET /api/accounts` (the account list) is always correctly scoped to
  `owner_id = req.user.id` from the JWT — it never trusts a client-supplied
  identifier, so it is not part of the vulnerability surface.
- The vulnerability is isolated to the two endpoints that accept a
  client-controlled `:id`: `GET /api/accounts/:id` and
  `GET /api/accounts/:id/transactions`.
