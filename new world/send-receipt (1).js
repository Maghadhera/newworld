/**
 * lib/send-receipt.js
 * Sends the reservation receipt using Resend (https://resend.com) — a
 * simple REST API, no SMTP setup, generous free tier. Swap the fetch call
 * below for SendGrid/Mailgun/etc. if you already use one; the function
 * signature stays the same either way.
 *
 * Needs RESEND_API_KEY and RESEND_FROM_EMAIL env vars. Without them, this
 * logs the receipt instead of sending it, so the payment flow still works
 * during development.
 */

function receiptHTML(reservation) {
  const itemRows = reservation.items
    .map(
      (item) =>
        `<tr><td style="padding:6px 10px;border-bottom:1px solid #E7DACB;">${item.name}</td>` +
        `<td style="padding:6px 10px;border-bottom:1px solid #E7DACB;text-align:right;">KSh ${Number(item.price).toLocaleString()}</td></tr>`
    )
    .join("");

  return `
  <div style="font-family:Arial,sans-serif;color:#2A2019;max-width:520px;margin:0 auto;">
    <h2 style="color:#5B3A21;">Sypher Coffee Joint</h2>
    <p>Hi ${reservation.full_name},</p>
    <p>Your deposit has been received and your table is reserved. Here are your details:</p>
    <p style="font-size:14px;color:#6E5F51;">
      Reservation ref: <strong>${reservation.reservation_id}</strong><br>
      Visit date: ${reservation.visit_date} at ${reservation.visit_time}<br>
      Party size: ${reservation.party_size}
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">${itemRows}</table>
    <p style="font-size:14px;">
      Total: <strong>KSh ${Number(reservation.total_amount).toLocaleString()}</strong><br>
      Paid now (25% deposit): <strong>KSh ${Number(reservation.deposit_amount).toLocaleString()}</strong><br>
      Balance due on your visit day: <strong>KSh ${Number(reservation.balance_amount).toLocaleString()}</strong>
    </p>
    <p style="font-size:13px;color:#6E5F51;">See you soon at Sypher Coffee Joint! Questions? WhatsApp us at +254 703 942 775.</p>
  </div>`;
}

async function sendReservationReceipt(reservation) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    console.log(`[DEMO MODE — RESEND_API_KEY/RESEND_FROM_EMAIL not set] Would email receipt to ${reservation.email} for ${reservation.reservation_id}`);
    return { simulated: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: reservation.email,
      subject: `Your Sypher Coffee Joint reservation receipt — ${reservation.reservation_id}`,
      html: receiptHTML(reservation),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend send failed (${res.status}): ${text}`);
  }
  return res.json();
}

module.exports = { sendReservationReceipt };
