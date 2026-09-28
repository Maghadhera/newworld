/**
 * lib/http.js
 * Shared response helpers so every API function replies the same way.
 */

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function respond(res, statusCode, success, extra = {}) {
  res.status(statusCode).json({ success, ...extra });
}

function cleanStr(val, maxLen = 255) {
  const s = typeof val === "string" ? val.trim() : "";
  return s.slice(0, maxLen);
}

module.exports = { setCors, respond, cleanStr };
