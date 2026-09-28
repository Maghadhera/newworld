const { setCors, respond, cleanStr } = require("../../lib/http");
const { verifyPassword, signSession, SESSION_COOKIE } = require("../../lib/auth");

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return respond(res, 405, false, { message: "Use POST." });

  try {
    const password = cleanStr((req.body || {}).password, 200);
    const stored = process.env.ADMIN_PASSWORD_HASH;

    if (!stored) {
      return respond(res, 500, false, { message: "ADMIN_PASSWORD_HASH is not set on the server — see README.md." });
    }
    if (!password || !verifyPassword(password, stored)) {
      return respond(res, 401, false, { message: "Incorrect password." });
    }

    const token = signSession();
    res.setHeader(
      "Set-Cookie",
      `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`
    );
    respond(res, 200, true, {});
  } catch (err) {
    respond(res, 500, false, { message: err.message });
  }
};
