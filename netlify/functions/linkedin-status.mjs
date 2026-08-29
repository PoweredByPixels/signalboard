import { getUser, json } from "./_linkedin.mjs";
export default async (request) => {
  try {
    const user = await getUser(request); if (!user) return json({ error: "Nicht angemeldet." }, 401);
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/linkedin_authorizations?user_id=eq.${user.id}&select=connected_at,expires_at,scope`, { headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: request.headers.get("authorization") || "" } });
    if (!response.ok) throw new Error("LinkedIn-Status konnte nicht gelesen werden.");
    const [connection] = await response.json(); return json({ connected: Boolean(connection), connection: connection || null });
  } catch (error) { return json({ error: error.message }, 500); }
};
