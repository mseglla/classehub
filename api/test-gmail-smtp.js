const { sendEmail } = require("./_lib/send-email");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  // Només s'habilita temporalment a Preview.
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.SMTP_USER?.toLowerCase() !== "classehub.app@gmail.com"
  ) {
    return res.status(403).json({ error: "TEST_DISABLED" });
  }

  const auth = req.headers.authorization || "";
  const expected = process.env.SMTP_TEST_TOKEN;

  if (!expected || auth !== `Bearer ${expected}`) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }

  try {
    const result = await sendEmail({
      to: "classehub.app@gmail.com",
      subject: "Prova Gmail SMTP - ClasseHub",
      text: "Si has rebut aquest correu, Gmail SMTP funciona correctament a ClasseHub.",
    });

    return res.status(200).json({
      ok: true,
      message: "Correu acceptat pel servidor SMTP.",
      messageId: result.id,
    });
  } catch (error) {
    console.error("SMTP test failed:", error.message);

    return res.status(500).json({
      ok: false,
      error: "SMTP_SEND_FAILED",
      message: "L'enviament ha fallat. Consulta els logs de Vercel.",
    });
  }
};
