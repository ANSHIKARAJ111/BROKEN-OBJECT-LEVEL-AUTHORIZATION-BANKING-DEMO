const path = require("path");
const express = require("express");
const config = require("./config");
require("./db/database"); // ensures schema exists before routes load

const authRoutes = require("./routes/auth");
const accountRoutes = require("./routes/accounts");
const adminRoutes = require("./routes/admin");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/api/auth", authRoutes);
app.use("/api", accountRoutes);
app.use("/api/admin", adminRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", authzMode: config.authzMode });
});

app.listen(config.port, () => {
  const banner = config.authzMode === "secure" ? "SECURE" : "VULNERABLE";
  console.log(`IDOR Banking Demo running at http://localhost:${config.port}`);
  console.log(`AUTHZ_MODE = ${config.authzMode.toUpperCase()}  (${banner} build)`);
  if (config.authzMode !== "secure") {
    console.log(
      "WARNING: account ownership checks are DISABLED. This is intentional for the IDOR demo."
    );
  }
});
