import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./crypto";

const key = randomBytes(32).toString("base64");

describe("crypto", () => {
  it("round-trips", () => {
    expect(decrypt(encrypt("refresh-token", key), key)).toBe("refresh-token");
  });
  it("uses a fresh IV each time", () => {
    expect(encrypt("x", key)).not.toBe(encrypt("x", key));
  });
  it("rejects tampering and wrong keys", () => {
    const enc = encrypt("secret", key);
    const parts = enc.split(":");
    parts[3] = Buffer.from("tampered").toString("base64");
    expect(() => decrypt(parts.join(":"), key)).toThrow();
    expect(() => decrypt(enc, randomBytes(32).toString("base64"))).toThrow();
  });
  it("rejects bad key length", () => {
    expect(() => encrypt("x", "short")).toThrow(/32 bytes/);
  });
});
