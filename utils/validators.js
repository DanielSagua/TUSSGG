function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function toNullableTrimmed(v) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
}

function toIntOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n)) return null;
  return n;
}

function toDecimalOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (Number.isNaN(n)) return null;
  return n;
}

function clampString(v, max) {
  if (!isNonEmptyString(v)) return v;
  return v.trim().slice(0, max);
}

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const e = email.trim();
  if (!e) return false;
  // Simple pero práctico para validación frontend/back
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

module.exports = {
  isNonEmptyString,
  toNullableTrimmed,
  toIntOrNull,
  toDecimalOrNull,
  clampString,
  isValidEmail
};
