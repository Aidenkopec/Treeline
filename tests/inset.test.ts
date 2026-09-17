import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { type Inset, NO_INSET, chromeInset, drawerOpen, sameInset, viewFrame } from "@/lib/inset";

const CHROME = { drawerHeight: 470, drawerWidth: 608, mastheadHeight: 270 };

describe("drawerOpen", () => {
  it("opens on a laptop and peeks on a phone", () => {
    expect(drawerOpen({ choice: null, phone: false, steerOnMap: true })).toBe(true);
    expect(drawerOpen({ choice: null, phone: true, steerOnMap: true })).toBe(false);
  });

  it("is out at every width without a GPU, whatever was last asked for", () => {
    for (const phone of [true, false]) {
      for (const choice of [true, false, null]) {
        expect(drawerOpen({ choice, phone, steerOnMap: false })).toBe(true);
      }
    }
  });

  it("keeps a reader's own answer over the default", () => {
    expect(drawerOpen({ choice: true, phone: true, steerOnMap: true })).toBe(true);
    expect(drawerOpen({ choice: false, phone: false, steerOnMap: true })).toBe(false);
  });
});

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

// Asserted through a real projection: `setViewOffset` is what can be held backwards.
const CANVAS = { width: 1512, height: 860 };
const DOCKED: Inset = { top: 270, right: 608, bottom: 0 };
const SHEET: Inset = { top: 270, right: 0, bottom: 470 };

function lens(aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(50, aspect, 1, 10_000);
  camera.position.set(0, 0, 1000);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}

/** Pixels from the top left of a canvas of this size. */
function pixel(
  camera: THREE.PerspectiveCamera,
  point: THREE.Vector3,
  width: number,
  height: number,
) {
  const ndc = point.clone().project(camera);
  return { x: ((ndc.x + 1) / 2) * width, y: ((1 - ndc.y) / 2) * height };
}

/** How wide 100 world units draw. */
function span(camera: THREE.PerspectiveCamera, width: number, height: number): number {
  const origin = pixel(camera, new THREE.Vector3(0, 0, 0), width, height);
  return pixel(camera, new THREE.Vector3(100, 0, 0), width, height).x - origin.x;
}

function framed(size: { width: number; height: number }, inset: Inset): THREE.PerspectiveCamera {
  const camera = lens(size.width / size.height);
  const frame = viewFrame(size.width, size.height, inset);
  camera.setViewOffset(
    frame.fullWidth,
    frame.fullHeight,
    frame.offsetX,
    frame.offsetY,
    frame.width,
    frame.height,
  );
  camera.updateProjectionMatrix();
  return camera;
}

describe("viewFrame", () => {
  it("centres the frame on the strip the chrome leaves", () => {
    for (const inset of [DOCKED, SHEET]) {
      const centre = pixel(
        framed(CANVAS, inset),
        new THREE.Vector3(0, 0, 0),
        CANVAS.width,
        CANVAS.height,
      );

      expect(centre.x).toBeCloseTo((CANVAS.width - inset.right) / 2, 6);
      expect(centre.y).toBeCloseTo(inset.top + (CANVAS.height - inset.top - inset.bottom) / 2, 6);
    }
  });

  it("draws at the scale a canvas the size of that strip would", () => {
    for (const inset of [DOCKED, SHEET]) {
      const clearWidth = CANVAS.width - inset.right;
      const clearHeight = CANVAS.height - inset.top - inset.bottom;
      const alone = lens(clearWidth / clearHeight);

      expect(span(framed(CANVAS, inset), CANVAS.width, CANVAS.height)).toBeCloseTo(
        span(alone, clearWidth, clearHeight),
        6,
      );
    }
  });

  it("only ever shrinks the subject, whichever edge is covered", () => {
    const bare = span(lens(CANVAS.width / CANVAS.height), CANVAS.width, CANVAS.height);

    for (const inset of [DOCKED, SHEET, { top: 270, right: 0, bottom: 0 }]) {
      expect(span(framed(CANVAS, inset), CANVAS.width, CANVAS.height)).toBeLessThan(bare);
    }
  });

  it("stays a frame when the chrome is taller than the window", () => {
    const frame = viewFrame(400, 600, { top: 270, right: 0, bottom: 470 });

    expect(frame.fullWidth).toBe(400);
    expect(frame.fullHeight).toBe(1);
    expect(Number.isFinite(framed({ width: 400, height: 600 }, SHEET).aspect)).toBe(true);
  });

  it("is the bare canvas when nothing is covered", () => {
    const covered = framed(CANVAS, NO_INSET);
    const bare = lens(CANVAS.width / CANVAS.height);
    const centre = pixel(covered, new THREE.Vector3(0, 0, 0), CANVAS.width, CANVAS.height);

    expect(span(covered, CANVAS.width, CANVAS.height)).toBeCloseTo(
      span(bare, CANVAS.width, CANVAS.height),
      6,
    );
    expect(centre.x).toBeCloseTo(CANVAS.width / 2, 6);
    expect(centre.y).toBeCloseTo(CANVAS.height / 2, 6);
  });
});
