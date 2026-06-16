const { createClient } = require("@supabase/supabase-js");
const { Resend } = require("resend");

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.REMINDER_FROM_EMAIL || "ClasseHub <onboarding@resend.dev>";
const publicAppUrl = process.env.PUBLIC_APP_URL || "https://classehub-psi.vercel.app";

function normalizeResponseValue(value) {
  return String(value || "").trim().toLowerCase();
}

function buildReminderCopy({ organizationType, title, accessUrl }) {
  const actionText =
    organizationType === "registration"
      ? "completar la inscripció"
      : "confirmar l'assistència";

  const subject = `Recordatori pendent - ${title}`;

  const text = `Hola!

Tens pendent ${actionText} a:

${title}

Pots respondre directament des d'aquest enllaç:
${accessUrl}

Gràcies!`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <p>Hola!</p>
      <p>Tens pendent ${actionText} a:</p>
      <p><strong>${title}</strong></p>
      <p>
        Pots respondre directament des d'aquest enllaç:<br />
        <a href="${accessUrl}">${accessUrl}</a>
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

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    return res.status(500).json({
      error: "MISSING_SERVER_ENV",
      message: "Missing SUPABASE URL, SUPABASE_SERVICE_ROLE_KEY or RESEND_API_KEY.",
    });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "MISSING_AUTH_TOKEN" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData?.user) {
    return res.status(401).json({ error: "INVALID_AUTH_TOKEN" });
  }

  const { organizationId } = req.body || {};

  if (!organizationId) {
    return res.status(400).json({ error: "MISSING_ORGANIZATION_ID" });
  }

  const { data: organization, error: organizationError } = await supabase
    .from("ch_organizations")
    .select("*")
    .eq("id", Number(organizationId))
    .single();

  if (organizationError || !organization) {
    console.error(organizationError);
    return res.status(404).json({ error: "ORGANIZATION_NOT_FOUND" });
  }

  const { data: classData, error: classError } = await supabase
    .from("ch_classes")
    .select("*")
    .eq("id", organization.class_id)
    .single();

  if (classError || !classData) {
    console.error(classError);
    return res.status(404).json({ error: "CLASS_NOT_FOUND" });
  }

  const eventTitle =
    organization.title
      ?.replace(" - Inscripció", "")
      ?.replace(" - Confirmació", "") || "ClasseHub";

  const { data: participants, error: participantsError } = await supabase
    .from("ch_organization_participants")
    .select("family_id")
    .eq("organization_id", organization.id);

  if (participantsError) {
    console.error(participantsError);
    return res.status(500).json({ error: "PARTICIPANTS_LOAD_FAILED" });
  }

  const participantFamilyIds = (participants || []).map(
    (participant) => participant.family_id
  );

  if (participantFamilyIds.length === 0) {
    return res.status(200).json({
      sent: 0,
      skipped: 0,
      message: "No participants found for this organization.",
    });
  }

  const answeredTable =
    organization.organization_type === "registration"
      ? "ch_organization_registrations"
      : "ch_organization_responses";

  const { data: answeredRows, error: answeredError } = await supabase
    .from(answeredTable)
    .select("family_id")
    .eq("organization_id", organization.id);

  if (answeredError) {
    console.error(answeredError);
    return res.status(500).json({ error: "ANSWERS_LOAD_FAILED" });
  }

  const answeredFamilyIds = new Set(
    (answeredRows || []).map((row) => row.family_id)
  );

  const pendingFamilyIds = participantFamilyIds.filter(
    (familyId) => !answeredFamilyIds.has(familyId)
  );

  if (pendingFamilyIds.length === 0) {
    return res.status(200).json({
      sent: 0,
      skipped: 0,
      message: "No pending families.",
    });
  }

  const { data: families, error: familiesError } = await supabase
    .from("ch_families")
    .select("id, student_name, access_pin")
    .in("id", pendingFamilyIds)
    .eq("is_active", true);

  if (familiesError) {
    console.error(familiesError);
    return res.status(500).json({ error: "FAMILIES_LOAD_FAILED" });
  }

  const { data: contacts, error: contactsError } = await supabase
    .from("ch_family_contacts")
    .select("id, family_id, contact_name, email, wants_email_reminders")
    .in("family_id", pendingFamilyIds)
    .eq("wants_email_reminders", true);

  if (contactsError) {
    console.error(contactsError);
    return res.status(500).json({ error: "CONTACTS_LOAD_FAILED" });
  }

  const familyById = new Map((families || []).map((family) => [family.id, family]));
  const contactIds = (contacts || []).map((contact) => contact.id);

  let alreadySentContactIds = new Set();

  if (contactIds.length > 0) {
    const { data: existingSentLogs, error: existingSentLogsError } = await supabase
      .from("ch_reminder_logs")
      .select("contact_id")
      .eq("organization_id", organization.id)
      .eq("channel", "email")
      .eq("status", "sent")
      .in("contact_id", contactIds);

    if (existingSentLogsError) {
      console.error(existingSentLogsError);
      return res.status(500).json({ error: "REMINDER_LOGS_LOAD_FAILED" });
    }

    alreadySentContactIds = new Set(
      (existingSentLogs || []).map((log) => log.contact_id)
    );
  }

  const resend = new Resend(resendApiKey);

  let sent = 0;
  let skipped = 0;
  let skippedAlreadySent = 0;
  const providerMessageIds = [];
  const errors = [];

  for (const contact of contacts || []) {
    const family = familyById.get(contact.family_id);

    if (!family?.access_pin || !contact.email) {
      skipped += 1;
      continue;
    }

    if (alreadySentContactIds.has(contact.id)) {
      skipped += 1;
      skippedAlreadySent += 1;
      continue;
    }

    const accessUrl = `${publicAppUrl}/classe/${classData.slug}?pin=${family.access_pin}`;
    const { subject, text, html } = buildReminderCopy({
      organizationType: normalizeResponseValue(organization.organization_type),
      title: eventTitle,
      accessUrl,
    });

    try {
      const emailResult = await resend.emails.send({
        from: fromEmail,
        to: contact.email,
        subject,
        text,
        html,
      });

      if (emailResult?.error) {
        throw new Error(
          emailResult.error.message || JSON.stringify(emailResult.error)
        );
      }

      providerMessageIds.push({
        email: contact.email,
        id: emailResult?.data?.id || null,
      });

      await supabase.from("ch_reminder_logs").insert({
        organization_id: organization.id,
        family_id: family.id,
        contact_id: contact.id,
        channel: "email",
        recipient: contact.email,
        status: "sent",
        sent_at: new Date().toISOString(),
      });

      sent += 1;
    } catch (error) {
      console.error(error);

      await supabase.from("ch_reminder_logs").insert({
        organization_id: organization.id,
        family_id: family.id,
        contact_id: contact.id,
        channel: "email",
        recipient: contact.email,
        status: "error",
        error_message: error?.message || "Unknown error",
      });

      errors.push({
        email: contact.email,
        message: error?.message || "Unknown error",
      });
    }
  }

  return res.status(200).json({
    sent,
    skipped,
    skippedAlreadySent,
    pendingFamilies: pendingFamilyIds.length,
    contacts: contacts?.length || 0,
    providerMessageIds,
    errors,
  });
};
