document.getElementById("signup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("error-msg");
  errorEl.textContent = "";

  const full_name = document.getElementById("full_name").value.trim();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  try {
    const data = await apiFetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ username, password, full_name }),
    });
    setSession(data.token, data.user);
    window.location.href = "dashboard.html";
  } catch (err) {
    errorEl.textContent = err.message;
  }
});
