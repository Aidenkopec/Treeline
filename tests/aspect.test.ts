import { describe, expect, it } from "vitest";
import { aspectLabel, isShadedAspect } from "@/lib/aspect";

describe("aspect bucketing", () => {
  it("centres each bucket on its label", () => {
    expect(aspectLabel(0)).toBe("N");
    expect(aspectLabel(45)).toBe("NE");
    expect(aspectLabel(90)).toBe("E");
    expect(aspectLabel(135)).toBe("SE");
    expect(aspectLabel(180)).toBe("S");
    expect(aspectLabel(225)).toBe("SW");
    expect(aspectLabel(270)).toBe("W");
    expect(aspectLabel(315)).toBe("NW");
  });

  it("keeps bearings either side of due north in the north bucket", () => {
    expect(aspectLabel(350)).toBe("N");
    expect(aspectLabel(10)).toBe("N");
    expect(aspectLabel(359.9)).toBe("N");
  });

  it("splits at the bucket edges", () => {
    expect(aspectLabel(22.4)).toBe("N");
    expect(aspectLabel(23)).toBe("NE");
  });

  it("normalises bearings outside 0–360", () => {
    expect(aspectLabel(360)).toBe("N");
    expect(aspectLabel(-90)).toBe("W");
    expect(aspectLabel(725)).toBe("N");
  });

  it("treats the northerly aspects as shaded", () => {
    expect(isShadedAspect("N")).toBe(true);
    expect(isShadedAspect("NE")).toBe(true);
    expect(isShadedAspect("S")).toBe(false);
  });
});
