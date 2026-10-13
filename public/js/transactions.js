requireLogin();
wireModeToggle();

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatDate(ts) {
  return new Date(ts.replace(" ", "T") + "Z").toLocaleString();
}

function getIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function showInspector(url, status, body) {
  const inspector = document.getElementById("inspector");
  const statusEl = document.getElementById("inspector-status");

  inspector.hidden = false;
  document.getElementById("inspector-url").textContent = url;
  statusEl.textContent = status;
  statusEl.className = "inspector-status " + (status >= 200 && status < 300 ? "ok" : "fail");
  document.getElementById("inspector-body").textContent = JSON.stringify(body, null, 2);
}

async function loadAccount(accountId) {
  const errorEl = document.getElementById("explore-error");
  errorEl.textContent = "";
  document.getElementById("txn-body").innerHTML = `<tr><td colspan="4" class="empty-state">Loading…</td></tr>`;

  const txnUrl = `/api/accounts/${accountId}/transactions`;
  const txnResult = await rawFetch(txnUrl);
  showInspector(`GET ${txnUrl}`, txnResult.status, txnResult.body);

  if (!txnResult.ok) {
    document.getElementById("account-title").textContent = "Account";
    document.getElementById("account-desc").textContent = "";
    document.getElementById("txn-body").innerHTML = "";
    errorEl.textContent = `${txnResult.status} ${txnResult.body?.error || "Request failed"}`;
    return;
  }

  const accountResult = await rawFetch(`/api/accounts/${accountId}`);
  const account = accountResult.ok ? accountResult.body : null;

  document.getElementById("account-title").textContent = account
    ? `Account ${account.account_number}`
    : `Account ${accountId}`;
  document.getElementById("account-desc").textContent = account
    ? `id ${account.id} · owner_id ${account.owner_id} · balance ${formatCurrency(account.balance)}`
    : "";

  const transactions = txnResult.body.transactions;
  const body = document.getElementById("txn-body");
  if (transactions.length === 0) {
    body.innerHTML = `<tr><td colspan="4" class="empty-state">No transactions.</td></tr>`;
  } else {
    body.innerHTML = transactions
      .map(
        (t) => `
        <tr>
          <td>${formatDate(t.timestamp)}</td>
          <td>${t.description}</td>
          <td>${t.type}</td>
          <td class="amount ${t.type}">${t.type === "debit" ? "-" : "+"}${formatCurrency(t.amount)}</td>
        </tr>`
      )
      .join("");
  }

  const url = new URL(window.location);
  url.searchParams.set("id", accountId);
  window.history.replaceState({}, "", url);
}

async function init() {
  const health = await fetchHealth();
  const badge = document.getElementById("mode-badge");
  badge.textContent = health.authzMode.toUpperCase();
  badge.classList.add(health.authzMode);

  if (health.authzMode !== "secure") {
    document.getElementById("warn-banner").innerHTML = `
      <div class="banner warn">
        <strong>Vulnerable build active.</strong> Try entering a different account id below
        (e.g. another user's) &mdash; the server will return it without checking ownership.
      </div>`;
  }

  try {
    const user = await apiFetch("/api/me");
    document.getElementById("welcome-text").textContent = `${user.full_name} (@${user.username})`;
  } catch (err) {
    return;
  }

  const initialId = getIdFromQuery();
  if (initialId) {
    document.getElementById("explore-id").value = initialId;
    loadAccount(initialId);
  }
}

document.getElementById("explore-btn").addEventListener("click", () => {
  const id = document.getElementById("explore-id").value.trim();
  if (id) loadAccount(id);
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch (e) {}
  clearSession();
  window.location.href = "login.html";
});

init();
