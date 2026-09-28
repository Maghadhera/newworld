const { setCors, respond } = require("../../lib/http");
const { isAdminRequest } = require("../../lib/auth");

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  respond(res, 200, true, { logged_in: isAdminRequest(req) });
};
