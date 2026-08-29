import { baseUrl, json, readState, redirectUri, saveAuthorization } from "./_linkedin.mjs";

export default async (request) => {
  try {
    const url = new URL(request.url), error = url.searchParams.get("error"), code = url.searchParams.get("code");
    if (error || !code) return Response.redirect(`${baseUrl()}/?linkedin=cancelled`, 302);
    const state = readState(url.searchParams.get("state"));
    const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri(), client_id: process.env.LINKEDIN_CLIENT_ID || "", client_secret: process.env.LINKEDIN_CLIENT_SECRET || "" }) });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || !token.access_token) throw new Error("LinkedIn konnte die Freigabe nicht bestätigen.");
    await saveAuthorization(state.userId, token.access_token, token.expires_in, token.scope);
    return Response.redirect(`${baseUrl()}/?linkedin=connected`, 302);
  } catch (error) { return Response.redirect(`${baseUrl()}/?linkedin=error&message=${encodeURIComponent(error.message)}`, 302); }
};
