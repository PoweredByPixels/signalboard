/* Global auth and cloud state layer. Supabase keys exposed here are publishable anon keys only. */
(function () {
  const authDialog = document.querySelector("#authDialog");
  const accountButton = document.querySelector("#accountButton");
  const linkedinButton = document.querySelector("#linkedinButton");
  const passwordButton = document.querySelector("#passwordButton");
  const logoutButton = document.querySelector("#logoutButton");
  const accountMenu = document.querySelector("#accountMenu");
  const accountIdentity = document.querySelector("#accountIdentity");
  const accountAvatar = document.querySelector("#accountAvatar");
  const passwordDialog = document.querySelector("#passwordDialog");
  const passwordForm = document.querySelector("#passwordForm");
  const authForm = document.querySelector("#authForm");
  const emailInput = document.querySelector("#authEmail");
  const status = document.querySelector("#authStatus");
  const magicButton = document.querySelector("#useMagicLink"), backToPassword = document.querySelector("#backToPassword");
  let client = null, currentUser = null, configured = false, saveTimer = null;
  const authLinkType = new URLSearchParams(window.location.hash.slice(1)).get("type");
  const shouldSetPassword = authLinkType === "magiclink" || authLinkType === "recovery";
  function displayUser() { const t = window.signalboardI18n?.t || (key => key); const initials = (currentUser?.email || "SB").split("@")[0].split(/[._-]/).map(part => part[0]).join("").slice(0, 2).toUpperCase(); accountButton.innerHTML = currentUser ? `<span class="header-avatar">${initials}</span>` : t("login"); accountButton.title = currentUser?.email || t("login"); accountIdentity.textContent = currentUser?.email || t("login"); accountAvatar.textContent = initials; if (!linkedinButton.disabled) linkedinButton.textContent = t("connect"); passwordButton.textContent = t("password"); logoutButton.textContent = t("logout"); linkedinButton.hidden = !currentUser; passwordButton.hidden = !currentUser; logoutButton.hidden = !currentUser; document.body.classList.toggle("auth-required", configured && !currentUser); }
  async function loadConfig() { try { const response = await fetch("/.netlify/functions/app-config", { cache: "no-store" }); return response.ok ? await response.json() : null; } catch { return null; } }
  async function boot() {
    const config = await loadConfig();
    if (!config?.supabaseUrl || !config?.supabaseAnonKey || !window.supabase) { accountButton.hidden = true; return; }
    configured = true; client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    const { data } = await client.auth.getSession(); currentUser = data.session?.user || null; displayUser();
    client.auth.onAuthStateChange((_event, session) => { currentUser = session?.user || null; displayUser(); if (currentUser) { authDialog.close(); refreshLinkedInStatus(); if (shouldSetPassword) { passwordForm.reset(); passwordDialog.showModal(); } } else authDialog.showModal(); window.dispatchEvent(new CustomEvent("signalboard-auth-change", { detail: { user: currentUser } })); });
    if (!currentUser) authDialog.showModal();
    if (currentUser) refreshLinkedInStatus();
  }
  async function refreshLinkedInStatus() {
    const { data } = await client.auth.getSession(); if (!data.session) return;
    try { const response = await fetch("/.netlify/functions/linkedin-status", { headers: { Authorization: `Bearer ${data.session.access_token}` } }); const result = await response.json(); if (result.connected) { linkedinButton.textContent = "✓ LinkedIn verbunden"; linkedinButton.disabled = true; } } catch { /* Connection is optional; keep the button available. */ }
  }
  const ready = boot();
  async function loadState() { await ready; if (!client || !currentUser) return null; let result = await client.from("user_workspaces").select("jobs, searches, ignored_jobs").maybeSingle(); if (result.error && /ignored_jobs/i.test(result.error.message)) result = await client.from("user_workspaces").select("jobs, searches").maybeSingle(); if (result.error) throw result.error; return result.data; }
  function saveState(state) { if (!client || !currentUser) return; clearTimeout(saveTimer); saveTimer = setTimeout(async () => { let result = await client.from("user_workspaces").upsert({ user_id: currentUser.id, jobs: state.jobs, searches: state.searches, ignored_jobs: state.ignoredJobs || [], updated_at: new Date().toISOString() }); if (result.error && /ignored_jobs/i.test(result.error.message)) result = await client.from("user_workspaces").upsert({ user_id: currentUser.id, jobs: state.jobs, searches: state.searches, updated_at: new Date().toISOString() }); if (result.error) console.warn("Signalboard konnte noch nicht synchronisieren:", result.error.message); }, 450); }
  accountButton.onclick = async () => { await ready; if (!currentUser) return authDialog.showModal(); const opening = accountMenu.hidden; accountMenu.hidden = !opening; accountButton.setAttribute("aria-expanded", String(opening)); };
  logoutButton.onclick = async () => { accountMenu.hidden = true; accountButton.setAttribute("aria-expanded", "false"); await client.auth.signOut(); };
  document.addEventListener("click", event => { if (!event.target.closest(".account-wrap")) { accountMenu.hidden = true; accountButton.setAttribute("aria-expanded", "false"); } });
  linkedinButton.onclick = async () => {
    await ready;
    const { data } = await client.auth.getSession();
    if (!data.session) return authDialog.showModal();
    linkedinButton.disabled = true; linkedinButton.textContent = "LinkedIn wird geöffnet …";
    try {
      const response = await fetch("/.netlify/functions/linkedin-start", { headers: { Authorization: `Bearer ${data.session.access_token}` } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "LinkedIn-Verbindung konnte nicht gestartet werden.");
      window.location.assign(payload.url);
    } catch (error) { linkedinButton.disabled = false; linkedinButton.textContent = "in LinkedIn verbinden"; alert(error.message); }
  };
  function magicMode() { authForm.dataset.mode = "magic"; authDialog.classList.add("magic-flow"); document.querySelector("#authPassword").required = false; magicButton.hidden = true; backToPassword.hidden = false; window.signalboardI18n?.apply(); emailInput.focus(); }
  function passwordMode() { delete authForm.dataset.mode; authDialog.classList.remove("magic-flow"); document.querySelector("#authPassword").required = true; magicButton.hidden = false; backToPassword.hidden = true; window.signalboardI18n?.apply(); }
  async function sendMagicLink() { if (!client || !emailInput.value.trim()) { status.textContent = window.signalboardI18n?.locale === "en" ? "Enter your email address first." : "Bitte zuerst deine E-Mail-Adresse eingeben."; return; } status.textContent = "Magic Link wird gesendet …"; const { error } = await client.auth.signInWithOtp({ email: emailInput.value.trim(), options: { emailRedirectTo: window.location.origin } }); status.textContent = error ? error.message : "Geschickt. Öffne den Link in deiner E-Mail und lege danach ein Passwort fest."; }
  authForm.onsubmit = async (event) => { event.preventDefault(); if (authForm.dataset.mode === "magic") return sendMagicLink(); if (!client) return; status.textContent = "Melde an …"; const { error } = await client.auth.signInWithPassword({ email: emailInput.value.trim(), password: document.querySelector("#authPassword").value }); status.textContent = error ? "E-Mail oder Passwort stimmt nicht. Für die Ersteinrichtung bitte den Magic Link nutzen." : "Angemeldet."; };
  magicButton.onclick = () => emailInput.value.trim() ? sendMagicLink() : magicMode(); backToPassword.onclick = passwordMode;
  passwordButton.onclick = () => { document.querySelector("#passwordStatus").textContent = ""; passwordForm.reset(); passwordDialog.showModal(); };
  document.querySelector(".password-close").onclick = () => passwordDialog.close();
  passwordForm.onsubmit = async (event) => { event.preventDefault(); const password = document.querySelector("#newPassword").value, confirm = document.querySelector("#confirmPassword").value, passwordStatus = document.querySelector("#passwordStatus"); if (password !== confirm) { passwordStatus.textContent = "Die Passwörter stimmen nicht überein."; return; } passwordStatus.textContent = "Speichere …"; const { error } = await client.auth.updateUser({ password }); if (error) { passwordStatus.textContent = error.message; return; } passwordStatus.textContent = "Passwort gespeichert ✓"; history.replaceState(null, "", `${location.pathname}${location.search}`); setTimeout(() => passwordDialog.close(), 700); };
  window.signalboardAuth = { get configured() { return configured; }, ready, loadState, saveState, get user() { return currentUser; } };
  window.addEventListener("signalboard-language-changed", displayUser);
})();
