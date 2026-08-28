import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };

function plain(value = "") { return String(value).replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim(); }
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
  const safePath = normalize(requested === "/" ? "/index.html" : requested).replace(/^(\.\.[\\/])+/g, "");
  const file = join(root, safePath);
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Nicht gefunden");
  }
  res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
  createReadStream(file).pipe(res);
}).listen(port, "0.0.0.0", () => console.log(`Signalboard läuft unter http://0.0.0.0:${port}`));
