const columns = [
  ["inbox", "Inbox"], ["contacts", "Kontakte"], ["ready", "Bereit zum Anschreiben"], ["waiting", "Waiting"], ["archive", "Archiv"]
];
const starterJobs = [
  { id: 1, company: "Fjord & Co.", role: "Head of Growth", status: "inbox", priority: "high", note: "Neue Wachstumsrolle – wahrscheinlich hoher Zeitdruck.", contacts: [{ name: "Mara Klein", title: "Founder & CEO" }, { name: "Jonas Weber", title: "COO" }] },
  { id: 2, company: "Noveo", role: "Product Marketing Manager", status: "inbox", priority: "medium", note: "B2B SaaS; guter Fit für einen schnellen Go-to-Market-Start.", contacts: [{ name: "Alina Roth", title: "VP Marketing" }] },
  { id: 3, company: "Kite Mobility", role: "Operations Lead", status: "qualified", priority: "high", note: "Skalierung im DACH-Markt. Interim-Setup anbieten.", contacts: [{ name: "Felix Brandt", title: "Co-Founder" }, { name: "Lea Scholz", title: "Head of Operations" }] },
  { id: 4, company: "morrow studio", role: "Senior Project Manager", status: "contacts", priority: "medium", note: "Passende Rolle; Entscheider auswählen und Nachricht schärfen.", contacts: [{ name: "Nina Berg", title: "Managing Director" }, { name: "David Hahn", title: "Creative Director" }] },
  { id: 5, company: "Vela", role: "Growth Strategist", status: "ready", priority: "high", note: "Kontakt und Text sind vorbereitet.", selectedContact: "Sophie Lange", contacts: [{ name: "Sophie Lange", title: "Chief Commercial Officer" }] },
  { id: 6, company: "Lumen AI", role: "Partnerships Manager", status: "waiting", priority: "medium", note: "Anfrage verschickt · Follow-up in 5 Tagen.", selectedContact: "Tobias Kern", contacts: [{ name: "Tobias Kern", title: "Founder" }] }
];
let jobs = JSON.parse(localStorage.getItem("signalboard-jobs") || "null") || starterJobs;
const testCompanies = new Set(["Fjord & Co.", "Noveo", "Kite Mobility", "morrow studio", "Vela", "Lumen AI"]);
jobs = jobs.filter(job => !testCompanies.has(job.company));
jobs.forEach(job => { if (job.status === "qualified") job.status = "contacts"; });
let savedSearches = JSON.parse(localStorage.getItem("signalboard-searches") || "null") || [
  { id: 1, title: "Product Marketing", location: "Berlin · Remote", keywords: "B2B SaaS", active: true },
  { id: 2, title: "Operations & Growth", location: "DACH", keywords: "Scale-up", active: true },
  { id: 3, title: "Projektmanagement", location: "Berlin", keywords: "Agentur, Digital", active: false }
];
let filter = "all", query = "", draggingId = null, editingSearchId = null;
const board = document.querySelector("#board"), template = document.querySelector("#cardTemplate"), detailDialog = document.querySelector("#detailDialog");
function save(){ localStorage.setItem("signalboard-jobs", JSON.stringify(jobs)); localStorage.setItem("signalboard-searches", JSON.stringify(savedSearches)); }
save();
function initials(name){ return (name || "SB").split(" ").map(x=>x[0]).join("").slice(0,2); }
function nextLabel(status){ return ({ inbox:"qualifizieren", qualified:"Kontakte finden", contacts:"Kontakt wählen", ready:"versenden", waiting:"nachfassen" })[status]; }
function render(){
  const visible = jobs.filter(j => (filter === "archive" ? j.status === "archive" : j.status !== "archive") && (filter === "all" || filter === "archive" || (filter === "new" ? j.isNew : filter === "remote" ? /remote/i.test(j.location || "") : j.status === "waiting")) && `${j.company} ${j.role}`.toLowerCase().includes(query));
  document.querySelector("#totalCount").textContent = jobs.length;
  document.querySelector("#activeSearchCount").textContent = savedSearches.filter(search => search.active).length;
  board.innerHTML = "";
  columns.forEach(([id, name]) => {
    const col = document.createElement("section"); col.className="column"; col.innerHTML=`<div class="column-head"><h2>${name}</h2><span>${visible.filter(j=>j.status===id).length}</span>${id === "inbox" ? '<button class="tinder-button" title="Inbox Review">⇄</button>' : ""}<button class="column-menu" data-column="${id}" title="Archive all">•••</button></div><div class="drop-zone" data-status="${id}"></div>`;
    const zone=col.querySelector(".drop-zone"); const items=visible.filter(j=>j.status===id);
    col.querySelector(".column-menu").onclick=()=>{if(confirm(`Alle Karten aus ${name} archivieren?`)){jobs.forEach(job=>{if(job.status===id)job.status="archive"});save();render();}};
    if(id==="inbox") col.querySelector(".tinder-button").onclick=openTinder;
    if(!items.length) zone.innerHTML='<div class="empty">Karte hierher ziehen</div>';
    items.forEach(job=>{
      const card=template.content.firstElementChild.cloneNode(true); card.dataset.id=job.id;
      card.querySelector(".priority").classList.add(job.priority); card.querySelector("h3").textContent=job.role; card.querySelector(".role").textContent=job.company; card.querySelector(".note").textContent=job.note; card.querySelector(".card-icons").textContent=`${job.source ? "🔎" : "✍️"} ${job.isNew ? "🆕" : ""} ${/remote/i.test(job.location || "") ? "🏠" : ""} ${job.industry === "games" ? "🎮" : ""}`;
      const contact=job.selectedContact || job.contacts?.[0]?.name; card.querySelector(".avatar").textContent=initials(contact); card.querySelector(".next-step").textContent=job.status === "waiting" ? "Follow-up planen" : nextLabel(job.status);
      card.onclick=()=>{job.isNew=false;save();openDetail(job.id)}; card.querySelector(".dots").onclick=e=>{e.stopPropagation();document.querySelectorAll(".card-popover").forEach(menu=>menu.remove());const menu=document.createElement("div");menu.className="card-popover";menu.innerHTML='<button data-action="open">Öffnen</button><button data-action="archive">Archivieren</button>';menu.style.left=e.clientX+"px";menu.style.top=e.clientY+"px";menu.querySelector('[data-action="open"]').onclick=()=>{menu.remove();openDetail(job.id)};menu.querySelector('[data-action="archive"]').onclick=()=>{menu.remove();job.status="archive";save();render()};document.body.append(menu);}; card.querySelector(".arrow").onclick=e=>{e.stopPropagation();move(job.id)}; const grab=card.querySelector(".card-grab"); grab.addEventListener("dragstart",()=>draggingId=job.id); grab.addEventListener("dragend",()=>draggingId=null); zone.append(card);
    });
    zone.addEventListener("dragover",e=>{e.preventDefault();zone.classList.add("drag-over")}); zone.addEventListener("dragleave",()=>zone.classList.remove("drag-over")); zone.addEventListener("drop",e=>{e.preventDefault();zone.classList.remove("drag-over"); const job=jobs.find(j=>j.id===draggingId);if(job){job.status=id;save();render()}}); board.append(col);
  });
}
function move(id){ const job=jobs.find(j=>j.id===id), at=columns.findIndex(x=>x[0]===job.status); if(at<columns.length-1){job.status=columns[at+1][0];save();render();} }
function openTinder(){const cards=jobs.filter(job=>job.status==="inbox");let index=0;const dialog=document.querySelector("#tinderDialog"),content=document.querySelector("#tinderContent");const draw=()=>{const job=cards[index];if(!job){content.innerHTML='<h2>Keine Leads zu prüfen.</h2><p class="detail-role">Starte eine Suche und fülle deine Inbox mit neuen Treffern.</p><button class="primary" id="tinderSearch">Jetzt suchen</button>';document.querySelector("#tinderSearch").onclick=()=>{dialog.close();document.querySelector("#searchNow").click()};return;}content.innerHTML=`<p class="eyebrow">INBOX REVIEW · ${index+1}/${cards.length}</p><h2>${job.company}</h2><p class="detail-role">${job.role} · ${job.location||"Standort offen"}</p><section><p>${job.note}</p></section><div class="modal-actions"><button class="secondary" id="tinderNo">← Archiv</button><button class="primary" id="tinderYes">Kontakte →</button></div>`;document.querySelector("#tinderNo").onclick=()=>{job.status="archive";save();render();index++;draw()};document.querySelector("#tinderYes").onclick=()=>{job.status="contacts";job.isNew=false;save();render();index++;draw()}};draw();dialog.showModal();}
function linkedInSearch(contact, company){ return `https://www.google.com/search?q=${encodeURIComponent(`site:linkedin.com/in \"${contact.name}\" \"${company}\"`)}`; }
function openDetail(id){ const job=jobs.find(j=>j.id===id); const role=job.role.toLowerCase(), functional=role.includes("marketing")||role.includes("growth") ? "CMO OR \"Head of Marketing\"" : role.includes("operations") ? "COO OR \"Head of Operations\"" : "Hiring Manager"; const research=[["Geschäftsführung", `site:linkedin.com/in "${job.company}" (CEO OR Founder OR Geschäftsführer)`],["Fachlicher Entscheider", `site:linkedin.com/in "${job.company}" (${functional})`]]; const candidateList=(job.contacts||[]).map((c,index)=>`<div class="contact"><div><strong>${c.name}</strong><span>${c.title}</span></div><div class="contact-actions"><a class="link-btn" target="_blank" rel="noreferrer" href="${c.profileUrl || linkedInSearch(c,job.company)}">Profil ↗</a><button class="choose-contact" data-index="${index}">Auswählen</button></div></div>`).join(""); const researchList=job.status !== "inbox" && job.contacts.length<2 ? `<p class="research-note">Zwei passende Recherchepfade – Google öffnet die Profile. Name und Titel dann hier übernehmen.</p>${research.map(item=>`<div class="contact"><div><strong>${item[0]}</strong><span>${job.company}</span></div><a class="link-btn" target="_blank" rel="noreferrer" href="${googleSearch(item[1])}">Google-Suche ↗</a></div>`).join("")}<form id="contactForm" class="form-grid"><label>Name<input id="contactName" placeholder="Name aus dem Profil"></label><label>Rolle<input id="contactTitle" placeholder="z. B. CEO"></label><button class="secondary">Kontakt hinzufügen</button></form>` : ""; const target=job.selectedContact || job.contacts?.[0]?.name || "[Name]"; const sourceInfo=`<section><h4>JOB & QUELLE</h4><p>${job.location || "Standort offen"} · ${job.source || "Manuell hinzugefügt"}</p>${job.jobLink ? `<a class="link-btn" target="_blank" rel="noreferrer" href="${job.jobLink}">Stellenanzeige öffnen ↗</a>` : ""}${job.publishedAt ? `<p class="research-note">Veröffentlicht: ${new Date(job.publishedAt).toLocaleDateString("de-DE")}</p>` : ""}</section>`;
  document.querySelector("#detailContent").innerHTML=`<p class="eyebrow">${job.status.toUpperCase()} · ${job.priority === "high" ? "HOHE PRIORITÄT" : "PRIORITÄT MITTEL"}</p><h2>${job.company}</h2><p class="detail-role">${job.role}${job.location ? " · " + job.location : ""}</p><section><h4>WARUM DIESER LEAD</h4><p>${job.note}</p></section>${sourceInfo}${job.status === "inbox" ? '<section><button class="primary" id="detailNext">Zu Kontakten →</button></section>' : `<section><h4>KONTAKTE & RECHERCHE</h4><button class="secondary" id="researchContacts">✨ Kontakte recherchieren</button><div id="researchStatus"></div>${candidateList}${researchList}</section>`}${["ready","waiting"].includes(job.status) ? `<section><h4>KONTAKTANFRAGE · ENTWURF</h4><div class="message">Hallo ${target},\n\nich habe gesehen, dass ${job.company} gerade eine:n ${job.role} sucht. Während ihr die Position besetzt, könnte ich euch bei den wichtigsten Themen kurzfristig unterstützen und schnell Struktur in die Umsetzung bringen.\n\nWäre ein kurzer Austausch sinnvoll?</div><button class="copy" id="copyMessage">Text kopieren</button></section>` : ""}`;
  document.querySelectorAll(".choose-contact").forEach(button=>button.onclick=()=>{job.selectedContact=job.contacts[Number(button.dataset.index)].name;save();render();openDetail(id)}); const contactForm=document.querySelector("#contactForm"); if(contactForm) contactForm.onsubmit=event=>{event.preventDefault();const name=document.querySelector("#contactName").value.trim(),title=document.querySelector("#contactTitle").value.trim();if(name){job.contacts.push({name,title:title||"Entscheider"});save();render();openDetail(id);}};
  const detailNext=document.querySelector("#detailNext"); if(detailNext) detailNext.onclick=()=>{job.status="contacts";job.isNew=false;save();render();openDetail(id);};
  const researchButton=document.querySelector("#researchContacts"); if(researchButton) researchButton.onclick=async()=>{const status=document.querySelector("#researchStatus");researchButton.disabled=true;status.textContent="Recherche läuft …";try{const result=await fetch(`/api/contact-research?company=${encodeURIComponent(job.company)}&role=${encodeURIComponent(job.role)}`).then(response=>response.json());if(result.error)throw Error(result.error);job.contacts=result.contacts.map(contact=>({name:contact.name,title:contact.title,profileUrl:contact.url}));save();render();openDetail(id)}catch(error){status.textContent=error.message}finally{researchButton.disabled=false}};
  const copyMessage=document.querySelector("#copyMessage"); if(copyMessage) copyMessage.onclick=e=>{navigator.clipboard.writeText(document.querySelector(".message").innerText);e.target.textContent="Kopiert ✓";}; detailDialog.showModal();
}
document.querySelector("#addJob").onclick=()=>document.querySelector("#jobDialog").showModal();
document.querySelector("#saveJob").onclick=e=>{const company=document.querySelector("#companyInput").value.trim(),role=document.querySelector("#roleInput").value.trim();if(!company||!role){e.preventDefault();return;}jobs.unshift({id:Date.now(),company,role,location:document.querySelector("#locationInput").value.trim(),jobLink:document.querySelector("#linkInput").value.trim(),status:"inbox",priority:"medium",note:document.querySelector("#noteInput").value.trim()||"Neu hinzugefügt – Kontakt recherchieren.",contacts:[]});save();render();};
document.querySelector(".detail-close").onclick=()=>detailDialog.close(); document.querySelector("#search").oninput=e=>{query=e.target.value.toLowerCase();render()}; document.querySelectorAll(".filter").forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll(".filter").forEach(x=>x.classList.toggle("active",x===b));render()}); document.querySelector("#focusButton").onclick=()=>document.body.classList.toggle("focus");
render();

