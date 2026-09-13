import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ ok: true, mode: "case_orchestrator_base" }), {
    headers: { "Content-Type": "application/json" },
  });
});
