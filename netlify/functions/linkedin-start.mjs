import { baseUrl, getUser, json, redirectUri, signState } from "./_linkedin.mjs";

export default async (request) => {
  try {
    const user = await getUser(request);
    if (!user) return json({ error: "Bitte zuerst bei Signalboard anmelden." }, 401);
    const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
    url.search = new URLSearchParams({ response_type: "code", client_id: process.env.LINKEDIN_CLIENT_ID || "", redirect_uri: redirectUri(), state: signState(user.id), scope: process.env.LINKEDIN_SCOPES || "r_dma_portability_self_serve" });
    if (!process.env.LINKEDIN_CLIENT_ID) return json({ error: "LinkedIn ist noch nicht konfiguriert." }, 503);
    return json({ url: url.toString() });
  } catch (error) { return json({ error: error.message }, 500); }
};
