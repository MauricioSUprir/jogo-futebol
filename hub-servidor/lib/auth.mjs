import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const SECRET =
  process.env.SESSION_SECRET || "dev-insecure-secret-troque-em-producao";
const MAX_AGE = 30 * 24 * 3600 * 1000; // 30 dias

export function hashPassword(plain) {
  return bcrypt.hash(String(plain), 10);
}
export function verifyPassword(plain, hash) {
  return bcrypt.compare(String(plain), String(hash || ""));
}

// Cookie de sessão assinado (stateless): base64(payload).hmac
export function makeToken(memberId) {
  const payload = `${memberId}.${Date.now() + MAX_AGE}`;
  const mac = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${mac}`;
}
export function readToken(token) {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const b = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  let payload;
  try { payload = Buffer.from(b, "base64url").toString(); } catch { return null; }
  const expect = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  const a = Buffer.from(mac), e = Buffer.from(expect);
  if (a.length !== e.length || !crypto.timingSafeEqual(a, e)) return null;
  const sep = payload.lastIndexOf(".");
  const memberId = payload.slice(0, sep);
  const exp = Number(payload.slice(sep + 1));
  if (!memberId || !(Date.now() < exp)) return null;
  return memberId;
}
