const nodemailer = require("nodemailer");

let transporter;

function getTransporter() {
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;

  if (!user || !password) {
    throw new Error("Falten SMTP_USER o SMTP_PASSWORD");
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: {
        user,
        pass: password.replace(/\s/g, ""),
      },
    });
  }

  return transporter;
}

async function sendEmail({ to, subject, text, html }) {
  const user = process.env.SMTP_USER;

  const result = await getTransporter().sendMail({
    from: `"ClasseHub" <${user}>`,
    to,
    subject,
    text,
    html,
  });

  if (!result.accepted?.includes(to)) {
    throw new Error("El servidor SMTP no ha acceptat el destinatari");
  }

  return { id: result.messageId };
}

module.exports = { sendEmail };
