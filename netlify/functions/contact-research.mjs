const plain = (value = "") => String(value).replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
const contactFacts = item => { const heading=plain(item.title).replace(/\s*\|\s*linkedin.*$/i,"").trim(),parts=heading.split(/\s+(?:[-–—]|\|)\s+/).map(part=>part.trim()).filter(Boolean);return{name:parts[0]||heading,title:parts.slice(1).find(part=>!/^(linkedin|profile)$/i.test(part))||"",text:`${heading} ${plain(item.description)}`.toLowerCase()}; };
const functionalContactTerms = (role = "") => { const value=role.toLowerCase(); if(/operations|live ops|producer|project/.test(value))return "\"Head of Operations\" OR \"Operations Director\" OR COO";if(/product|monetization/.test(value))return "\"Head of Product\" OR \"Product Director\" OR CPO";if(/publishing/.test(value))return "\"Head of Publishing\" OR \"Publishing Director\"";if(/community|support/.test(value))return "\"Head of Community\" OR \"Player Support Director\"";if(/localization/.test(value))return "\"Head of Localization\" OR \"Localization Director\"";return "\"Head of\" OR Director OR VP"; };

export default async request => {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return Response.json({ error: "Brave Search ist noch nicht konfiguriert." }, { status: 503 });
  const params = new URL(request.url).searchParams, company = params.get("company") || "", role = params.get("role") || "", focus = params.get("focus") || "role";
  const focusTerms = focus === "executive" ? "CEO OR Founder OR COO OR \"Managing Director\"" : functionalContactTerms(role);
  const query = `site:linkedin.com/in "${company}" (${focusTerms})`;
  try {
    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${new URLSearchParams({ q: query, count: "10" })}`, { headers: { Accept: "application/json", "X-Subscription-Token": key }, signal: AbortSignal.timeout(12000) });
    if (!response.ok) return Response.json({ error: "Brave Search konnte gerade keine Ergebnisse liefern." }, { status: 502 });
    const results = (await response.json()).web?.results || [], companyTerms=company.toLowerCase().split(/\s+/).filter(term=>term.length>2), roleTerms=role.toLowerCase().split(/[^a-zäöüß]+/i).filter(term=>term.length>3), focusPattern=focus==="executive"?/\b(ceo|coo|founder|managing director|geschäftsführer)\b/i:/\b(head of|director|manager|lead)\b/i;
    const contacts = results.filter(item => /linkedin\.com\/in\//i.test(item.url)).map(item=>{const facts=contactFacts(item),titleText=facts.title.toLowerCase(),companyMatches=companyTerms.filter(term=>facts.text.includes(term)).length,companyTitleMatches=companyTerms.filter(term=>titleText.includes(term)).length,roleMatches=roleTerms.filter(term=>titleText.includes(term)).length,leadership=focusPattern.test(titleText),minimumCompanyMatches=Math.min(2,companyTerms.length),accepted=facts.title&&companyMatches>=minimumCompanyMatches&&companyTitleMatches>=minimumCompanyMatches&&(focus==="executive"?leadership:leadership&&(roleMatches>0||/\b(head of|director|vp|chief|coo|cpo)\b/i.test(titleText))),score=companyMatches*12+roleMatches*18+(leadership?16:0);return{item,facts,accepted,score}}).filter(result=>result.accepted).sort((a,b)=>b.score-a.score).slice(0,2).map(({item,facts}) => ({ url: item.url, name: facts.name, title: facts.title }));
    return Response.json({ contacts }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Brave Search ist gerade nicht erreichbar." }, { status: 502 }); }
};