function googleSearch(query) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function showDiscoveredJobs(items, label) {
  const area = document.querySelector("#discoveryResults");
  if (!items.length) { area.innerHTML = '<div class="discovery-empty">Keine Treffer in den angebundenen Quellen. Suchparameter anpassen oder Google Jobs ergänzend nutzen.</div>'; return; }
  area.innerHTML = `<div class="discovery-head"><h3>${items.length} neue Treffer</h3><span class="discovery-status">${label}</span></div>${items.map((job, index) => `<article class="result-row"><div class="result-copy"><strong>${job.company} · ${job.title}</strong><span>${job.location || "Standort offen"} · ${job.source}</span><p>${job.description || ""}</p></div><div class="result-actions"><a target="_blank" rel="noreferrer" href="${job.url}">Job ↗</a><button data-result="${index}">Zur Inbox</button></div></article>`).join("")}`;
  area.querySelectorAll("[data-result]").forEach(button => button.onclick = () => {
    const job = items[Number(button.dataset.result)];
    if (jobs.some(item => item.jobLink === job.url)) { button.textContent = "Schon da"; button.disabled = true; return; }
    jobs.unshift({ id: Date.now() + Number(button.dataset.result), company: job.company, role: job.title, location: job.location, jobLink: job.url, status: "inbox", priority: "medium", note: job.description || `Neu über ${job.source} gefunden.`, contacts: [] });
    save(); render(); button.textContent = "Hinzugefügt ✓"; button.disabled = true;
  });
}

