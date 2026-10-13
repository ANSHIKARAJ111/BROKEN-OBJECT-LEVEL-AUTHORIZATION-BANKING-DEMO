const bcrypt = require("bcryptjs");
const db = require("./database");

const demoUsers = [
  {
    username: "alice",
    password: "AlicePass123!",
    full_name: "Alice Johnson",
    account_number: "ACC-1001",
    balance: 4250.75,
    transactions: [
      { type: "credit", amount: 2500, description: "Salary deposit" },
      { type: "debit", amount: 89.99, description: "Electricity bill" },
      { type: "debit", amount: 120.0, description: "Grocery store" },
      { type: "credit", amount: 1960.74, description: "Freelance payment" },
    ],
  },
  {
    username: "bob",
    password: "BobPass123!",
    full_name: "Bob Martinez",
    account_number: "ACC-1002",
    balance: 980.4,
    transactions: [
      { type: "credit", amount: 1500, description: "Salary deposit" },
      { type: "debit", amount: 350.6, description: "Rent payment" },
      { type: "debit", amount: 169.0, description: "Online shopping" },
    ],
  },
];

function seed() {
  const insertUser = db.prepare(
    "INSERT INTO users (username, password_hash, full_name) VALUES (?, ?, ?)"
  );
  const insertAccount = db.prepare(
    "INSERT INTO accounts (owner_id, account_number, account_type, balance) VALUES (?, ?, 'checking', ?)"
  );
  const insertTxn = db.prepare(
    "INSERT INTO transactions (account_id, type, amount, description) VALUES (?, ?, ?, ?)"
  );

  const existing = db.prepare("SELECT COUNT(*) AS count FROM users").get();
  if (existing.count > 0) {
    console.log("Seed skipped: users already exist in the database.");
    return;
  }

  db.exec("BEGIN");
  try {
    for (const u of demoUsers) {
      const hash = bcrypt.hashSync(u.password, 10);
      const userInfo = insertUser.run(u.username, hash, u.full_name);
      const accountInfo = insertAccount.run(
        userInfo.lastInsertRowid,
        u.account_number,
        u.balance
      );
      for (const t of u.transactions) {
        insertTxn.run(accountInfo.lastInsertRowid, t.type, t.amount, t.description);
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  console.log("Seed complete. Demo accounts:");
  for (const u of demoUsers) {
    console.log(`  username: ${u.username}  password: ${u.password}`);
  }
}

seed();
