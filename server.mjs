import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import discoverJobsFunction from "./netlify/functions/discover-jobs.mjs";

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
if (existsSync(join(root, ".env"))) for (const line of readFileSync(join(root, ".env"), "utf8").split(/\r?\n/)) { const [key, ...value] = line.split("="); if (key && !process.env[key]) process.env[key] = value.join("="); }
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml" };

function plain(value = "") { return String(value).replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim(); }
function contactFacts(item){const heading=plain(item.title).replace(/\s*\|\s*linkedin.*$/i,"").trim(),parts=heading.split(/\s+(?:[-–—]|\|)\s+/).map(part=>part.trim()).filter(Boolean);return{name:parts[0]||heading,title:parts.slice(1).find(part=>!/^(linkedin|profile)$/i.test(part))||"",text:`${heading} ${plain(item.description)}`.toLowerCase()};}
function functionalContactTerms(role = "") { const value=role.toLowerCase(); if(/operations|live ops|producer|project/.test(value))return "\"Head of Operations\" OR \"Operations Director\" OR COO";if(/product|monetization/.test(value))return "\"Head of Product\" OR \"Product Director\" OR CPO";if(/publishing/.test(value))return "\"Head of Publishing\" OR \"Publishing Director\"";if(/community|support/.test(value))return "\"Head of Community\" OR \"Player Support Director\"";if(/localization/.test(value))return "\"Head of Localization\" OR \"Localization Director\"";return "\"Head of\" OR Director OR VP"; }
function jsonLd(html) {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].flatMap(match => {
    try { const parsed = JSON.parse(match[1]); return Array.isArray(parsed) ? parsed : [parsed]; } catch { return []; }
  });
}
function findJobData(html, url) {
  const schemas = jsonLd(html); const job = schemas.find(item => item?.["@type"] === "JobPosting") || schemas.find(item => String(item?.["@type"]).includes("JobPosting")) || {};
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)/i)?.[1];
  const company = typeof job.hiringOrganization === "object" ? job.hiringOrganization.name : "";
  const address = job.jobLocation?.address || job.jobLocation?.[0]?.address || {};
  const location = [address.addressLocality, address.addressRegion, address.addressCountry].filter(Boolean).join(", ");
  return { title: plain(job.title || ogTitle || titleTag || ""), company: plain(company), location: plain(location), source: new URL(url).hostname.replace(/^www\./, "") };
}
const roleAliases = { "produktmanager": ["product manager", "product owner"], "product manager": ["produktmanager", "product owner"], "product owner": ["produktmanager", "product manager"], "projektmanager": ["project manager", "producer"], "project manager": ["projektmanager", "producer"], "producer": ["projektmanager", "project manager"], "veröffentlichung": ["publishing"], "publishing": ["veröffentlichung"], "betrieb": ["operations", "live ops"], "operations": ["betrieb", "live ops"], "live ops": ["betrieb", "operations"], "lokalisierung": ["localization"], "localization": ["lokalisierung"], "gemeinschaft": ["community"], "community": ["gemeinschaft"], "kundensupport": ["support", "player support"], "support": ["kundensupport", "player support"], "monetarisierung": ["monetization"], "monetization": ["monetarisierung"] };
function searchTerms(search) { return String(search || "").toLowerCase().split(/[,&/]+/).map(term => term.trim()).filter(Boolean).flatMap(term => [term, ...(roleAliases[term] || [])]); }
function hasTerms(value, search) {
  const text = String(value || "").toLowerCase();
  return searchTerms(search).some(term => text.includes(term));
}
function discoverJobs(title, location, keywords, sourceOptions = {}) {
  const timeout = AbortSignal.timeout(12000);
  return Promise.allSettled([
    sourceOptions.remotive !== false ? fetch("https://remotive.com/api/remote-jobs", { signal: timeout }).then(response => response.json()) : Promise.resolve({ jobs: [] }),
    sourceOptions.arbeitnow !== false ? fetch("https://www.arbeitnow.com/api/job-board-api", { signal: timeout }).then(response => response.json()) : Promise.resolve({ data: [] })
  ]).then(results => {
    const remote = results[0].status === "fulfilled" ? results[0].value.jobs.map(job => ({
      title: plain(job.title), company: plain(job.company_name), location: plain(job.candidate_required_location || "Remote"),
      url: job.url, source: "Remotive", publishedAt: job.publication_date, description: plain(job.description).slice(0, 260)
    })) : [];
    const arbeitnow = results[1].status === "fulfilled" ? results[1].value.data.map(job => ({
      title: plain(job.title), company: plain(job.company_name), location: plain(job.location || (job.remote ? "Remote" : "")),
      url: job.url, source: "Arbeitnow", publishedAt: job.created_at ? new Date(job.created_at * 1000).toISOString() : "", description: plain(job.description).slice(0, 260)
    })) : [];
    const all = [...arbeitnow, ...remote];
    const matches = all.filter(job => hasTerms(job.title, title) || hasTerms(job.description, title))
      .filter(job => !location || (/remote/i.test(location) ? /remote/i.test(job.location + " " + job.description) : hasTerms(job.location, location) || hasTerms(job.description, location)))
      .filter(job => !keywords || hasTerms(job.title + " " + job.description, keywords))
      .slice(0, 12);
    return matches;
  });
}
async function findContacts(company, role, focus = "role") {
  if (!process.env.BRAVE_SEARCH_API_KEY) throw new Error("Brave Search ist nicht konfiguriert.");
  const focusTerms = focus === "executive" ? "CEO OR Founder OR COO OR \"Managing Director\"" : functionalContactTerms(role);
  const query = `site:linkedin.com/in "${company}" (${focusTerms})`;
  const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${new URLSearchParams({ q: query, count: "10" })}`, { headers: { Accept: "application/json", "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("Brave Search konnte keine Ergebnisse liefern.");
  const results = (await response.json()).web?.results || [], companyTerms=company.toLowerCase().split(/\s+/).filter(term=>term.length>2), roleTerms=role.toLowerCase().split(/[^a-zäöüß]+/i).filter(term=>term.length>3), focusPattern=focus==="executive"?/\b(ceo|coo|founder|managing director|geschäftsführer)\b/i:/\b(head of|director|manager|lead)\b/i;
  return results.filter(item => /linkedin\.com\/in\//i.test(item.url)).map(item=>{const facts=contactFacts(item),titleText=facts.title.toLowerCase(),companyMatches=companyTerms.filter(term=>facts.text.includes(term)).length,companyTitleMatches=companyTerms.filter(term=>titleText.includes(term)).length,roleMatches=roleTerms.filter(term=>titleText.includes(term)).length,leadership=focusPattern.test(titleText),minimumCompanyMatches=Math.min(2,companyTerms.length),accepted=facts.title&&companyMatches>=minimumCompanyMatches&&companyTitleMatches>=minimumCompanyMatches&&(focus==="executive"?leadership:leadership&&(roleMatches>0||/\b(head of|director|vp|chief|coo|cpo)\b/i.test(titleText))),score=companyMatches*12+roleMatches*18+(leadership?16:0);return{item,facts,accepted,score}}).filter(result=>result.accepted).sort((a,b)=>b.score-a.score).slice(0,2).map(({item,facts}) => ({ url: item.url, name: facts.name, title: facts.title }));
}

createServer((req, res) => {
  const requested = req.url?.split("?")[0] || "/";
  if (requested === "/api/job-preview") {
    const url = new URL(req.url, `http://${req.headers.host}`).searchParams.get("url");
    if (!url || !/^https?:\/\//i.test(url)) { res.writeHead(400, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ error: "Bitte einen gültigen Job-Link einfügen." })); }
    return fetch(url, { headers: { "User-Agent": "Signalboard/0.1 job-link-preview" }, signal: AbortSignal.timeout(8000) })
      .then(response => response.text())
      .then(html => { res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(findJobData(html, url))); })
      .catch(() => { res.writeHead(422, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Die Jobseite konnte nicht ausgelesen werden. Du kannst die Felder trotzdem manuell füllen." })); });
  }
  if (requested === "/api/discover-jobs") {
    const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
    const title = params.get("title") || "", location = params.get("location") || "", keywords = params.get("keywords") || "";
    if (!title) { res.writeHead(400, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ error: "Ein Rollen- oder Keyword-Begriff fehlt." })); }
    return discoverJobsFunction(new Request(`http://localhost/api/discover-jobs?${params.toString()}`))
      .then(async response => { res.writeHead(response.status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(await response.text()); })
      .catch(() => { res.writeHead(502, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Die Jobquellen sind gerade nicht erreichbar." })); });
  }
  if (requested === "/api/contact-research") {
    const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
    return findContacts(params.get("company") || "", params.get("role") || "", params.get("focus") || "role")
      .then(contacts => { res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify({ contacts })); })
      .catch(error => { res.writeHead(502, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: error.message })); });
  }
  const safePath = normalize(requested === "/" ? "/index.html" : requested).replace(/^(\.\.[\\/])+/g, "");
  const file = join(root, safePath);
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Nicht gefunden");
  }
  res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
  createReadStream(file).pipe(res);
}).listen(port, "0.0.0.0", () => console.log(`Signalboard läuft unter http://0.0.0.0:${port}`));