async function runDiscovery(id) {
  const search = savedSearches.find(item => item.id === id), area = document.querySelector("#discoveryResults");
  area.innerHTML = `<div class="discovery-empty">Durchsuche Jobquellen für <strong>${search.title}</strong> …</div>`;
  try {
    const params = new URLSearchParams({ title: search.title, location: search.location, keywords: search.keywords });
    const response = await fetch(`/api/discover-jobs?${params}`).then(result => result.json());
    if (response.error) throw new Error(response.error);
    showDiscoveredJobs(response.jobs, `${search.title} · ${search.location || "alle Standorte"}`);
  } catch (error) { area.innerHTML = `<div class="discovery-empty">${error.message || "Jobquellen sind gerade nicht erreichbar."}</div>`; }
}

function renderSavedSearches() {
  const list = document.querySelector("#savedSearchList");
  list.innerHTML = savedSearches.map(search => `<div class="search-row"><input type="checkbox" data-toggle="${search.id}" ${search.active ? "checked" : ""}><div class="search-copy"><strong>${search.title}</strong><span>${[search.location, search.keywords].filter(Boolean).join(" · ")}</span></div><button class="edit-search" data-edit="${search.id}" title="Bearbeiten">✎</button><button data-run="${search.id}">Suchen ↗</button><button class="delete-search" data-delete="${search.id}">×</button></div>`).join("");
  list.querySelectorAll("[data-toggle]").forEach(input => input.onchange = () => { savedSearches.find(search => search.id === Number(input.dataset.toggle)).active = input.checked; save(); render(); });
  list.querySelectorAll("[data-run]").forEach(button => button.onclick = () => runDiscovery(Number(button.dataset.run)));
  list.querySelectorAll("[data-edit]").forEach(button => button.onclick = () => {
    const search = savedSearches.find(item => item.id === Number(button.dataset.edit));
    editingSearchId = search.id;
    document.querySelector("#searchTitle").value = search.title;
    document.querySelector("#searchLocation").value = search.location || "";
    document.querySelector("#searchKeywords").value = search.keywords || "";
    document.querySelector("#sourceArbeitnow").checked = search.sources?.arbeitnow !== false;
    document.querySelector("#sourceRemotive").checked = search.sources?.remotive !== false;
    document.querySelector("#searchForm button").textContent = "Änderungen speichern";
    document.querySelector("#searchTitle").focus();
  });
  list.querySelectorAll("[data-delete]").forEach(button => button.onclick = () => { savedSearches = savedSearches.filter(search => search.id !== Number(button.dataset.delete)); save(); renderSavedSearches(); render(); });
}

