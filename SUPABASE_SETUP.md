# Signalboard: Auth, Cloud-Workspace & LinkedIn

## 1. Supabase-Projekt anlegen

1. In Supabase ein neues Projekt anlegen (EU-Region empfohlen).
2. Im **SQL Editor** den Inhalt von `supabase/migrations/001_signalboard.sql` ausführen.
3. Unter **Authentication → URL Configuration** diese URLs eintragen:
   - Site URL: `https://signalboard-poweredbypixels.netlify.app`
   - Redirect URL: `https://signalboard-poweredbypixels.netlify.app/**`
4. Unter **Authentication → Providers → Email** E-Mail-Anmeldung aktiv lassen. Signalboard nutzt Passwörter für die tägliche Anmeldung; Magic Links dienen nur der Ersteinrichtung oder Passwort-Wiederherstellung.
5. Unter **Project Settings → API** kopieren: `Project URL`, den **anon/publishable key** und den **service_role key**. Den Service-Role-Key niemals in den Browser, GitHub oder einen Chat kopieren.

## 2. Netlify-Umgebungsvariablen setzen

Im Netlify-Projekt unter **Project configuration → Environment variables** setzen:

| Name | Wert |
| --- | --- |
| `PUBLIC_SITE_URL` | `https://signalboard-poweredbypixels.netlify.app` |
| `SUPABASE_URL` | Project URL aus Supabase |
| `SUPABASE_ANON_KEY` | anon/publishable key aus Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key aus Supabase |
| `LINKEDIN_CLIENT_ID` | Client ID der LinkedIn-App |
| `LINKEDIN_CLIENT_SECRET` | Client Secret der LinkedIn-App |
| `LINKEDIN_SCOPES` | `r_dma_portability_self_serve` |
| `OAUTH_STATE_SECRET` | zufälliger langer Geheimwert (mindestens 32 Zeichen) |
| `TOKEN_ENCRYPTION_KEY` | Base64-kodierter 32-Byte-Schlüssel |

PowerShell zum lokalen Erzeugen der beiden Geheimwerte (nicht in Git speichern):

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Den Befehl zweimal ausführen: einmal für `OAUTH_STATE_SECRET` (der Base64-Wert ist als Text ausreichend) und einmal für `TOKEN_ENCRYPTION_KEY`.

## 3. LinkedIn-Redirect korrigieren

In der LinkedIn-App unter **Auth → Authorized redirect URLs** exakt diese URL eintragen:

```text
https://signalboard-poweredbypixels.netlify.app/.netlify/functions/linkedin-callback
```

Danach auf Netlify neu deployen. Der Button **LinkedIn verbinden** erscheint nach dem Signalboard-Login. Die Callback-Funktion verschlüsselt das OAuth-Token vor der Speicherung; der Browser erhält es nie.

## Noch bewusst nicht automatisiert

Die Verbindung speichert zunächst nur die OAuth-Freigabe. Der Abruf und Abgleich der erlaubten LinkedIn-`CONNECTIONS`-Daten wird als nächster Schritt ergänzt, sobald die Data-Portability-Produktfreigabe in der LinkedIn-App aktiv ist. Signalboard sollte dabei nur den Match-Status in der Karte anzeigen, nicht den kompletten Kontaktbestand im Browser offenlegen.
