import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM. Format: v1:<iv>:<tag>:<ciphertext>, each base64.

function keyBytes(keyB64: string): Buffer {
  const k = Buffer.from(keyB64, "base64");
  if (k.length !== 32)
    throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  return k;
}

export function encrypt(plain: string, keyB64: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keyBytes(keyB64), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [
    "v1",
    iv.toString("base64"),
    c.getAuthTag().toString("base64"),
    ct.toString("base64"),
  ].join(":");
}

export function decrypt(payload: string, keyB64: string): string {
  const [v, iv, tag, ct] = payload.split(":");
  if (v !== "v1" || !iv || !tag || !ct)
    throw new Error("Unrecognized ciphertext format");
  const d = createDecipheriv(
    "aes-256-gcm",
    keyBytes(keyB64),
    Buffer.from(iv, "base64"),
  );
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    d.update(Buffer.from(ct, "base64")),
    d.final(),
  ]).toString("utf8");
}
