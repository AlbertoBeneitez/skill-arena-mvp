import assert from "node:assert/strict";
import { configureLogicalCanvas } from "../lib/gameCanvas";
const host = globalThis as unknown as { window: { devicePixelRatio: number } };
const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
host.window = { devicePixelRatio: 3 };
let width = 390,
  height = 620;
const canvas = {
  width: 0,
  height: 0,
  getBoundingClientRect: () => ({ width, height }),
} as unknown as HTMLCanvasElement;
for (const size of [
  [390, 620],
  [700, 280],
  [280, 700],
]) {
  [width, height] = size;
  const contained = configureLogicalCanvas(canvas, 390, 620);
  assert.equal(contained.logicalWidth, 390);
  assert.equal(contained.logicalHeight, 620);
  assert.ok(contained.offsetX >= 0 && contained.offsetY >= 0);
  assert.equal(contained.dpr, 2);
  assert.equal(canvas.width, width * 2);
  assert.equal(canvas.height, height * 2);
  assert.ok(
    Math.abs(contained.offsetX * 2 + contained.scale * 390 - width) < 1e-9,
  );
  assert.ok(
    Math.abs(contained.offsetY * 2 + contained.scale * 620 - height) < 1e-9,
  );
  const expanded = configureLogicalCanvas(
    canvas,
    390,
    620,
    2,
    "expand-horizontal",
  );
  assert.equal(expanded.logicalHeight, 620);
  assert.ok(expanded.logicalWidth >= 390);
  if (width / height > 390 / 620) {
    assert.ok(Math.abs(expanded.logicalWidth * expanded.scale - width) < 1e-9);
    assert.ok(
      Math.abs(expanded.logicalHeight * expanded.scale - height) < 1e-9,
    );
    assert.ok(
      Math.abs(expanded.offsetX) < 1e-9 && Math.abs(expanded.offsetY) < 1e-9,
    );
  } else assert.deepEqual(expanded, contained);
  const point = { x: expanded.logicalWidth / 2, y: expanded.logicalHeight / 2 };
  assert.equal(point.x * expanded.scale + expanded.offsetX, width / 2);
  assert.equal(point.y * expanded.scale + expanded.offsetY, height / 2);
}
if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
else Reflect.deleteProperty(globalThis, "window");
console.log(
  "Canvas viewport: historical contain preserved, wide visual-only expansion, centered pointer space, DPR cap and orientation resize",
);
