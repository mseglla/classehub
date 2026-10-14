const { createClient } = require("@supabase/supabase-js");
const webpush = require("web-push");
const crypto = require("node:crypto");

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const rateLimitSecret = process.env.PUSH_RATE_LIMIT_SECRET;
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:classehub.app@gmail.com";

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

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    !rateLimitSecret ||
    !vapidPublicKey ||
    !vapidPrivateKey
  ) {
    return res.status(500).json({ error: "MISSING_SERVER_ENV" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const { classId, accessPin, endpoint } = req.body || {};

    const numericClassId = Number(classId);
    const cleanPin = String(accessPin || "").trim();

    if (
      !Number.isSafeInteger(numericClassId) ||
      numericClassId <= 0 ||
      !/^\d{4}$/.test(cleanPin) ||
      typeof endpoint !== "string" ||
      !endpoint.startsWith("https://") ||
      endpoint.length > 2048
    ) {
      return res.status(400).json({ error: "INVALID_REQUEST" });
    }

    const { data: allowed, error: limitError } = await supabase.rpc(
      "check_push_rate_limit",
      {
        p_action: "test",
        p_ip_hash: getIpHash(req),
      }
    );

    if (limitError) {
      console.error("Test push rate limit error:", limitError);
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
      return res.status(500).json({ error: "FAMILY_LOOKUP_FAILED" });
    }

    const family = families?.[0];

    if (!family) {
      return res.status(403).json({ error: "INVALID_FAMILY_ACCESS" });
    }

    const { data: subscription, error: subscriptionError } = await supabase
      .from("ch_push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("family_id", family.id)
      .eq("class_id", numericClassId)
      .eq("endpoint", endpoint)
      .eq("is_active", true)
      .maybeSingle();

    if (subscriptionError) {
      return res.status(500).json({ error: "SUBSCRIPTION_LOOKUP_FAILED" });
    }

    if (!subscription) {
      return res.status(404).json({ error: "NO_ACTIVE_SUBSCRIPTION" });
    }

    webpush.setVapidDetails(
      vapidSubject,
      vapidPublicKey,
      vapidPrivateKey
    );

    const payload = JSON.stringify({
      title: "ClasseHub",
      body: "Prova de notificació activada correctament 🎉",
      url: "/",
    });

    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        payload
      );
    } catch (pushError) {
      if (pushError.statusCode === 404 || pushError.statusCode === 410) {
        await supabase
          .from("ch_push_subscriptions")
          .update({
            is_active: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscription.id);

        return res.status(410).json({ error: "SUBSCRIPTION_EXPIRED" });
      }

      console.error("Test push delivery error:", pushError);
      return res.status(502).json({ error: "PUSH_DELIVERY_FAILED" });
    }

    return res.status(200).json({ success: true, sent: 1 });
  } catch (error) {
    console.error("Test push unexpected error:", error);
    return res.status(500).json({ error: "UNEXPECTED_ERROR" });
  }
};
