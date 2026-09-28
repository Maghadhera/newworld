const { setCors, respond } = require("../../lib/http");
const { isAdminRequest } = require("../../lib/auth");
const { getCatalog, saveCatalog } = require("../../lib/catalog");

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return respond(res, 405, false, { message: "Use POST." });

  if (!isAdminRequest(req)) {
    return respond(res, 401, false, { message: "Not logged in." });
  }

  try {
    const prices = (req.body || {}).prices || {}; // { itemId: newPrice }
    const catalog = await getCatalog();

    for (const item of catalog) {
      if (Object.prototype.hasOwnProperty.call(prices, item.id)) {
        const newPrice = parseInt(String(prices[item.id]).replace(/[^\d]/g, ""), 10);
        if (Number.isFinite(newPrice) && newPrice > 0) {
          item.price = newPrice;
        }
      }
    }

    await saveCatalog(catalog);
    respond(res, 200, true, { items: catalog });
  } catch (err) {
    respond(res, 500, false, { message: err.message });
  }
};