document.querySelector("#openSearches").onclick = () => { renderSavedSearches(); document.querySelector("#searchDialog").showModal(); };
document.querySelector(".search-close").onclick = () => document.querySelector("#searchDialog").close();
document.querySelector("#searchForm").onsubmit = event => {
  event.preventDefault();
  const values = { title: document.querySelector("#searchTitle").value.trim(), location: document.querySelector("#searchLocation").value.trim(), keywords: document.querySelector("#searchKeywords").value.trim(), sources: { arbeitnow: document.querySelector("#sourceArbeitnow").checked, remotive: document.querySelector("#sourceRemotive").checked } };
  if (editingSearchId) Object.assign(savedSearches.find(search => search.id === editingSearchId), values);
  else savedSearches.push({ id: Date.now(), ...values, active: true });
  editingSearchId = null; save(); event.target.reset(); document.querySelector("#searchForm button").textContent = "＋ Suchauftrag anlegen"; renderSavedSearches(); render();
};

document.querySelector("#autofill").onclick = async () => {
  const link = document.querySelector("#linkInput").value.trim(), status = document.querySelector("#autofillStatus");
  if (!link) { status.textContent = "Bitte zuerst einen Job-Link einfügen."; return; }
  status.textContent = "Jobseite wird gelesen …";
  try {
    const result = await fetch(`/api/job-preview?url=${encodeURIComponent(link)}`).then(response => response.json());
    if (result.error) throw new Error(result.error);
    document.querySelector("#companyInput").value = result.company;
    document.querySelector("#roleInput").value = result.title;
    document.querySelector("#locationInput").value = result.location;
    status.textContent = `Daten von ${result.source} übernommen – bitte kurz prüfen.`;
  } catch (error) { status.textContent = error.message || "Auto-Füllung nicht möglich."; }
};
document.querySelectorAll("dialog").forEach(dialog => dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); }));
document.querySelector(".tinder-close").onclick=()=>document.querySelector("#tinderDialog").close();

document.querySelector("#searchNow").onclick = async event => {
  const button = event.currentTarget, active = savedSearches.filter(search => search.active);
  button.disabled = true; button.textContent = "◌ Suche läuft …";
  let imported = 0, sources = new Set();
  for (const search of active) {
    try {
      const params = new URLSearchParams({ title: search.title, location: search.location, keywords: search.keywords, arbeitnow: search.sources?.arbeitnow !== false, remotive: search.sources?.remotive !== false });
      const response = await fetch(`/api/discover-jobs?${params}`).then(result => result.json());
      (response.jobs || []).forEach(job => { if (!jobs.some(card => card.jobLink === job.url)) { jobs.unshift({ id: Date.now() + imported, company: job.company, role: job.title, location: job.location, jobLink: job.url, source: job.source, searchId: search.id, publishedAt: job.publishedAt, status: "inbox", priority: "medium", isNew: true, note: job.description || "Neu gefunden.", contacts: [] }); imported++; sources.add(job.source); } });
    } catch {}
  }
  save(); render(); button.disabled = false; button.textContent = imported ? `✓ ${imported} neu · Jetzt suchen` : "Keine neuen Jobs";
  setTimeout(() => button.textContent = "◌ Jetzt suchen", 3500);
};
