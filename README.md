# Signalboard

Signalboard is a personal, mobile-friendly freelance outreach pipeline. It finds open roles, turns them into cards, supports contact research, and tracks the next step.

The product is deliberately **human-in-the-loop**: it suggests research and outreach copy, but never sends LinkedIn messages or connection requests automatically.

## Features

- Multiple, individually enabled saved searches for roles, regions, and keywords
- Job discovery via Arbeitnow, Remotive, and Brave-powered Games/Tech sources
- Deduplication and an ignore list for dismissed findings
- Search-review modal with tabs per saved search and inbox actions
- Kanban stages: Inbox → Contacts → Ready to reach out → Waiting → Archive
- Contact research paths for executives, functional decision-makers, and personal connections
- Manual LinkedIn profile links and outreach drafts
- Seven-day Waiting timer and follow-up controls
- German and English UI, responsive/mobile layout, legal pages
- Optional Supabase login and per-user persisted workspace
- Optional LinkedIn OAuth connection; tokens remain server-side

## Architecture

```text
Browser (vanilla HTML/CSS/JS)
 ├─ app.js       Board, dialogs, discovery review, research, local state
 ├─ auth.js      Supabase login, cloud state, LinkedIn status
 └─ i18n.js      German/English UI

Local Node server (server.mjs)
 ├─ Static files
 ├─ /api/discover-jobs      → local execution of discovery function
 ├─ /api/contact-research   → Brave Search
 └─ /api/job-preview        → metadata from pasted job links

Netlify
 └─ Functions for discovery, contact research, and LinkedIn OAuth

Supabase
 └─ Auth + user_workspaces (jobs, saved searches, ignore list)
```

There is deliberately no frontend framework or build step. `server.mjs` is a small local development server; Netlify deploys the static project plus functions.

## Local development

### Requirements

- Node.js 20+ (Node 24 was used most recently)
- No npm dependencies are required for UI work
- Optional integrations need Brave Search, Supabase, and/or a LinkedIn app

### Start

```powershell
cd C:\Users\volke\Documents\ChatGPT\WorkWork
npm start
```

Open `http://127.0.0.1:4173`.

For a phone on the same Wi-Fi, use the computer's LAN IPv4 address, for example `http://192.168.x.x:4173`.

`server.mjs` optionally reads `.env`. That file is deliberately ignored by Git and must never be committed.

## Configuration

### Brave Search

Brave powers public job-source discovery and external contact research:

```text
BRAVE_SEARCH_API_KEY=...
```

- Local: put it in `.env`
- Production: set it as a Netlify environment variable

Without a key the board still works, but Brave job sources and contact research return no results.

### Supabase

Supabase provides login and persistent user workspaces. Full setup details are in [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

Relevant migrations:

- `supabase/migrations/001_signalboard.sql` — base schema
- `supabase/migrations/20260829145337_add_ignored_jobs.sql` — ignore list for dismissed jobs

Apply migrations in the Supabase SQL editor or with the Supabase CLI. The ignore-list migration prevents dismissed leads from returning in later searches.

Keep these values in Netlify/environment-secret storage only:

```text
PUBLIC_SITE_URL
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
TOKEN_ENCRYPTION_KEY
OAUTH_STATE_SECRET
```

`SUPABASE_ANON_KEY` is browser-safe. `SUPABASE_SERVICE_ROLE_KEY`, `TOKEN_ENCRYPTION_KEY`, and `OAUTH_STATE_SECRET` must never reach the browser, Git, or a chat.

### LinkedIn OAuth

The server-side integration also needs:

```text
LINKEDIN_CLIENT_ID
LINKEDIN_CLIENT_SECRET
LINKEDIN_SCOPES
```

The LinkedIn app must register the exact production callback:

```text
https://signalboard-poweredbypixels.netlify.app/.netlify/functions/linkedin-callback
```

If the production URL changes, update this callback and `PUBLIC_SITE_URL`, then redeploy Netlify.

## What cannot be fully tested locally

This distinction is important when working together: a local success does not necessarily validate the live integration.

| Area | Local test | Notes |
| --- | --- | --- |
| Board, cards, dialogs, drag/drop, i18n | Yes | Run `npm start`; use a phone on the LAN for responsive testing |
| Job-link autofill | Usually | Depends on the target site's CORS/anti-bot policy |
| Brave job/contact research | Yes, with local key | Results are public-search quality, not a structured job database |
| Netlify redirects/functions | Partial | `server.mjs` runs discovery code locally; real `/.netlify/functions/*` routing needs Netlify CLI or a deploy |
| Supabase Magic Links | Limited | Redirect URLs, email provider, and rate limits must be tested against the real site |
| Resend / Supabase SMTP | No | Domain verification, delivery, and SMTP credentials are production configuration |
| LinkedIn OAuth | No | LinkedIn only accepts registered redirect URLs; test end-to-end on Netlify |
| LinkedIn connection degree | Not implemented yet | OAuth currently stores connection status. Reliable 1st/2nd-degree matching needs an approved Data Portability capability or a user-provided export |
| Embedded source previews | Not reliable | Many job boards block iframes via CSP/X-Frame-Options; the external link is the fallback |

Do **not** scrape LinkedIn in the browser or store private connection data in `localStorage` or the repository. Any future connection matching must use the permitted OAuth/Data Portability flow or a user-provided export.

## Search and data quality

Brave is useful but not a perfect structured jobs database. Signalboard therefore filters:

- duplicate URLs/titles via a stable job key
- previously ignored jobs
- obvious board/listing pages (for example the InGameJob landing page)
- contact candidates without a verifiable company and leadership/function title

An empty research path is preferable to a wrong contact. Re-running research only fills empty paths; it does not overwrite existing or manually entered contacts.

## Development workflow

1. Update the branch: `git pull origin master`
2. Start the local server and test the affected flow.
3. For JavaScript changes, run:

   ```powershell
   node --check app.js
   node --check server.mjs
   node --check netlify/functions/discover-jobs.mjs
   node --check netlify/functions/contact-research.mjs
   git diff --check
   ```

4. Keep commits small and focused.
5. Before pushing, coordinate if secrets, database migrations, Netlify variables, or LinkedIn are involved.
6. After a push, review Netlify deploy logs and test live auth/OAuth flows when relevant.

## Deployment

- Repository: `https://github.com/PoweredByPixels/signalboard.git`
- Production: `https://signalboard-poweredbypixels.netlify.app`

Netlify is connected to GitHub and deploys `master` automatically. Do not push experimental local work without agreeing on it first.

## Project map

```text
assets/                     Logos and icons
netlify/functions/          Server-side integrations and OAuth callbacks
supabase/migrations/        Database schema and migrations
app.js                      Board and product logic
auth.js / auth.css          Login, account menu, cloud state
i18n.js                     German/English UI texts
server.mjs                  Local server and local API routes
*.css                       Feature-specific styles
index.html                  App shell and dialog markup
SUPABASE_SETUP.md           Supabase/LinkedIn setup detail
```

## Security checklist

- Never commit API keys, SMTP passwords, LinkedIn client secrets, or Supabase service-role keys.
- Keep `.env` local.
- Check screenshots and screen sharing for visible secrets.
- Use `service_role` only in Netlify Functions, never in frontend code.
