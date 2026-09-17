import { describe, expect, it } from "vitest";
import nextConfig, { CONTENT_SECURITY_POLICY, SECURITY_HEADERS } from "@/next.config";

/**
 * A policy can be loosened without breaking a page, so the assertions that earn
 * their place here are the ones naming what it must refuse.
 */

const directives = CONTENT_SECURITY_POLICY.split(";")
  .map((directive) => directive.trim())
  .filter(Boolean);

const names = directives.map((directive) => directive.split(/\s+/)[0]);

describe("the policy as a header value", () => {
  it("is a single line", () => {
    // A newline throws ERR_INVALID_CHAR at serve time and rides the manifest until then.
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/[\r\n]/);
  });

  it("names no directive twice", () => {
    // A browser ignores a repeat rather than merging it, so a doubled name has none.
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("what the policy must refuse", () => {
  it("never permits eval in what it ships", () => {
    expect(CONTENT_SECURITY_POLICY).not.toContain("'unsafe-eval'");
  });

  it("wildcards no directive", () => {
    for (const directive of directives) expect(directive).not.toMatch(/(^|\s)\*(\s|$)/);
    expect(CONTENT_SECURITY_POLICY).not.toContain("https:");
  });

  it("upgrades no insecure request", () => {
    // The directive exempts localhost but not the LAN IP a phone reaches `next dev` on.
    expect(CONTENT_SECURITY_POLICY).not.toContain("upgrade-insecure-requests");
  });
});

describe("what the policy carries", () => {
  it("closes the four a same-origin policy still leaves open", () => {
    for (const directive of [
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ]) {
      expect(directives).toContain(directive);
    }
  });

  it("falls back to 'self' for anything it does not name", () => {
    expect(directives).toContain("default-src 'self'");
  });

  it("allows the conditions call and the heightmap read", () => {
    expect(directives).toContain("connect-src 'self'");
  });

  it("allows the prerendered payload to hydrate", () => {
    expect(directives).toContain("script-src 'self' 'unsafe-inline'");
  });
});

describe("transport security", () => {
  it("claims no preload, which belongs to the apex rather than this subdomain", () => {
    const hsts = SECURITY_HEADERS.find(
      (header) => header.key === "Strict-Transport-Security",
    )!.value;

    expect(hsts).toContain("includeSubDomains");
    expect(hsts).not.toContain("preload");
  });
});

describe("where the headers apply", () => {
  it("is one rule over every path, public/ included", async () => {
    const rules = await nextConfig.headers!();

    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/(.*)");
    expect(rules[0].headers).toEqual(SECURITY_HEADERS);
  });
});
