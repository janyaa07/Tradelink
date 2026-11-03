import { describe, expect, it } from "vitest";
import { urlBase64ToUint8Array } from "./push";

describe("urlBase64ToUint8Array", () => {
  it("decodes base64url without padding", () => {
    // "hello?>" in base64 is "aGVsbG8/Pg==", which base64url writes as "aGVsbG8_Pg".
    expect([...urlBase64ToUint8Array("aGVsbG8_Pg")]).toEqual([...Buffer.from("hello?>")]);
  });

  it("decodes the - and _ alphabet", () => {
    expect([...urlBase64ToUint8Array("-_8")]).toEqual([0xfb, 0xff]);
  });

  it("returns 65 bytes for an uncompressed P-256 VAPID key", () => {
    const key = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 7)]).toString("base64url");
    const bytes = urlBase64ToUint8Array(key);
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(4);
  });
});
