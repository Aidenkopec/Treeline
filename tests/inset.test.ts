import { describe, expect, it } from "vitest";
import { NO_INSET, chromeInset, sameInset } from "@/lib/inset";

const CHROME = { drawerHeight: 470, drawerWidth: 608, mastheadHeight: 270 };

describe("chromeInset", () => {
  it("covers the drawer's own width when docked", () => {
    expect(chromeInset({ ...CHROME, docked: true, open: true })).toEqual({
      top: 270,
      right: 608,
      bottom: 0,
    });
  });

  it("covers the drawer's own height as a raised sheet", () => {
    expect(chromeInset({ ...CHROME, docked: false, open: true })).toEqual({
      top: 270,
      right: 0,
      bottom: 470,
    });
  });

  it("keeps the masthead when the drawer is away, either way round", () => {
    for (const docked of [true, false]) {
      expect(chromeInset({ ...CHROME, docked, open: false })).toEqual({
        top: 270,
        right: 0,
        bottom: 0,
      });
    }
  });

  it("never reports both drawer edges at once", () => {
    for (const docked of [true, false]) {
      const inset = chromeInset({ ...CHROME, docked, open: true });
      expect(inset.right === 0 || inset.bottom === 0).toBe(true);
    }
  });

  it("is nothing at all with no chrome to stand anywhere", () => {
    expect(
      chromeInset({
        docked: true,
        drawerHeight: 0,
        drawerWidth: 0,
        mastheadHeight: 0,
        open: true,
      }),
    ).toEqual(NO_INSET);
  });
});

describe("sameInset", () => {
  it("compares the numbers, not the object", () => {
    expect(
      sameInset({ top: 270, right: 608, bottom: 0 }, { top: 270, right: 608, bottom: 0 }),
    ).toBe(true);
    expect(
      sameInset({ top: 270, right: 608, bottom: 0 }, { top: 269, right: 608, bottom: 0 }),
    ).toBe(false);
    expect(sameInset({ top: 0, right: 0, bottom: 470 }, NO_INSET)).toBe(false);
  });
});
