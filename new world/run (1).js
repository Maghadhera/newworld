// Local-only test harness — NOT shipped to the user. Mocks the Upstash REST
// API in-memory so we can exercise the real handler code without hitting a
// real Redis instance (this sandbox can't reach upstash.io anyway).

process.env.UPSTASH_REDIS_REST_URL = "http://fake-upstash.test";
process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
process.env.ADMIN_SESSION_SECRET = "test-secret-please-ignore";

const store = new Map();
const realFetch = global.fetch;

global.fetch = async (url, opts) => {
  if (url === process.env.UPSTASH_REDIS_REST_URL) {
    const args = JSON.parse(opts.body);
    const [cmd, key, val] = args;
    let result = null;
    if (cmd === "GET") result = store.has(key) ? store.get(key) : null;
    else if (cmd === "SET") { store.set(key, val); result = "OK"; }
    else if (cmd === "DEL") { result = store.delete(key) ? 1 : 0; }
    else throw new Error("Unsupported mock command: " + cmd);
    return {
      ok: true,
      status: 200,
      json: async () => ({ result }),
      text: async () => JSON.stringify({ result }),
    };
  }
  return realFetch(url, opts);
};

function fakeReq({ method = "GET", body = {}, headers = {} } = {}) {
  return { method, body, headers };
}

function fakeRes() {
  const res = {
    _status: 200,
    _json: null,
    _headers: {},
    status(code) { this._status = code; return this; },
    json(payload) { this._json = payload; return this; },
    setHeader(name, val) { this._headers[name] = val; return this; },
    end() { return this; },
  };
  return res;
}

function assert(cond, msg) {
  if (!cond) { console.error("FAIL:", msg); process.exitCode = 1; }
  else console.log("ok  -", msg);
}

(async () => {
  const auth = require("../lib/auth");
  const catalogApi = require("../api/catalog");
  const reserveApi = require("../api/reserve");
  const paymentApi = require("../api/payment");
  const callbackApi = require("../api/payzaapi-callback");
  const loginApi = require("../api/admin/login");
  const sessionApi = require("../api/admin/session");
  const savePricesApi = require("../api/admin/save-prices");

  process.env.ADMIN_PASSWORD_HASH = auth.hashPassword("sypher-admin-2026");

  // --- catalog.js: should auto-seed and return 14 items ---
  let res = fakeRes();
  await catalogApi(fakeReq(), res);
  assert(res._json.success === true, "catalog: success");
  assert(res._json.items.length === 14, "catalog: seeded 14 items, got " + res._json.items.length);
  assert(res._json.items[0].id === "coffee-cup" && res._json.items[0].price === 250, "catalog: coffee-cup default price 250");

  // --- reserve.js: bad email rejected ---
  res = fakeRes();
  await reserveApi(fakeReq({ method: "POST", body: { full_name: "T", phone: "0712345678", email: "bad", visit_date: "2026-10-01", visit_time: "11:00", items: [{ id: "pool" }] } }), res);
  assert(res._json.success === false, "reserve: bad email rejected");

  // --- reserve.js: valid reservation ---
  res = fakeRes();
  await reserveApi(fakeReq({ method: "POST", body: {
    full_name: "Brian Otieno", phone: "0712345678", email: "brian@example.com",
    visit_date: "2026-10-01", visit_time: "11:00", party_size: 2,
    items: [{ id: "coffee-cup" }, { id: "classic-burger" }, { id: "pool" }],
  } }), res);
  assert(res._json.success === true, "reserve: valid reservation accepted");
  assert(res._json.total_amount === 250 + 650 + 800, "reserve: total computed server-side, got " + res._json.total_amount);
  assert(res._json.deposit_amount === Math.round((250 + 650 + 800) * 0.25), "reserve: 25% deposit correct");
  const reservationId = res._json.reservation_id;
  console.log("    reservation_id =", reservationId);

  // --- payment.js: demo mode (no Payzaapi env vars set) ---
  res = fakeRes();
  await paymentApi(fakeReq({ method: "POST", body: { reservation_id: reservationId, phone: "0712345678", email: "brian@example.com" } }), res);
  assert(res._json.success === true, "payment: demo mode succeeds");
  assert(res._json.simulated === true, "payment: flagged as simulated");
  const paymentRef = res._json.reference;
  console.log("    payment_ref =", paymentRef);

  // --- payzaapi-callback.js: simulate a successful webhook ---
  res = fakeRes();
  await callbackApi(fakeReq({ method: "POST", body: { payment_ref: paymentRef, status: "success", receipt_number: "TESTRCPT123" } }), res);
  assert(res._json.success === true, "callback: webhook accepted");

  const { getReservation } = require("../lib/reservations");
  const updated = await getReservation(reservationId);
  assert(updated.status === "deposit_paid", "callback: reservation marked deposit_paid, got " + updated.status);
  assert(updated.payment_receipt === "TESTRCPT123", "callback: receipt number stored");

  // --- admin login: wrong password ---
  res = fakeRes();
  await loginApi(fakeReq({ method: "POST", body: { password: "wrong" } }), res);
  assert(res._json.success === false, "admin login: wrong password rejected");

  // --- admin login: correct password, cookie issued ---
  res = fakeRes();
  await loginApi(fakeReq({ method: "POST", body: { password: "sypher-admin-2026" } }), res);
  assert(res._json.success === true, "admin login: correct password accepted");
  const setCookieHeader = res._headers["Set-Cookie"];
  assert(!!setCookieHeader, "admin login: Set-Cookie header present");
  const cookieToken = setCookieHeader.split(";")[0].split("=")[1];

  // --- admin session: recognizes the issued cookie ---
  res = fakeRes();
  await sessionApi(fakeReq({ headers: { cookie: `admin_session=${cookieToken}` } }), res);
  assert(res._json.logged_in === true, "admin session: cookie recognized as logged in");

  // --- admin session: no cookie -> not logged in ---
  res = fakeRes();
  await sessionApi(fakeReq({ headers: {} }), res);
  assert(res._json.logged_in === false, "admin session: no cookie -> not logged in");

  // --- save-prices: rejected without auth ---
  res = fakeRes();
  await savePricesApi(fakeReq({ method: "POST", body: { prices: { "coffee-cup": 999 } }, headers: {} }), res);
  assert(res._json.success === false, "save-prices: rejected without session cookie");

  // --- save-prices: accepted with auth, propagates to catalog.js ---
  res = fakeRes();
  await savePricesApi(fakeReq({ method: "POST", body: { prices: { "coffee-cup": 300 } }, headers: { cookie: `admin_session=${cookieToken}` } }), res);
  assert(res._json.success === true, "save-prices: accepted with valid session");

  res = fakeRes();
  await catalogApi(fakeReq(), res);
  const coffeeCup = res._json.items.find((i) => i.id === "coffee-cup");
  assert(coffeeCup.price === 300, "catalog: price change propagated, got " + coffeeCup.price);

  console.log("\nAll checks ran. Exit code:", process.exitCode || 0);
})();
