const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  res.setHeader("Cache-Control", "no-store");

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: "MISSING_SERVER_ENV" });
  }

  const authHeader = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);

  if (!match) {
    return res.status(401).json({ error: "MISSING_AUTH_TOKEN" });
  }

  const classId = Number(req.body?.classId);

  if (!Number.isSafeInteger(classId) || classId <= 0) {
    return res.status(400).json({ error: "INVALID_CLASS_ID" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const { data: userData, error: userError } =
      await supabase.auth.getUser(match[1]);

    if (userError || !userData?.user) {
      return res.status(401).json({ error: "INVALID_AUTH_TOKEN" });
    }

    const { data: permission, error: permissionError } = await supabase
      .from("ch_admin_class_permissions")
      .select("id")
      .eq("user_id", userData.user.id)
      .eq("class_id", classId)
      .in("role", ["admin", "delegate"])
      .limit(1)
      .maybeSingle();

    if (permissionError) {
      console.error("Adoption permission error:", permissionError);
      return res.status(500).json({ error: "PERMISSION_CHECK_FAILED" });
    }

    if (!permission) {
      return res.status(403).json({ error: "CLASS_ACCESS_DENIED" });
    }

    const { data: families, error: familiesError } = await supabase
      .from("ch_families")
      .select("id")
      .eq("class_id", classId)
      .or("is_active.is.null,is_active.eq.true");

    if (familiesError) {
      console.error("Adoption families error:", familiesError);
      return res.status(500).json({ error: "FAMILIES_LOAD_FAILED" });
    }

    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from("ch_push_subscriptions")
      .select("family_id")
      .eq("class_id", classId)
      .eq("is_active", true);

    if (subscriptionsError) {
      console.error("Adoption subscriptions error:", subscriptionsError);
      return res.status(500).json({ error: "SUBSCRIPTIONS_LOAD_FAILED" });
    }

    const devicesByFamily = new Map();

    for (const subscription of subscriptions || []) {
      const familyId = String(subscription.family_id);
      devicesByFamily.set(
        familyId,
        (devicesByFamily.get(familyId) || 0) + 1
      );
    }

    const result = (families || []).map((family) => ({
      familyId: family.id,
      pushDevices: devicesByFamily.get(String(family.id)) || 0,
    }));

    return res.status(200).json({
      success: true,
      totalFamilies: result.length,
      familiesWithPush: result.filter((family) => family.pushDevices > 0).length,
      families: result,
    });
  } catch (error) {
    console.error("Adoption API unexpected error:", error);
    return res.status(500).json({ error: "UNEXPECTED_ERROR" });
  }
};
