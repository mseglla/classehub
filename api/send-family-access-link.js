const { createClient } = require("@supabase/supabase-js");
const { Resend } = require("resend");

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail =
  process.env.WELCOME_FROM_EMAIL ||
  process.env.REMINDER_FROM_EMAIL ||
  "ClasseHub <onboarding@resend.dev>";
const publicAppUrl = process.env.PUBLIC_APP_URL || "https://classehub-psi.vercel.app";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildAccessUrl({ classSlug, accessPin, pollId, organizationId }) {
  const url = new URL(`/classe/${classSlug}`, publicAppUrl);
  url.searchParams.set("pin", accessPin);

  if (pollId) {
    url.searchParams.set("poll", String(pollId));
  }

  if (organizationId) {
    url.searchParams.set("org", String(organizationId));
  }

  return url.toString();
}

function buildAccessEmail({ className, familyLinks, pollId }) {
  const subject = pollId
    ? `Enllaç per votar a ClasseHub - ${className}`
    : `Enllaç d'accés a ClasseHub - ${className}`;

  const intro = pollId
    ? "Has demanat rebre l'enllaç per accedir a ClasseHub i votar."
    : "Has demanat rebre l'enllaç d'accés a ClasseHub.";

  const textLinks = familyLinks
    .map(
      (familyLink) => `Família de ${familyLink.childName}
Enllaç: ${familyLink.accessUrl}
PIN: ${familyLink.accessPin}`
    )
    .join("\n\n");

  const text = `Hola!

${intro}

${textLinks}

Si no has demanat aquest correu, pots ignorar-lo.

Gràcies!`;

  const htmlLinks = familyLinks
    .map(
      (familyLink) => `
        <div style="padding: 14px; border: 1px solid #e5e7eb; border-radius: 12px; margin: 12px 0;">
          <p style="margin: 0 0 8px;">
            <strong>Família de ${escapeHtml(familyLink.childName)}</strong>
          </p>

          <p style="margin: 0 0 8px;">
            <a href="${escapeHtml(familyLink.accessUrl)}">${escapeHtml(familyLink.accessUrl)}</a>
          </p>

          <p style="margin: 0;">
            PIN familiar:
            <strong style="font-size: 18px; letter-spacing: 3px;">${escapeHtml(familyLink.accessPin)}</strong>
          </p>
        </div>
      `
    )
    .join("");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <p>Hola!</p>

      <p>${escapeHtml(intro)}</p>

      ${htmlLinks}

      <p>Si no has demanat aquest correu, pots ignorar-lo.</p>

      <p>Gràcies!</p>
    </div>
  `;

  return { subject, text, html };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    return res.status(500).json({
      error: "MISSING_SERVER_ENV",
      message: "Missing SUPABASE URL, SUPABASE_SERVICE_ROLE_KEY or RESEND_API_KEY.",
    });
  }

  const { classSlug, email, pollId, organizationId } = req.body || {};
  const cleanClassSlug = String(classSlug || "").trim().toLowerCase();
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanPollId = pollId ? Number(pollId) : null;
  const cleanOrganizationId = organizationId ? Number(organizationId) : null;

  if (!cleanClassSlug || !cleanEmail) {
    return res.status(400).json({ error: "MISSING_REQUIRED_FIELDS" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const genericResponse = {
    ok: true,
    message: "If this email is registered, an access link will be sent.",
  };

  const { data: classData, error: classError } = await supabase
    .from("ch_classes")
    .select("id, name, slug, school_year")
    .eq("slug", cleanClassSlug)
    .eq("is_active", true)
    .single();

  if (classError || !classData) {
    console.error(classError);
    return res.status(200).json(genericResponse);
  }

  const { data: contacts, error: contactsError } = await supabase
    .from("ch_family_contacts")
    .select("family_id, email")
    .ilike("email", cleanEmail);

  if (contactsError) {
    console.error(contactsError);
    return res.status(200).json(genericResponse);
  }

  const familyIds = Array.from(
    new Set((contacts || []).map((contact) => contact.family_id).filter(Boolean))
  );

  if (familyIds.length === 0) {
    return res.status(200).json(genericResponse);
  }

  const { data: families, error: familiesError } = await supabase
    .from("ch_families")
    .select("id, class_id, student_name, access_pin, is_active")
    .in("id", familyIds)
    .eq("class_id", classData.id)
    .eq("is_active", true);

  if (familiesError) {
    console.error(familiesError);
    return res.status(200).json(genericResponse);
  }

  const familyLinks = (families || [])
    .filter((family) => family.access_pin)
    .map((family) => ({
      childName: family.student_name,
      accessPin: family.access_pin,
      accessUrl: buildAccessUrl({
        classSlug: classData.slug,
        accessPin: family.access_pin,
        pollId: cleanPollId,
        organizationId: cleanOrganizationId,
      }),
    }));

  if (familyLinks.length === 0) {
    return res.status(200).json(genericResponse);
  }

  const { subject, text, html } = buildAccessEmail({
    className: classData.name,
    familyLinks,
    pollId: cleanPollId,
  });

  try {
    const resend = new Resend(resendApiKey);

    const emailResult = await resend.emails.send({
      from: fromEmail,
      to: cleanEmail,
      subject,
      text,
      html,
    });

    if (emailResult?.error) {
      throw new Error(emailResult.error.message || JSON.stringify(emailResult.error));
    }
  } catch (error) {
    console.error(error);
  }

  return res.status(200).json(genericResponse);
};
