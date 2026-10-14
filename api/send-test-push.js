const { createClient } = require("@supabase/supabase-js");
const webpush = require("web-push");

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:classehub.app@gmail.com";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  try {
    if (!vapidPublicKey || !vapidPrivateKey) {
      return res.status(500).json({ error: "MISSING_VAPID_KEYS" });
    }

    const { familyId } = req.body || {};

    if (!familyId) {
      return res.status(400).json({ error: "MISSING_FAMILY_ID" });
    }

    const { data: subscriptions, error } = await supabase
      .from("ch_push_subscriptions")
      .select("*")
      .eq("family_id", familyId)
      .eq("is_active", true);

    if (error) {
      console.error("send-test-push subscriptions error:", error);
      return res.status(500).json({ error: "SUBSCRIPTIONS_LOAD_FAILED" });
    }

    if (!subscriptions?.length) {
      return res.status(404).json({ error: "NO_ACTIVE_SUBSCRIPTIONS" });
    }

    const payload = JSON.stringify({
      title: "ClasseHub",
      body: "Prova de notificació activada correctament 🎉",
      url: "/classe/orenetes",
    });

    const results = await Promise.allSettled(
      subscriptions.map((subscription) =>
        webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload
        )
      )
    );

    const failedSubscriptions = results
      .map((result, index) => ({ result, subscription: subscriptions[index] }))
      .filter(({ result }) => result.status === "rejected");

    await Promise.all(
      failedSubscriptions.map(({ result, subscription }) => {
        const statusCode = result.reason?.statusCode;

        if (statusCode === 404 || statusCode === 410) {
          return supabase
            .from("ch_push_subscriptions")
            .update({
              is_active: false,
              updated_at: new Date().toISOString(),
            })
            .eq("id", subscription.id);
        }

        console.error("send-test-push failed:", result.reason);
        return Promise.resolve();
      })
    );

    return res.status(200).json({
      success: true,
      sent: results.filter((result) => result.status === "fulfilled").length,
      failed: failedSubscriptions.length,
    });
  } catch (error) {
    console.error("send-test-push unexpected error:", error);
    return res.status(500).json({ error: "UNEXPECTED_ERROR" });
  }
};
