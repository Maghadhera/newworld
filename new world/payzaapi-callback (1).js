/**
 * api/payzaapi-callback.js
 * Point your PAYZAAPI_CALLBACK_URL env var at this function's public URL,
 * e.g. https://yourdomain.vercel.app/api/payzaapi-callback
 *
 * NOTE: the field names read below (payment_ref/reference, status,
 * receipt_number/transaction_id) are placeholders — once you have
 * Payzaapi's real webhook payload format, update the block marked below.
 */

const { setCors, respond } = require("../lib/http");
const { getReservationIdByPaymentRef, getReservation, saveReservation } = require("../lib/reservations");
const { sendReservationReceipt } = require("../lib/send-receipt");

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const payload = req.body || {};

    // --- TODO: adjust these field names to match Payzaapi's real webhook payload ---
    const paymentRef = payload.payment_ref || payload.reference || null;
    const isSuccess = payload.status === "success" || payload.status === "completed";
    const receiptNo = payload.receipt_number || payload.transaction_id || null;
    // ----------------------------------------------------------------------------------

    if (paymentRef) {
      const reservationId = await getReservationIdByPaymentRef(paymentRef);
      if (reservationId) {
        const reservation = await getReservation(reservationId);
        if (reservation) {
          if (isSuccess) {
            reservation.status = "deposit_paid";
            reservation.payment_receipt = receiptNo;
            await saveReservation(reservation);
            await sendReservationReceipt(reservation);
          } else {
            reservation.status = "payment_failed";
            await saveReservation(reservation);
          }
        }
      }
    }

    respond(res, 200, true, { received: true });
  } catch (err) {
    // Still return 200 where possible so the payment provider doesn't retry
    // indefinitely on a bug on our side — but log it for you to see.
    console.error("payzaapi-callback error:", err);
    respond(res, 200, true, { received: true, logged_error: err.message });
  }
};
