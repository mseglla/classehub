const { createClient } = require("@supabase/supabase-js");
const { Resend } = require("resend");

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.REMINDER_FROM_EMAIL || "ClasseHub <onboarding@resend.dev>";
const publicAppUrl = process.env.PUBLIC_APP_URL || "https://classehub-psi.vercel.app";

function buildPollReminderCopy({ question, accessUrl }) {
  const subject = `Recordatori de votació - ${question}`;

  const text = `Hola!

Tens pendent respondre aquesta votació:

${question}

Pots votar directament des d'aquest enllaç:
${accessUrl}

Gràcies!`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <p>Hola!</p>

      <p>Tens pendent respondre aquesta votació:</p>

      <p><strong>${question}</strong></p>

      <p>
        Pots votar directament des d'aquest enllaç:<br />
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

  const { pollId } = req.body || {};

  if (!pollId) {
    return res.status(400).json({ error: "MISSING_POLL_ID" });
  }

  const { data: poll, error: pollError } = await supabase
    .from("ch_polls")
    .select("*")
    .eq("id", Number(pollId))
    .single();

  if (pollError || !poll) {
    console.error(pollError);
    return res.status(404).json({ error: "POLL_NOT_FOUND" });
  }

  const { data: classData, error: classError } = await supabase
    .from("ch_classes")
    .select("*")
    .eq("id", poll.class_id)
    .single();

  if (classError || !classData) {
    console.error(classError);
    return res.status(404).json({ error: "CLASS_NOT_FOUND" });
  }

  const { data: families, error: familiesError } = await supabase
    .from("ch_families")
    .select("id, student_name, access_pin")
    .eq("class_id", poll.class_id)
    .eq("is_active", true);

  if (familiesError) {
    console.error(familiesError);
    return res.status(500).json({ error: "FAMILIES_LOAD_FAILED" });
  }

  const { data: votes, error: votesError } = await supabase
    .from("ch_poll_votes")
    .select("family_id")
    .eq("poll_id", poll.id);

  if (votesError) {
    console.error(votesError);
    return res.status(500).json({ error: "VOTES_LOAD_FAILED" });
  }

  const votedFamilyIds = new Set((votes || []).map((vote) => vote.family_id));

  const pendingFamilies = (families || []).filter(
    (family) => !votedFamilyIds.has(family.id)
  );

  if (pendingFamilies.length === 0) {
    return res.status(200).json({
      sent: 0,
      skipped: 0,
      pendingFamilies: 0,
      message: "No pending families.",
    });
  }

  const pendingFamilyIds = pendingFamilies.map((family) => family.id);

  const { data: contacts, error: contactsError } = await supabase
    .from("ch_family_contacts")
    .select("id, family_id, contact_name, email, wants_email_reminders")
    .in("family_id", pendingFamilyIds)
    .eq("wants_email_reminders", true);

  if (contactsError) {
    console.error(contactsError);
    return res.status(500).json({ error: "CONTACTS_LOAD_FAILED" });
  }

  const familyById = new Map(pendingFamilies.map((family) => [family.id, family]));
  const resend = new Resend(resendApiKey);

  let sent = 0;
  let skipped = 0;
  const sentFamilyIds = new Set();
  const providerMessageIds = [];
  const errors = [];

  for (const contact of contacts || []) {
    const family = familyById.get(contact.family_id);

    if (!family?.access_pin || !contact.email) {
      skipped += 1;
      continue;
    }

    const accessUrl = `${publicAppUrl}/classe/${classData.slug}?pin=${family.access_pin}&poll=${poll.id}`;

    const { subject, text, html } = buildPollReminderCopy({
      question: poll.question,
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
        throw new Error(emailResult.error.message || JSON.stringify(emailResult.error));
      }

      providerMessageIds.push({
        email: contact.email,
        id: emailResult?.data?.id || null,
      });

      sent += 1;
      sentFamilyIds.add(family.id);
    } catch (error) {
      console.error(error);

      errors.push({
        email: contact.email,
        message: error?.message || "Unknown error",
      });
    }
  }

  return res.status(200).json({
    sent,
    skipped,
    pendingFamilies: pendingFamilies.length,
    contacts: contacts?.length || 0,
    sentFamilies: sentFamilyIds.size,
    providerMessageIds,
    errors,
  });
};
