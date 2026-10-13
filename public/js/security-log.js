requireLogin();
wireModeToggle();

let loadedEntries = [];

function formatDate(ts) {
  return new Date(ts.replace(" ", "T") + "Z").toLocaleString();
}

async function init() {
  const health = await fetchHealth();
  const badge = document.getElementById("mode-badge");
  badge.textContent = health.authzMode.toUpperCase();
  badge.classList.add(health.authzMode);

  let me;
  try {
    me = await apiFetch("/api/me");
    document.getElementById("welcome-text").textContent = `${me.full_name} (@${me.username})`;
  } catch (err) {
    return;
  }

  const entries = await apiFetch("/api/security-log");
  loadedEntries = entries;
  const body = document.getElementById("log-body");

  if (entries.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="empty-state">No access attempts recorded yet. Try the IDOR test on a transactions page first.</td></tr>`;
    return;
  }

  body.innerHTML = entries
    .map((e) => {
      const isSelf = e.requester_id === me.id;
      const who = isSelf ? `${e.requester_username} (you)` : e.requester_username;
      const resultClass = e.allowed ? "amount credit" : "amount debit";
      const resultText = e.allowed ? "ALLOWED" : "BLOCKED";
      return `
        <tr>
          <td>${formatDate(e.created_at)}</td>
          <td>${who}</td>
          <td>${e.account_id ?? "?"}</td>
          <td>${e.endpoint}</td>
          <td>${e.authz_mode}</td>
          <td class="${resultClass}">${resultText}</td>
        </tr>`;
    })
    .join("");
}

document.getElementById("logout-btn").addEventListener("click", async () => {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch (e) {}
  clearSession();
  window.location.href = "login.html";
});

document.getElementById("export-btn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(loadedEntries, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `security-log-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

init();
