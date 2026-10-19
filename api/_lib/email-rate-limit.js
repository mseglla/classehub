const crypto = require("node:crypto");

function getIpHash(req) {
  const secret = process.env.PUSH_RATE_LIMIT_SECRET;

  if (!secret) {
    throw new Error("MISSING_RATE_LIMIT_SECRET");
  }

  const ip = String(
    req.headers["x-vercel-forwarded-for"] ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  ).split(",")[0].trim();

  return crypto
    .createHmac("sha256", secret)
    .update(ip)
    .digest("hex");
}

async function checkEmailRateLimit(supabase, req, action) {
  const { data: allowed, error } = await supabase.rpc(
    "check_push_rate_limit",
    {
      p_action: action,
      p_ip_hash: getIpHash(req),
    }
  );

  if (error) {
    throw error;
  }

  return allowed === true;
}

module.exports = { checkEmailRateLimit };
