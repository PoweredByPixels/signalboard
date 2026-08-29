const plain = (value = "") => String(value).replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
const roleAliases = {
  "produktmanager": ["product manager", "product owner"], "product manager": ["produktmanager", "product owner"], "product owner": ["produktmanager", "product manager"],
  "projektmanager": ["project manager", "producer"], "project manager": ["projektmanager", "producer"], "producer": ["projektmanager", "project manager"],
  "veröffentlichung": ["publishing"], "publishing": ["veröffentlichung"], "betrieb": ["operations", "live ops"], "operations": ["betrieb", "live ops"], "live ops": ["betrieb", "operations"],
  "lokalisierung": ["localization"], "localization": ["lokalisierung"], "gemeinschaft": ["community"], "community": ["gemeinschaft"],
  "kundensupport": ["support", "player support"], "support": ["kundensupport", "player support"], "monetarisierung": ["monetization"], "monetization": ["monetarisierung"]
};
const searchTerms = search => String(search || "").toLowerCase().split(/[,&/]+/).map(term => term.trim()).filter(Boolean).flatMap(term => [term, ...(roleAliases[term] || [])]);
const hasTerms = (value, search) => {
  const text = String(value || "").toLowerCase();
  return searchTerms(search).some(term => text.includes(term));
};
const braveSources={games:["hitmarker.net/jobs","workwithindies.com","ingamejob.com","gamesjobsdirect.com","jobs.gamesindustry.biz"],tech:["wellfound.com/jobs","weworkremotely.com","workingnomads.com","eustartupjobs.com"]};
const sourceName=url=>{try{return new URL(url).hostname.replace(/^www\./,"")}catch{return "Brave"}};
const isListingPage=item=>{try{const url=new URL(item.url),path=url.pathname.toLowerCase().replace(/\/$/,"")||"/",title=plain(item.title).toLowerCase();return /^\/(?:en|de|ru)?$/.test(path)||/\/(?:jobs?|vacancies|careers|search)$/.test(path)||/\b(job board|find jobs|jobs in|all jobs|career opportunities|vacancies)\b/.test(title);}catch{return true;}};
async function braveJobs(kind,title,location,keywords,signal){
  const key=process.env.BRAVE_SEARCH_API_KEY;if(!key)return [];
  const sites=braveSources[kind].map(domain=>`site:${domain}`).join(" OR ");
  const query=`(${sites}) "${title}" ${location||""} ${keywords||""}`.trim();
  const response=await fetch(`https://api.search.brave.com/res/v1/web/search?${new URLSearchParams({q:query,count:"12"})}`,{headers:{Accept:"application/json","X-Subscription-Token":key},signal});
  if(!response.ok)return [];
  return ((await response.json()).web?.results||[]).filter(item=>!isListingPage(item)).map(item=>{const parts=plain(item.title).split(/\s[|–-]\s/);return {title:parts[0]||plain(item.title),company:parts[1]||sourceName(item.url),location:location||"",url:item.url,source:`Brave · ${sourceName(item.url)}`,description:plain(item.description).slice(0,260)};});
}

export default async request => {
  const params = new URL(request.url).searchParams;
  const title = params.get("title") || "", location = params.get("location") || "", keywords = params.get("keywords") || "";
  if (!title) return Response.json({ error: "Ein Rollen- oder Keyword-Begriff fehlt." }, { status: 400 });
  const timeout = AbortSignal.timeout(12000);
  const [remotiveResult, arbeitnowResult, braveGamesResult, braveTechResult] = await Promise.allSettled([
    params.get("remotive") === "false" ? Promise.resolve({ jobs: [] }) : fetch("https://remotive.com/api/remote-jobs", { signal: timeout }).then(response => response.json()),
    params.get("arbeitnow") === "false" ? Promise.resolve({ data: [] }) : fetch("https://www.arbeitnow.com/api/job-board-api", { signal: timeout }).then(response => response.json()),
    params.get("braveGames") === "false" ? Promise.resolve([]) : braveJobs("games",title,location,keywords,timeout),
    params.get("braveTech") === "false" ? Promise.resolve([]) : braveJobs("tech",title,location,keywords,timeout)
  ]);
  const remote = remotiveResult.status === "fulfilled" ? (remotiveResult.value.jobs || []).map(job => ({ title: plain(job.title), company: plain(job.company_name), location: plain(job.candidate_required_location || "Remote"), url: job.url, source: "Remotive", publishedAt: job.publication_date, description: plain(job.description).slice(0, 260) })) : [];
  const arbeitnow = arbeitnowResult.status === "fulfilled" ? (arbeitnowResult.value.data || []).map(job => ({ title: plain(job.title), company: plain(job.company_name), location: plain(job.location || (job.remote ? "Remote" : "")), url: job.url, source: "Arbeitnow", publishedAt: job.created_at ? new Date(job.created_at * 1000).toISOString() : "", description: plain(job.description).slice(0, 260) })) : [];
  const braveGames=braveGamesResult.status==="fulfilled"?braveGamesResult.value:[],braveTech=braveTechResult.status==="fulfilled"?braveTechResult.value:[];
  const jobs = [...arbeitnow, ...remote, ...braveGames, ...braveTech].filter(job => hasTerms(job.title, title) || hasTerms(job.description, title)).filter(job => !location || (/remote/i.test(location) ? /remote/i.test(`${job.location} ${job.description}`) : hasTerms(job.location, location) || hasTerms(job.description, location))).filter(job => !keywords || hasTerms(`${job.title} ${job.description}`, keywords)).filter((job,index,all)=>all.findIndex(other=>other.url===job.url)===index).slice(0, 24);
  return Response.json({ jobs }, { headers: { "Cache-Control": "no-store" } });
};
