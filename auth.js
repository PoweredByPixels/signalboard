/* Global auth and cloud state layer. Supabase keys exposed here are publishable anon keys only. */
(function () {
  const authDialog = document.querySelector("#authDialog");
  const accountButton = document.querySelector("#accountButton");
  const linkedinButton = document.querySelector("#linkedinButton");
  const authForm = document.querySelector("#authForm");
  const emailInput = document.querySelector("#authEmail");
  const status = document.querySelector("#authStatus");
  let client = null, currentUser = null, configured = false, saveTimer = null;
  function displayUser() { accountButton.textContent = currentUser ? "Abmelden" : "Anmelden"; accountButton.title = currentUser?.email || "Anmelden"; linkedinButton.hidden = !currentUser; document.body.classList.toggle("auth-required", configured && !currentUser); }
  async function loadConfig() { try { const response = await fetch("/.netlify/functions/app-config", { cache: "no-store" }); return response.ok ? await response.json() : null; } catch { return null; } }
  async function boot() {
    const config = await loadConfig();
    if (!config?.supabaseUrl || !config?.supabaseAnonKey || !window.supabase) { accountButton.hidden = true; return; }
    configured = true; client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    const { data } = await client.auth.getSession(); currentUser = data.session?.user || null; displayUser();
    client.auth.onAuthStateChange((_event, session) => { currentUser = session?.user || null; displayUser(); if (currentUser) { authDialog.close(); refreshLinkedInStatus(); } else authDialog.showModal(); window.dispatchEvent(new CustomEvent("signalboard-auth-change", { detail: { user: currentUser } })); });
    if (!currentUser) authDialog.showModal();
    if (currentUser) refreshLinkedInStatus();
  }
  async function refreshLinkedInStatus() {
    const { data } = await client.auth.getSession(); if (!data.session) return;
    try { const response = await fetch("/.netlify/functions/linkedin-status", { headers: { Authorization: `Bearer ${data.session.access_token}` } }); const result = await response.json(); if (result.connected) { linkedinButton.textContent = "✓ LinkedIn verbunden"; linkedinButton.disabled = true; } } catch { /* Connection is optional; keep the button available. */ }
  }
  const ready = boot();
  async function loadState() { await ready; if (!client || !currentUser) return null; const { data, error } = await client.from("user_workspaces").select("jobs, searches").maybeSingle(); if (error) throw error; return data; }
  function saveState(state) { if (!client || !currentUser) return; clearTimeout(saveTimer); saveTimer = setTimeout(async () => { const { error } = await client.from("user_workspaces").upsert({ user_id: currentUser.id, jobs: state.jobs, searches: state.searches, updated_at: new Date().toISOString() }); if (error) console.warn("Signalboard konnte noch nicht synchronisieren:", error.message); }, 450); }
  accountButton.onclick = async () => { await ready; if (!currentUser) return authDialog.showModal(); await client.auth.signOut(); };
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
  authForm.onsubmit = async (event) => { event.preventDefault(); if (!client) return; status.textContent = "Link wird gesendet …"; const { error } = await client.auth.signInWithOtp({ email: emailInput.value.trim(), options: { emailRedirectTo: window.location.origin } }); status.textContent = error ? error.message : "Geschickt. Öffne den Link in deiner E-Mail, um fortzufahren."; };
  window.signalboardAuth = { get configured() { return configured; }, ready, loadState, saveState, get user() { return currentUser; } };
})();
