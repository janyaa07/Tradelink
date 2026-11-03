import { describe, expect, it } from "vitest";
import { parseOrigin, requestOrigin, resolveOrigin } from "./origin";

describe("resolveOrigin with NEXT_PUBLIC_SITE_URL set", () => {
  const siteUrl = "https://tradelink.example/";

  it("uses the configured origin when the request matches", () => {
    expect(resolveOrigin({ forwardedProto: "https", host: "tradelink.example", siteUrl })).toBe("https://tradelink.example");
  });

  it("ignores a spoofed Host header", () => {
    expect(resolveOrigin({ forwardedProto: "https", host: "evil.test", siteUrl })).toBe("https://tradelink.example");
  });

  it("ignores a downgraded protocol", () => {
    expect(resolveOrigin({ forwardedProto: "http", host: "tradelink.example", siteUrl })).toBe("https://tradelink.example");
  });

  it("drops any path from the configured URL", () => {
    expect(resolveOrigin({ forwardedProto: null, host: null, siteUrl: "https://tradelink.example/app?x=1" })).toBe(
      "https://tradelink.example",
    );
  });

  it("fails closed when the configured URL is invalid", () => {
    expect(resolveOrigin({ forwardedProto: "https", host: "tradelink.example", siteUrl: "not a url" })).toBeNull();
    expect(resolveOrigin({ forwardedProto: "https", host: "tradelink.example", siteUrl: "ftp://tradelink.example" })).toBeNull();
  });
});

describe("resolveOrigin without NEXT_PUBLIC_SITE_URL", () => {
  it.each([undefined, null, "", "  "])("uses the request host when the setting is %j", (siteUrl) => {
    expect(resolveOrigin({ forwardedProto: "https", host: "tradelink.vercel.app", siteUrl })).toBe("https://tradelink.vercel.app");
  });

  it("uses the first forwarded protocol", () => {
    expect(resolveOrigin({ forwardedProto: "https, http", host: "tradelink.example", siteUrl: "" })).toBe(
      "https://tradelink.example",
    );
  });

  it("defaults to https, and to http only for local hosts", () => {
    expect(requestOrigin(null, "tradelink.example")).toBe("https://tradelink.example");
    expect(requestOrigin(null, "localhost:3000")).toBe("http://localhost:3000");
    expect(requestOrigin(null, "127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
    expect(requestOrigin(null, "[::1]:3000")).toBe("http://[::1]:3000");
  });

  it("lower-cases the host", () => {
    expect(requestOrigin("HTTPS", "TradeLink.Example")).toBe("https://tradelink.example");
  });

  it.each([
    null,
    "",
    "evil.test/path",
    "evil.test@good.test",
    "user:pass@evil.test",
    "evil.test\r\nX-Injected: 1",
    "evil.test:99999999",
    "-bad.test",
    "evil test",
  ])("rejects the malformed host %j", (host) => {
    expect(requestOrigin("https", host)).toBeNull();
  });

  it("rejects protocols other than http and https", () => {
    expect(requestOrigin("javascript", "tradelink.example")).toBeNull();
    expect(requestOrigin("ftp", "tradelink.example")).toBeNull();
  });
});

describe("parseOrigin", () => {
  it("returns only the origin of http(s) URLs", () => {
    expect(parseOrigin("http://localhost:3000/sign-in")).toBe("http://localhost:3000");
    expect(parseOrigin("javascript:alert(1)")).toBeNull();
    expect(parseOrigin(undefined)).toBeNull();
  });
});
