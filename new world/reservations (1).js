/**
 * lib/reservations.js
 * Each reservation is stored as its own Redis key. A second index key maps
 * a payment reference back to its reservation ID, so the Payzaapi webhook
 * (which only knows the payment reference) can find the right reservation
 * in one lookup instead of scanning everything.
 */

const crypto = require("crypto");
const { redisGetJSON, redisSetJSON, redisCommand } = require("./redis");

function reservationKey(id) {
  return `sypher:reservation:${id}`;
}
function paymentRefKey(ref) {
  return `sypher:paymentref:${ref}`;
}

function generateReservationId() {
  const date = new Date();
  const ymd = date.toISOString().slice(2, 10).replace(/-/g, "");
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `SYP-${ymd}-${rand}`;
}

async function saveReservation(reservation) {
  await redisSetJSON(reservationKey(reservation.reservation_id), reservation);
}

async function getReservation(id) {
  return redisGetJSON(reservationKey(id), null);
}

async function linkPaymentRef(ref, reservationId) {
  await redisCommand("SET", paymentRefKey(ref), reservationId);
}

async function getReservationIdByPaymentRef(ref) {
  return redisCommand("GET", paymentRefKey(ref));
}

module.exports = {
  generateReservationId,
  saveReservation,
  getReservation,
  linkPaymentRef,
  getReservationIdByPaymentRef,
};
