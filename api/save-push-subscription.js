const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const { familyId, classId, subscription } = req.body || {};

    if (!familyId || !classId || !subscription) {
      return res.status(400).json({ error: "MISSING_REQUIRED_FIELDS" });
    }

    const endpoint = subscription.endpoint;
    const p256dh = subscription.keys?.p256dh;
    const auth = subscription.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: "INVALID_SUBSCRIPTION" });
    }

    const payload = {
      family_id: familyId,
      class_id: classId,
      endpoint,
      p256dh,
      auth,
      user_agent: req.headers["user-agent"] || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("ch_push_subscriptions")
      .upsert(payload, {
        onConflict: "family_id,endpoint",
      })
      .select("id")
      .single();

    if (error) {
      console.error("save-push-subscription error:", error);
      return res.status(500).json({ error: "SAVE_FAILED" });
    }

    return res.status(200).json({
      success: true,
      subscriptionId: data.id,
    });
  } catch (error) {
    console.error("save-push-subscription unexpected error:", error);
    return res.status(500).json({ error: "UNEXPECTED_ERROR" });
  }
};
