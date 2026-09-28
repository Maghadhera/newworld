const { setCors, respond, cleanStr } = require("../lib/http");
const { getCatalogById } = require("../lib/catalog");
const { generateReservationId, saveReservation } = require("../lib/reservations");

const DEPOSIT_RATE = 0.25;
const PHONE_RE = /^(\+?254|0)[17]\d{8}$/;

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return respond(res, 405, false, { message: "Use POST." });

  try {
    const body = req.body || {};
    const fullName = cleanStr(body.full_name, 120);
    const phone = cleanStr(body.phone, 30);
    const email = cleanStr(body.email, 160);
    const visitDate = cleanStr(body.visit_date, 20);
    const visitTime = cleanStr(body.visit_time, 20);
    const partySize = Math.max(1, parseInt(body.party_size, 10) || 1);
    const notes = cleanStr(body.notes, 500);
    const itemsRaw = Array.isArray(body.items) ? body.items : [];

    if (!fullName || !phone || !email || !visitDate || !visitTime) {
      return respond(res, 422, false, { message: "Name, phone, email, date and time are required." });
    }
    if (!PHONE_RE.test(phone.replace(/\s+/g, ""))) {
      return respond(res, 422, false, { message: "Please enter a valid phone number." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return respond(res, 422, false, { message: "Please enter a valid email address — your receipt goes here." });
    }

    const catalog = await getCatalogById();
    const ids = [...new Set(itemsRaw.map((it) => (typeof it === "object" ? it.id : it)).filter((id) => catalog[id]))];

    if (ids.length === 0) {
      return respond(res, 422, false, { message: "Please select at least one product, food item or facility." });
    }

    const lineItems = ids.map((id) => ({ id, name: catalog[id].name, price: catalog[id].price, unit: catalog[id].unit || "" }));
    const total = lineItems.reduce((sum, i) => sum + i.price, 0);
    const deposit = Math.round(total * DEPOSIT_RATE);
    const balance = total - deposit;

    const reservation = {
      reservation_id: generateReservationId(),
      full_name: fullName,
      phone,
      email,
      visit_date: visitDate,
      visit_time: visitTime,
      party_size: partySize,
      notes,
      items: lineItems,
      total_amount: total,
      deposit_amount: deposit,
      balance_amount: balance,
      status: "pending_payment",
      created_at: new Date().toISOString(),
    };

    await saveReservation(reservation);

    respond(res, 200, true, {
      reservation_id: reservation.reservation_id,
      total_amount: total,
      deposit_amount: deposit,
      balance_amount: balance,
      message: "Reservation saved. Proceed to pay your 25% deposit.",
    });
  } catch (err) {
    respond(res, 500, false, { message: err.message });
  }
};
