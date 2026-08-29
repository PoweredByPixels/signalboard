const plain = (value = "") => String(value).replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();

export default async request => {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return Response.json({ error: "Brave Search ist noch nicht konfiguriert." }, { status: 503 });
  const params = new URL(request.url).searchParams, company = params.get("company") || "", role = params.get("role") || "";
  const query = `site:linkedin.com/in "${company}" (CEO OR Founder OR "${role}" OR "Head of" OR Director)`;
  try {
    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${new URLSearchParams({ q: query, count: "10" })}`, { headers: { Accept: "application/json", "X-Subscription-Token": key }, signal: AbortSignal.timeout(12000) });
    if (!response.ok) return Response.json({ error: "Brave Search konnte gerade keine Ergebnisse liefern." }, { status: 502 });
    const results = (await response.json()).web?.results || [];
    const contacts = results.filter(item => /linkedin\.com\/in\//i.test(item.url)).slice(0, 2).map(item => ({ url: item.url, name: plain(item.title).replace(/\s*[|–-].*$/, ""), title: plain(item.description).slice(0, 160) }));
    return Response.json({ contacts }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Brave Search ist gerade nicht erreichbar." }, { status: 502 }); }
};
