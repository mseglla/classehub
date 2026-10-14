const { createClient } = require("@supabase/supabase-js");
const crypto = require("node:crypto");

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const rateLimitSecret = process.env.PUSH_RATE_LIMIT_SECRET;

function getIpHash(req) {
  const ip = String(
    req.headers["x-vercel-forwarded-for"] ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  ).split(",")[0].trim();

  return crypto
    .createHmac("sha256", rateLimitSecret)
    .update(ip)
    .digest("hex");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  if (!supabaseUrl || !serviceRoleKey || !rateLimitSecret) {
    return res.status(500).json({ error: "MISSING_SERVER_ENV" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const { classId, accessPin, subscription } = req.body || {};

    const numericClassId = Number(classId);
    const cleanPin = String(accessPin || "").trim();

    if (
      !Number.isSafeInteger(numericClassId) ||
      numericClassId <= 0 ||
      !/^\d{4}$/.test(cleanPin)
    ) {
      return res.status(400).json({ error: "INVALID_FAMILY_ACCESS" });
    }

    const { data: allowed, error: limitError } = await supabase.rpc(
      "check_push_rate_limit",
      {
        p_action: "subscribe",
        p_ip_hash: getIpHash(req),
      }
    );

    if (limitError) {
      console.error("Push rate limit error:", limitError);
      return res.status(503).json({ error: "RATE_LIMIT_UNAVAILABLE" });
    }

    if (!allowed) {
      return res.status(429).json({ error: "RATE_LIMITED" });
    }

    const { data: families, error: familyError } = await supabase.rpc(
      "get_family_by_pin",
      {
        p_class_id: numericClassId,
        p_access_pin: cleanPin,
      }
    );

    if (familyError) {
      console.error("Push family lookup error:", familyError);
      return res.status(500).json({ error: "FAMILY_LOOKUP_FAILED" });
    }

    const family = families?.[0];

    if (!family) {
      return res.status(403).json({ error: "INVALID_FAMILY_ACCESS" });
    }

    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;

    if (
      typeof endpoint !== "string" ||
      !endpoint.startsWith("https://") ||
      endpoint.length > 2048 ||
      typeof p256dh !== "string" ||
      !/^[A-Za-z0-9_-]{80,120}$/.test(p256dh) ||
      typeof auth !== "string" ||
      !/^[A-Za-z0-9_-]{15,40}$/.test(auth)
    ) {
      return res.status(400).json({ error: "INVALID_SUBSCRIPTION" });
    }

    const { data: existing, error: existingError } = await supabase
      .from("ch_push_subscriptions")
      .select("id, family_id")
      .eq("endpoint", endpoint)
      .maybeSingle();

    if (existingError) {
      return res.status(500).json({ error: "LOOKUP_FAILED" });
    }

    if (existing && Number(existing.family_id) !== Number(family.id)) {
      return res.status(409).json({ error: "ENDPOINT_ALREADY_REGISTERED" });
    }

    const payload = {
      family_id: family.id,
      class_id: numericClassId,
      endpoint,
      p256dh,
      auth,
      user_agent: String(req.headers["user-agent"] || "").slice(0, 500),
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const query = existing
      ? supabase
          .from("ch_push_subscriptions")
          .update(payload)
          .eq("id", existing.id)
          .eq("family_id", family.id)
      : supabase.from("ch_push_subscriptions").insert(payload);

    const { data, error } = await query.select("id").single();

    if (error) {
      console.error("Push subscription save error:", error);
      return res.status(500).json({ error: "SAVE_FAILED" });
    }

    return res.status(200).json({
      success: true,
      subscriptionId: data.id,
    });
  } catch (error) {
    console.error("Push subscription error:", error);
    return res.status(500).json({ error: "UNEXPECTED_ERROR" });
  }
};
