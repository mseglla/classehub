const { createClient } = require("@supabase/supabase-js");
const { sendEmail } = require("./_lib/send-email");
const { checkEmailRateLimit } = require("./_lib/email-rate-limit");

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const smtpUser = process.env.SMTP_USER;
const smtpPassword = process.env.SMTP_PASSWORD;

const publicAppUrl = process.env.PUBLIC_APP_URL || "https://classehub-psi.vercel.app";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildWelcomeCopy({ childName, className, accessPin, accessUrl }) {
  const subject = `Benvinguts/des a ClasseHub - ${className}`;

  const text = `Hola!

Hem creat l'accés familiar de ${childName} a la classe ${className}.

Podeu accedir a l'agenda de la classe aquí:
${accessUrl}

El vostre PIN familiar és:
${accessPin}

Amb aquest PIN podreu consultar l'agenda, confirmar assistències, inscriure-us a activitats i participar en votacions de classe.

Guardeu aquest correu per si necessiteu recuperar l'accés més endavant.

Gràcies!`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <p>Hola!</p>

      <p>
        Hem creat l'accés familiar de <strong>${escapeHtml(childName)}</strong>
        a la classe <strong>${escapeHtml(className)}</strong>.
      </p>

      <p>
        Podeu accedir a l'agenda de la classe aquí:<br />
        <a href="${escapeHtml(accessUrl)}">${escapeHtml(accessUrl)}</a>
      </p>

      <p>El vostre PIN familiar és:</p>

      <p style="font-size: 24px; font-weight: 700; letter-spacing: 4px; margin: 12px 0;">
        ${escapeHtml(accessPin)}
      </p>

      <p>
        Amb aquest PIN podreu consultar l'agenda, confirmar assistències,
        inscriure-us a activitats i participar en votacions de classe.
      </p>

      <p>
        Guardeu aquest correu per si necessiteu recuperar l'accés més endavant.
      </p>

      <p>Gràcies!</p>
    </div>
  `;

  return { subject, text, html };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  if (!supabaseUrl || !serviceRoleKey || !smtpUser || !smtpPassword) {
    return res.status(500).json({
      error: "MISSING_SERVER_ENV",
      message: "Missing Supabase or SMTP configuration.",
    });
  }

  const { familyId, accessPin } = req.body || {};

  if (!familyId || !accessPin) {
    return res.status(400).json({ error: "MISSING_FAMILY_ACCESS" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const allowed = await checkEmailRateLimit(supabase, req, "welcome_email");

    if (!allowed) {
      return res.status(429).json({ error: "RATE_LIMITED" });
    }
  } catch (error) {
    console.error("Email rate limit failed:", error);
    return res.status(503).json({ error: "RATE_LIMIT_UNAVAILABLE" });
  }

  const { data: family, error: familyError } = await supabase
    .from("ch_families")
    .select("id, class_id, student_name, access_pin, is_active")
    .eq("id", Number(familyId))
    .eq("access_pin", String(accessPin))
    .eq("is_active", true)
    .single();

  if (familyError || !family) {
    console.error(familyError);
    return res.status(404).json({ error: "FAMILY_NOT_FOUND" });
  }

  const { data: classData, error: classError } = await supabase
    .from("ch_classes")
    .select("id, name, slug, school_year")
    .eq("id", family.class_id)
    .single();

  if (classError || !classData) {
    console.error(classError);
    return res.status(404).json({ error: "CLASS_NOT_FOUND" });
  }

  const { data: contacts, error: contactsError } = await supabase
    .from("ch_family_contacts")
    .select("id, contact_name, email")
    .eq("family_id", family.id);

  if (contactsError) {
    console.error(contactsError);
    return res.status(500).json({ error: "CONTACTS_LOAD_FAILED" });
  }

  const recipients = Array.from(
    new Set(
      (contacts || [])
        .map((contact) => String(contact.email || "").trim().toLowerCase())
        .filter(Boolean)
    )
  );

  if (recipients.length === 0) {
    return res.status(200).json({
      sent: 0,
      skipped: 1,
      message: "No email contacts found for this family.",
    });
  }

  const accessUrl = `${publicAppUrl}/classe/${classData.slug}?pin=${family.access_pin}`;

  const { subject, text, html } = buildWelcomeCopy({
    childName: family.student_name,
    className: classData.name,
    accessPin: family.access_pin,
    accessUrl,
  });

  const sent = [];
  const errors = [];

  for (const recipient of recipients) {
    try {
      const emailResult = await sendEmail({
        to: recipient,
        subject,
        text,
        html,
      });

      sent.push({
        email: recipient,
        id: emailResult?.id || null,
      });
    } catch (error) {
      console.error(error);

      errors.push({
        email: recipient,
        message: error?.message || "Unknown error",
      });
    }
  }

  return res.status(200).json({
    sent: sent.length,
    skipped: 0,
    recipients: recipients.length,
    providerMessageIds: sent,
    errors,
  });
};
