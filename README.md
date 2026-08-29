# Signalboard

Kompakte, mobile Weboberfläche für freelance Job-Outreach: Jobs qualifizieren, Kontakte recherchieren, Nachrichten vorbereiten und Follow-ups verfolgen.

## Lokal starten

```powershell
npm start
```

Danach unter `http://localhost:4173` öffnen. Im gleichen WLAN ist die App über die lokale IPv4-Adresse des Rechners und Port `4173` erreichbar.

Lokal bleiben die Daten im Browser (`localStorage`). Für den Live-Betrieb enthält das Projekt zusätzlich eine optionale Supabase-Basis für Magic-Link-Login und persönliche Cloud-Workspaces sowie sichere Netlify-Functions für LinkedIn OAuth. Die Einrichtung steht in [SUPABASE_SETUP.md](SUPABASE_SETUP.md).
