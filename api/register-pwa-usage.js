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

  res.setHeader("Cache-Control", "no-store");

  if (!supabaseUrl || !serviceRoleKey || !rateLimitSecret) {
    return res.status(500).json({ error: "MISSING_SERVER_ENV" });
  }

  const classId = Number(req.body?.classId);
  const accessPin = String(req.body?.accessPin || "").trim();

  if (
    !Number.isSafeInteger(classId) ||
    classId <= 0 ||
    !/^\d{4}$/.test(accessPin)
  ) {
    return res.status(400).json({ error: "INVALID_FAMILY_ACCESS" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const { data: allowed, error: limitError } = await supabase.rpc(
      "check_push_rate_limit",
      {
        p_action: "pwa_usage",
        p_ip_hash: getIpHash(req),
      }
    );

    if (limitError) {
      console.error("PWA rate limit error:", limitError);
      return res.status(503).json({ error: "RATE_LIMIT_UNAVAILABLE" });
    }

    if (!allowed) {
      return res.status(429).json({ error: "RATE_LIMITED" });
    }

    const { data: families, error: familyError } = await supabase.rpc(
      "get_family_by_pin",
      {
        p_class_id: classId,
        p_access_pin: accessPin,
      }
    );

    if (familyError) {
      console.error("PWA family lookup error:", familyError);
      return res.status(500).json({ error: "FAMILY_LOOKUP_FAILED" });
    }

    const family = families?.[0];

    if (!family) {
      return res.status(403).json({ error: "INVALID_FAMILY_ACCESS" });
    }

    const { error: saveError } = await supabase
      .from("ch_family_pwa_usage")
      .upsert(
        {
          family_id: family.id,
          class_id: classId,
        },
        {
          onConflict: "family_id",
          ignoreDuplicates: true,
        }
      );

    if (saveError) {
      console.error("PWA usage save error:", saveError);
      return res.status(500).json({ error: "SAVE_FAILED" });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("PWA usage unexpected error:", error);
    return res.status(500).json({ error: "UNEXPECTED_ERROR" });
  }
};
