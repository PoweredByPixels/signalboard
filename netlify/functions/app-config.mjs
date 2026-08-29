export default async () => Response.json({
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ""
}, { headers: { "Cache-Control": "no-store" } });
