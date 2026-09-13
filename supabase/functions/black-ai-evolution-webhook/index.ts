import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8" },
});

function firstSecretValue(raw: string | undefined) {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") {
      const value = Object.values(parsed).find((item) => typeof item === "string" && String(item).length > 10);
      if (value) return String(value);
    }
  } catch (_) {
    if (raw.length > 10) return raw;
  }
  return "";
}

function getServiceKey() {
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    || firstSecretValue(Deno.env.get("SUPABASE_SECRET_KEYS"));
}

function digits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function phoneFromJid(jid: string) {
  return digits(jid.split("@")[0] || "");
}

function classifyMessage(message: any) {
  if (!message || typeof message !== "object") return { type: "unknown", mediaType: null, text: "", caption: "", mimetype: "", mediaUrl: "" };
  if (message.conversation) return { type: "text", mediaType: null, text: String(message.conversation), caption: "", mimetype: "", mediaUrl: "" };
  if (message.extendedTextMessage?.text) return { type: "text", mediaType: null, text: String(message.extendedTextMessage.text), caption: "", mimetype: "", mediaUrl: "" };
  if (message.imageMessage) return { type: "image", mediaType: "image", text: "", caption: String(message.imageMessage.caption || ""), mimetype: String(message.imageMessage.mimetype || ""), mediaUrl: String(message.imageMessage.url || "") };
  if (message.audioMessage) return { type: "audio", mediaType: "audio", text: "", caption: "", mimetype: String(message.audioMessage.mimetype || ""), mediaUrl: String(message.audioMessage.url || "") };
  if (message.videoMessage) return { type: "video", mediaType: "video", text: "", caption: String(message.videoMessage.caption || ""), mimetype: String(message.videoMessage.mimetype || ""), mediaUrl: String(message.videoMessage.url || "") };
  if (message.documentMessage) return { type: "document", mediaType: "document", text: "", caption: String(message.documentMessage.caption || message.documentMessage.fileName || ""), mimetype: String(message.documentMessage.mimetype || ""), mediaUrl: String(message.documentMessage.url || "") };
  const firstKey = Object.keys(message)[0] || "unknown";
  return { type: firstKey, mediaType: null, text: "", caption: "", mimetype: "", mediaUrl: "" };
}

function extractReferral(message: any, data: any) {
  return message?.extendedTextMessage?.contextInfo?.externalAdReply
    || message?.imageMessage?.contextInfo?.externalAdReply
    || message?.videoMessage?.contextInfo?.externalAdReply
    || data?.contextInfo?.externalAdReply
    || data?.referral
    || null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const expected = Deno.env.get("BLACK_AI_WEBHOOK_SECRET") || "";
  const url = new URL(req.url);
  const supplied = req.headers.get("x-black-ai-webhook-secret") || url.searchParams.get("token") || "";
  if (!expected || supplied !== expected) return json({ error: "Webhook no autorizado" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = getServiceKey();
  if (!supabaseUrl || !serviceKey) return json({ error: "Configuración de Supabase incompleta" }, 500);

  try {
    const payload = await req.json().catch(() => ({}));
    const eventName = String(payload?.event || payload?.type || payload?.eventType || "unknown");
    const instanceName = String(payload?.instance || payload?.instanceName || payload?.sender || "");
    const data = payload?.data || payload;

    // Evolution puede enviar un objeto individual o una colección según versión/configuración.
    const candidates = Array.isArray(data) ? data : [data];
    const rows: any[] = [];

    for (const item of candidates) {
      const key = item?.key || item?.data?.key || {};
      const message = item?.message || item?.data?.message || {};
      const remoteJid = String(key?.remoteJid || item?.remoteJid || item?.jid || "");
      const fromMe = Boolean(key?.fromMe || item?.fromMe);
      const messageId = String(key?.id || item?.id || item?.messageId || "") || null;
      const parsed = classifyMessage(message);
      const pushName = String(item?.pushName || item?.data?.pushName || "");
      const phone = phoneFromJid(remoteJid);
      const isGroup = /@g\.us$/i.test(remoteJid);
      const providerTsRaw = item?.messageTimestamp || item?.timestamp || payload?.date_time || null;
      let providerTimestamp: string | null = null;
      if (providerTsRaw) {
        const n = Number(providerTsRaw);
        providerTimestamp = Number.isFinite(n)
          ? new Date(n < 1e12 ? n * 1000 : n).toISOString()
          : new Date(String(providerTsRaw)).toISOString();
      }
      const referral = extractReferral(message, item);

      // Solo metadata resumida. Nunca persistimos base64 ni el payload entero.
      rows.push({
        provider: "evolution",
        event_name: eventName,
        instance_name: instanceName || null,
        message_id: messageId,
        remote_jid: remoteJid || null,
        phone: phone || null,
        push_name: pushName || null,
        from_me: fromMe,
        is_group: isGroup,
        message_type: parsed.type,
        media_type: parsed.mediaType,
        text_content: parsed.text || null,
        caption: parsed.caption || null,
        media_mimetype: parsed.mimetype || null,
        media_url: parsed.mediaUrl || null,
        has_media: Boolean(parsed.mediaType),
        referral,
        metadata: {
          source_event: eventName,
          server_url: payload?.server_url || null,
          destination: payload?.destination || null,
        },
        provider_timestamp: providerTimestamp,
      });
    }

    if (!rows.length) return json({ ok: true, received: 0 });

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await supabase.from("black_ai_inbox").upsert(rows, {
      onConflict: "provider,message_id",
      ignoreDuplicates: true,
    });
    if (error) {
      console.error("black_ai_inbox insert", error);
      return json({ error: "No se pudo registrar el evento", detail: error.message }, 500);
    }

    return json({ ok: true, received: rows.length });
  } catch (error) {
    console.error("black-ai-evolution-webhook", error);
    return json({ error: String((error as any)?.message || "Error interno") }, 500);
  }
});