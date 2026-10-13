requireLogin();
wireModeToggle();

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatDate(ts) {
  return new Date(ts.replace(" ", "T") + "Z").toLocaleString();
}

function greetingForHour(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const ICONS = {
  wallet: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2.5" y="5" width="15" height="11" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M2.5 8.5h15" stroke="currentColor" stroke-width="1.5"/><circle cx="14" cy="12" r="1.2" fill="currentColor"/></svg>`,
  layers: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 2.5l7.5 4L10 10.5l-7.5-4L10 2.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M2.5 10.5L10 14.5l7.5-4" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M2.5 14.5L10 18.5l7.5-4" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
  shield: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 2.5l6 2.5v3.8c0 3.8-2.4 6.5-6 7.7-3.6-1.2-6-3.9-6-7.7V5l6-2.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
  eye: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="10" cy="10" r="2.3" stroke="currentColor" stroke-width="1.5"/></svg>`,
};

function statCard({ icon, label, value, sub, tone }) {
  return `
    <div class="stat-card ${tone || ""}">
      <div class="stat-icon">${ICONS[icon]}</div>
      <div class="stat-label">${label}</div>
      <div class="stat-value">${value}</div>
      <div class="stat-sub">${sub}</div>
    </div>`;
}

async function init() {
  const health = await fetchHealth();
  const badge = document.getElementById("mode-badge");
  badge.textContent = health.authzMode.toUpperCase();
  badge.classList.add(health.authzMode);

  if (health.authzMode !== "secure") {
    document.getElementById("warn-banner").innerHTML = `
      <div class="banner warn">
        <strong>Vulnerable build active.</strong> Account ownership is not verified on
        <code>/api/accounts/:id</code> and <code>/api/accounts/:id/transactions</code>.
        Open a transaction page and try changing the account id in the "Explore" box or the URL.
      </div>`;
  }

  let user;
  try {
    user = await apiFetch("/api/me");
    document.getElementById("welcome-text").textContent = `${user.full_name} (@${user.username})`;
    document.getElementById("greeting").textContent =
      `${greetingForHour(new Date().getHours())}, ${user.full_name.split(" ")[0]}`;
  } catch (err) {
    return;
  }

  const accounts = await apiFetch("/api/accounts");
  const grid = document.getElementById("account-grid");

  if (accounts.length === 0) {
    grid.innerHTML = `<div class="empty-state">No accounts yet.</div>`;
  } else {
    grid.innerHTML = accounts
      .map(
        (acc) => `
        <div class="account-card" onclick="window.location.href='transactions.html?id=${acc.id}'">
          <div class="acc-number">${acc.account_number} · account id ${acc.id}</div>
          <div class="acc-balance">${formatCurrency(acc.balance)}</div>
          <div class="acc-type">${acc.account_type}</div>
        </div>`
      )
      .join("");
  }

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  let securityEntries = [];
  try {
    securityEntries = await apiFetch("/api/security-log");
  } catch (err) {
    securityEntries = [];
  }
  const externalAttempts = securityEntries.filter(
    (e) => e.account_owner_id === user.id && e.requester_id !== user.id
  );
  const externalAllowed = externalAttempts.filter((e) => e.allowed).length;
  const externalBlocked = externalAttempts.length - externalAllowed;

  const stats = document.getElementById("stats-grid");
  stats.innerHTML = [
    statCard({
      icon: "wallet",
      label: "Total balance",
      value: formatCurrency(totalBalance),
      sub: `Across ${accounts.length} account${accounts.length === 1 ? "" : "s"}`,
    }),
    statCard({
      icon: "layers",
      label: "Accounts",
      value: accounts.length,
      sub: accounts.map((a) => a.account_number).join(", ") || "None yet",
    }),
    statCard({
      icon: "shield",
      label: "Authorization mode",
      value: health.authzMode.toUpperCase(),
      sub: health.authzMode === "secure" ? "Ownership checks enforced" : "Ownership checks disabled",
      tone: health.authzMode === "secure" ? "ok" : "warn",
    }),
    statCard({
      icon: "eye",
      label: "External access attempts",
      value: externalAttempts.length,
      sub: externalAttempts.length
        ? `${externalAllowed} allowed · ${externalBlocked} blocked`
        : "No attempts on your accounts yet",
      tone: externalAllowed > 0 ? "warn" : externalAttempts.length ? "ok" : "",
    }),
  ].join("");

  const activityBody = document.getElementById("activity-body");
  try {
    const perAccountTxns = await Promise.all(
      accounts.map((acc) =>
        apiFetch(`/api/accounts/${acc.id}/transactions`).then((r) =>
          r.transactions.map((t) => ({ ...t, account_number: acc.account_number }))
        )
      )
    );
    const allTxns = perAccountTxns
      .flat()
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 6);

    if (allTxns.length === 0) {
      activityBody.innerHTML = `<tr><td colspan="4" class="empty-state">No transactions yet.</td></tr>`;
    } else {
      activityBody.innerHTML = allTxns
        .map(
          (t) => `
          <tr>
            <td>${formatDate(t.timestamp)}</td>
            <td>${t.account_number}</td>
            <td>${t.description}</td>
            <td class="amount ${t.type}">${t.type === "debit" ? "-" : "+"}${formatCurrency(t.amount)}</td>
          </tr>`
        )
        .join("");
    }
  } catch (err) {
    activityBody.innerHTML = `<tr><td colspan="4" class="empty-state">Couldn't load recent activity.</td></tr>`;
  }
}

document.getElementById("logout-btn").addEventListener("click", async () => {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch (e) {
    // ignore - logging out client-side regardless
  }
  clearSession();
  window.location.href = "login.html";
});

init();
