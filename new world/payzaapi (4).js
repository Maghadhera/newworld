/**
 * lib/payzaapi.js
 *
 * Placeholder shell for payzaapi.co.ke, same as the PHP version — not wired
 * to a real endpoint yet because the actual API contract (base URL, auth
 * scheme, request/response fields, webhook format) isn't available.
 *
 * Once you have Payzaapi's API reference, fill in initiateCharge() below.
 * Needed from their docs:
 *   1. Auth — API key header, Bearer token, or signed request.
 *   2. Endpoint — the real charge/checkout URL.
 *   3. Request fields — amount, phone/email, a reference (use reservation_id),
 *      and a callback/webhook URL for payment result notifications.
 *   4. Response — the transaction/reference ID to store and match on webhook.
 */

async function initiateCharge({ apiKey, baseUrl, reference, amount, customerRef, callbackUrl }) {
  // --- TODO: replace with the real Payzaapi endpoint once you have it ---
  throw new Error(
    "Payzaapi is not connected yet — share the API docs (base URL, auth, charge endpoint, " +
    "request/response fields) and this function gets filled in."
  );

  /* Once you have the docs, it will look roughly like this — adjust field
   * names to match their actual API:
   *
   * const res = await fetch(`${baseUrl}/v1/charges`, { // real path from docs
   *   method: "POST",
   *   headers: {
   *     Authorization: `Bearer ${apiKey}`, // or X-API-Key, per docs
   *     "Content-Type": "application/json",
   *   },
   *   body: JSON.stringify({
   *     reference,
   *     amount,
   *     customer: customerRef,
   *     callback_url: callbackUrl,
   *   }),
   * });
   * const data = await res.json();
   * if (!data.success) throw new Error("Payzaapi charge failed: " + JSON.stringify(data));
   * return data;
   */
}

module.exports = { initiateCharge };
