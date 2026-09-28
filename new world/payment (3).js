const { setCors, respond, cleanStr } = require("../lib/http");
const { getReservation, saveReservation, linkPaymentRef } = require("../lib/reservations");
const payzaapi = require("../lib/payzaapi");
const crypto = require("crypto");

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return respond(res, 405, false, { message: "Use POST." });

  try {
    const body = req.body || {};
    const reservationId = cleanStr(body.reservation_id, 40);
    const phone = cleanStr(body.phone, 30);
    const email = cleanStr(body.email, 160);

    if (!reservationId) return respond(res, 422, false, { message: "Missing reservation reference." });

    const reservation = await getReservation(reservationId);
    if (!reservation) return respond(res, 404, false, { message: "Reservation not found." });

    const deposit = reservation.deposit_amount;

    const apiKey = process.env.PAYZAAPI_API_KEY;
    const baseUrl = process.env.PAYZAAPI_BASE_URL;
    const callbackUrl = process.env.PAYZAAPI_CALLBACK_URL;

    if (!apiKey || !baseUrl || !callbackUrl) {
      // Payzaapi not configured yet — simulate so the front end keeps working.
      const reference = "SIM-PAYZAAPI-" + crypto.randomBytes(4).toString("hex").toUpperCase();
      reservation.status = "awaiting_payment_confirmation";
      reservation.payment_ref = reference;
      await saveReservation(reservation);
      await linkPaymentRef(reference, reservationId);

      return respond(res, 200, true, {
        reference,
        simulated: true,
        message: `[DEMO MODE — Payzaapi not yet connected, see lib/payzaapi.js] Deposit request of KSh ${deposit.toLocaleString()} simulated.`,
      });
    }

    const charge = await payzaapi.initiateCharge({
      apiKey,
      baseUrl,
      reference: reservationId,
      amount: deposit,
      customerRef: phone || email,
      callbackUrl,
    });

    const paymentRef = charge.reference || charge.transaction_id;
    reservation.status = "awaiting_payment_confirmation";
    reservation.payment_ref = paymentRef;
    await saveReservation(reservation);
    if (paymentRef) await linkPaymentRef(paymentRef, reservationId);

    respond(res, 200, true, {
      message: `Deposit request of KSh ${deposit.toLocaleString()} sent via Payzaapi.`,
      raw: charge,
    });
  } catch (err) {
    respond(res, 502, false, { message: "Could not start payment: " + err.message });
  }
};
