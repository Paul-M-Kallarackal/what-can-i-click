import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("public deployment security headers", () => {
  const headers = readFileSync(resolve(process.cwd(), "public/_headers"), "utf8");

  it("keeps executable and embedding surfaces closed by default", () => {
    expect(headers).toContain("default-src 'self'");
    expect(headers).toContain("script-src 'self'");
    expect(headers).toContain("object-src 'none'");
    expect(headers).toContain("base-uri 'self'");
    expect(headers).toContain("form-action 'none'");
    expect(headers).toContain("frame-ancestors 'none'");
    expect(headers).toContain("require-trusted-types-for 'script'");
    expect(headers).toContain("trusted-types default");
  });

  it("enforces transport, MIME, referrer, and powerful-feature boundaries", () => {
    expect(headers).toContain("Strict-Transport-Security: max-age=31536000; includeSubDomains");
    expect(headers).toContain("X-Content-Type-Options: nosniff");
    expect(headers).toContain("X-Frame-Options: DENY");
    expect(headers).toContain("Referrer-Policy: strict-origin-when-cross-origin");
    expect(headers).toContain("Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()");
  });
});
