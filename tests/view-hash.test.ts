import { describe, expect, it } from "vitest";
import { NO_VIEW, parseViewHash, viewHash } from "@/lib/view-hash";

describe("the shareable view", () => {
  it("still reads the links phase 3 was handing out", () => {
    // `#run=<id>` was the whole format, and those links are in the wild.
    expect(parseViewHash("#run=23301816")).toEqual({ runId: "23301816", sun: null });
  });

  it("round-trips a run and an hour", () => {
    const state = { runId: "23301816", sun: "2026-02-14T14:00" };
    expect(viewHash(state)).toBe("#run=23301816&sun=2026-02-14T14:00");
    expect(parseViewHash(viewHash(state))).toEqual(state);
  });

  it("carries either half on its own", () => {
    expect(viewHash({ runId: null, sun: "2026-02-14T14:00" })).toBe("#sun=2026-02-14T14:00");
    expect(parseViewHash("#sun=2026-02-14T14:00")).toEqual({
      runId: null,
      sun: "2026-02-14T14:00",
    });
    expect(viewHash({ runId: "656592592", sun: null })).toBe("#run=656592592");
  });

  it("leaves the colon alone, so a link reads as the time it carries", () => {
    expect(viewHash({ runId: null, sun: "2026-02-14T14:00" })).not.toContain("%3A");
  });

  it("serialises an empty view to nothing at all", () => {
    // The caller puts this after the pathname, so "" is what drops the hash.
    expect(viewHash(NO_VIEW)).toBe("");
  });

  it("reads an absent, empty or malformed hash as no view", () => {
    for (const hash of ["", "#", "#run=", "#sun=", "#nonsense", "#run=&sun="]) {
      expect(parseViewHash(hash), hash).toEqual(NO_VIEW);
    }
  });

  it("drops an hour that is not one", () => {
    // Same policy as an id naming no run: a bad value selects nothing rather
    // than throwing a shared link away.
    for (const sun of ["2026-02-30T14:00", "2026-02-14T25:00", "yesterday", "2026-02-14"]) {
      expect(parseViewHash(`#run=23301816&sun=${sun}`), sun).toEqual({
        runId: "23301816",
        sun: null,
      });
    }
  });

  it("survives a percent-encoded colon, whoever encoded it", () => {
    expect(parseViewHash("#sun=2026-02-14T14%3A00").sun).toBe("2026-02-14T14:00");
  });
});
