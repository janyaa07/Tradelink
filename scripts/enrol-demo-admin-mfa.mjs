// Enrols the demo admin in two-factor sign-in (TOTP) so the shared demo account stays usable.
// The secret is printed once so it can be recorded in docs/USER_GUIDE.md for demo users.
// Usage: node --experimental-websocket scripts/enrol-demo-admin-mfa.mjs <email> <password> [current-secret]
// Pass the current secret to rotate: the old factor is removed (which needs a two-factor session)
// and a new one is enrolled. Never run this for a real admin account: a shared secret defeats
// two-factor sign-in.
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const [email, password, currentSecret] = process.argv.slice(2);
if (!url || !key || !email || !password) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and pass <email> <password>.");
  process.exit(1);
}

function base32Decode(text) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of text.replace(/=+$/, "").toUpperCase()) {
    const value = alphabet.indexOf(char);
    if (value < 0) throw new Error("Invalid base32 secret");
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}

/** RFC 6238 time-based one-time code: 6 digits, 30-second step, HMAC-SHA1. */
function totp(secret, now = Date.now()) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)));
  const digest = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, "0");
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const signIn = await supabase.auth.signInWithPassword({ email, password });
if (signIn.error) throw new Error(`Sign-in failed: ${signIn.error.message}`);

const factors = await supabase.auth.mfa.listFactors();
if (factors.error) throw new Error(factors.error.message);
for (const factor of factors.data.all) {
  if (factor.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
}
const verifiedFactors = factors.data.totp.filter((factor) => factor.status === "verified");
if (verifiedFactors.length > 0 && !currentSecret) {
  console.log("A verified authenticator factor already exists. Pass the current secret to rotate it.");
  process.exit(0);
}
for (const factor of verifiedFactors) {
  const stepUp = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: totp(currentSecret) });
  if (stepUp.error) throw new Error(`Could not verify the current secret: ${stepUp.error.message}`);
  const removed = await supabase.auth.mfa.unenroll({ factorId: factor.id });
  if (removed.error) throw new Error(`Could not remove the old factor: ${removed.error.message}`);
}

const enrolled = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Demo authenticator" });
if (enrolled.error) throw new Error(`Enrol failed: ${enrolled.error.message}`);
const verified = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolled.data.id, code: totp(enrolled.data.totp.secret) });
if (verified.error) throw new Error(`Verify failed: ${verified.error.message}`);
console.log(`Enrolled ${email}. Demo authenticator secret: ${enrolled.data.totp.secret}`);
