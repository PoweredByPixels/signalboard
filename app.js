const columns = [
  ["inbox", "Inbox"], ["qualified", "Qualifiziert"], ["contacts", "Kontakte"], ["ready", "Bereit zum Anschreiben"], ["waiting", "Waiting"]
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
let filter = "all", query = "", draggingId = null;
const board = document.querySelector("#board"), template = document.querySelector("#cardTemplate"), detailDialog = document.querySelector("#detailDialog");
function save(){ localStorage.setItem("signalboard-jobs", JSON.stringify(jobs)); }
function initials(name){ return (name || "SB").split(" ").map(x=>x[0]).join("").slice(0,2); }
function nextLabel(status){ return ({ inbox:"qualifizieren", qualified:"Kontakte finden", contacts:"Kontakt wählen", ready:"versenden", waiting:"nachfassen" })[status]; }
function render(){
  const visible = jobs.filter(j => (filter === "all" || (filter === "high" ? j.priority === "high" : j.status === "waiting")) && `${j.company} ${j.role}`.toLowerCase().includes(query));
  document.querySelector("#totalCount").textContent = jobs.length;
  board.innerHTML = "";
  columns.forEach(([id, name]) => {
    const col = document.createElement("section"); col.className="column"; col.innerHTML=`<div class="column-head"><h2>${name}</h2><span>${visible.filter(j=>j.status===id).length}</span></div><div class="drop-zone" data-status="${id}"></div>`;
    const zone=col.querySelector(".drop-zone"); const items=visible.filter(j=>j.status===id);
    if(!items.length) zone.innerHTML='<div class="empty">Karte hierher ziehen</div>';
    items.forEach(job=>{
      const card=template.content.firstElementChild.cloneNode(true); card.dataset.id=job.id;
      card.querySelector(".priority").classList.add(job.priority); card.querySelector("h3").textContent=job.company; card.querySelector(".role").textContent=job.role; card.querySelector(".note").textContent=job.note;
      const contact=job.selectedContact || job.contacts?.[0]?.name; card.querySelector(".avatar").textContent=initials(contact); card.querySelector(".next-step").textContent=job.status === "waiting" ? "Follow-up planen" : nextLabel(job.status);
      card.querySelector(".dots").onclick=()=>openDetail(job.id); card.querySelector(".arrow").onclick=()=>move(job.id); card.addEventListener("dragstart",()=>draggingId=job.id); card.addEventListener("dragend",()=>draggingId=null); zone.append(card);
    });
    zone.addEventListener("dragover",e=>{e.preventDefault();zone.classList.add("drag-over")}); zone.addEventListener("dragleave",()=>zone.classList.remove("drag-over")); zone.addEventListener("drop",e=>{e.preventDefault();zone.classList.remove("drag-over"); const job=jobs.find(j=>j.id===draggingId);if(job){job.status=id;save();render()}}); board.append(col);
  });
}
function move(id){ const job=jobs.find(j=>j.id===id), at=columns.findIndex(x=>x[0]===job.status); if(at<columns.length-1){job.status=columns[at+1][0];save();render();} }
function linkedInSearch(contact, company){ return `https://www.google.com/search?q=${encodeURIComponent(`site:linkedin.com/in \"${contact.name}\" \"${company}\"`)}`; }
function openDetail(id){ const job=jobs.find(j=>j.id===id); const candidateList=(job.contacts||[]).map(c=>`<div class="contact"><div><strong>${c.name}</strong><span>${c.title}</span></div><a class="link-btn" target="_blank" rel="noreferrer" href="${linkedInSearch(c,job.company)}">Profil suchen ↗</a></div>`).join(""); const target=job.selectedContact || job.contacts?.[0]?.name || "[Name]";
  document.querySelector("#detailContent").innerHTML=`<p class="eyebrow">${job.status.toUpperCase()} · ${job.priority === "high" ? "HOHE PRIORITÄT" : "PRIORITÄT MITTEL"}</p><h2>${job.company}</h2><p class="detail-role">${job.role}</p><section><h4>WARUM DIESER LEAD</h4><p>${job.note}</p></section><section><h4>RELEVANTE KONTAKTE</h4>${candidateList}<button class="secondary" id="selectContact">${job.selectedContact ? "Kontakt ändern" : "Ersten Kontakt auswählen"}</button></section><section><h4>KONTAKTANFRAGE · ENTWURF</h4><div class="message">Hallo ${target},\n\nich habe gesehen, dass ${job.company} gerade eine:n ${job.role} sucht. Während ihr die Position besetzt, könnte ich euch bei den wichtigsten Themen kurzfristig unterstützen und schnell Struktur in die Umsetzung bringen.\n\nWäre ein kurzer Austausch sinnvoll?</div><button class="copy" id="copyMessage">Text kopieren</button></section>`;
  document.querySelector("#selectContact").onclick=()=>{job.selectedContact=job.contacts?.[0]?.name;save();render();openDetail(id)};
  document.querySelector("#copyMessage").onclick=e=>{navigator.clipboard.writeText(document.querySelector(".message").innerText);e.target.textContent="Kopiert ✓";}; detailDialog.showModal();
}
document.querySelector("#addJob").onclick=()=>document.querySelector("#jobDialog").showModal();
document.querySelector("#saveJob").onclick=e=>{const company=document.querySelector("#companyInput").value.trim(),role=document.querySelector("#roleInput").value.trim();if(!company||!role){e.preventDefault();return;}jobs.unshift({id:Date.now(),company,role,status:"inbox",priority:"medium",note:document.querySelector("#noteInput").value.trim()||"Neu hinzugefügt – Kontakt recherchieren.",contacts:[]});save();render();};
document.querySelector(".detail-close").onclick=()=>detailDialog.close(); document.querySelector("#search").oninput=e=>{query=e.target.value.toLowerCase();render()}; document.querySelectorAll(".filter").forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll(".filter").forEach(x=>x.classList.toggle("active",x===b));render()}); document.querySelector("#focusButton").onclick=()=>document.body.classList.toggle("focus");
render();
