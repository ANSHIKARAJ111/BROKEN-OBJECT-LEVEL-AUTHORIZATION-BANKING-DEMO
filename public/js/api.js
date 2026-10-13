const TOKEN_KEY = "idor_demo_token";
const USER_KEY = "idor_demo_user";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch (e) {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function requireLogin() {
  if (!getToken()) {
    window.location.href = "login.html";
  }
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = Object.assign(
    { "Content-Type": "application/json" },
    options.headers || {}
  );
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(path, { ...options, headers });

  if (res.status === 401) {
    clearSession();
    window.location.href = "login.html";
    throw new Error("Unauthorized");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

async function fetchHealth() {
  const res = await fetch("/api/health");
  return res.json();
}

// Like apiFetch, but never throws on non-2xx - it returns the status and
// body as-is so callers (e.g. the request inspector) can show exactly what
// the server sent back, including 403/404 error bodies.
async function rawFetch(path) {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(path, { headers });

  if (res.status === 401) {
    clearSession();
    window.location.href = "login.html";
  }

  const body = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, body };
}

// Wires up the "Switch mode" button that appears next to the mode badge on
// every authenticated page, letting AUTHZ_MODE flip live without a server
// restart. No-ops if the page doesn't have the button.
function wireModeToggle() {
  const btn = document.getElementById("mode-toggle-btn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const badge = document.getElementById("mode-badge");
    const current = (badge.textContent || "").trim().toLowerCase();
    const next = current === "secure" ? "vulnerable" : "secure";

    btn.disabled = true;
    try {
      await apiFetch("/api/admin/authz-mode", {
        method: "POST",
        body: JSON.stringify({ mode: next }),
      });
      window.location.reload();
    } catch (err) {
      alert(err.message);
      btn.disabled = false;
    }
  });
}
