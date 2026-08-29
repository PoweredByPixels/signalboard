import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

const required = (name) => { const value = process.env[name]; if (!value) throw new Error(`${name} ist nicht konfiguriert.`); return value; };
export const baseUrl = () => process.env.PUBLIC_SITE_URL || "https://signalboard-poweredbypixels.netlify.app";
export const redirectUri = () => `${baseUrl()}/.netlify/functions/linkedin-callback`;
export const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function getUser(request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const response = await fetch(`${required("SUPABASE_URL")}/auth/v1/user`, { headers: { apikey: required("SUPABASE_ANON_KEY"), Authorization: `Bearer ${token}` } });
  return response.ok ? response.json() : null;
}
export function signState(userId) {
  const payload = Buffer.from(JSON.stringify({ userId, issuedAt: Date.now(), nonce: randomBytes(12).toString("hex") })).toString("base64url");
  const signature = createHmac("sha256", required("OAUTH_STATE_SECRET")).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
export function readState(state) {
  const [payload, signature] = String(state || "").split(".");
  const expected = createHmac("sha256", required("OAUTH_STATE_SECRET")).update(payload || "").digest("base64url");
  if (!payload || signature !== expected) throw new Error("Ungültiger LinkedIn-Status.");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!data.userId || Date.now() - data.issuedAt > 10 * 60 * 1000) throw new Error("LinkedIn-Status ist abgelaufen.");
  return data;
}
export function encrypt(value) {
  const key = Buffer.from(required("TOKEN_ENCRYPTION_KEY"), "base64");
  if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY muss ein Base64-kodierter 32-Byte-Schlüssel sein.");
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}
export async function saveAuthorization(userId, token, expiresIn, scope) {
  const response = await fetch(`${required("SUPABASE_URL")}/rest/v1/linkedin_authorizations?on_conflict=user_id`, {
    method: "POST", headers: { apikey: required("SUPABASE_SERVICE_ROLE_KEY"), Authorization: `Bearer ${required("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ user_id: userId, access_token_ciphertext: encrypt(token), expires_at: expiresIn ? new Date(Date.now() + Number(expiresIn) * 1000).toISOString() : null, scope: scope || "" })
  });
  if (!response.ok) throw new Error("LinkedIn-Verknüpfung konnte nicht gespeichert werden.");
}
