const { setCors, respond } = require("../lib/http");
const { getCatalog } = require("../lib/catalog");

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const items = await getCatalog();
    respond(res, 200, true, { items });
  } catch (err) {
    respond(res, 500, false, { message: err.message });
  }
};
