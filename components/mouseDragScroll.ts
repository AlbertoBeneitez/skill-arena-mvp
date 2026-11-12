/**
 * v182 · Computers have no finger to swipe with: in the desktop platform, dragging with the mouse scrolls any
 * horizontal strip (catalogue rows, the avatar picker), as a swipe does on a phone. A real drag never becomes a
 * click on the card under the pointer; a plain click still works. Presentation only.
 */
const DRAG_THRESHOLD = 6;

function horizontalScroller(start: EventTarget | null): HTMLElement | null {
  for (let el = start instanceof Element ? start : null; el && el !== document.body; el = el.parentElement) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.closest("input, textarea, select, canvas, [contenteditable='true']")) return null;
    const overflow = getComputedStyle(el).overflowX;
    if ((overflow === "auto" || overflow === "scroll") && el.scrollWidth > el.clientWidth + 1) return el;
  }
  return null;
}

/** Installs the behaviour on the document; returns the function that removes it. */
export function installMouseDragScroll(doc: Document = document) {
  let target: HTMLElement | null = null, startX = 0, startLeft = 0, dragging = false, snap = "";
  let suppressClick = false;
  const down = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    target = horizontalScroller(e.target);
    if (!target) return;
    startX = e.clientX; startLeft = target.scrollLeft; dragging = false;
  };
  const move = (e: PointerEvent) => {
    if (!target) return;
    const dx = e.clientX - startX;
    if (!dragging && Math.abs(dx) < DRAG_THRESHOLD) return;
    if (!dragging) {
      dragging = true;
      snap = target.style.scrollSnapType;
      target.style.scrollSnapType = "none"; // follow the mouse freely; the strip snaps again on release
      target.style.cursor = "grabbing";
      try { target.setPointerCapture(e.pointerId); } catch { /* the release still ends the drag */ }
    }
    target.scrollLeft = startLeft - dx;
    e.preventDefault();
  };
  const up = () => {
    if (!target) return;
    if (dragging) {
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0); // only the click that ends this drag is swallowed
      const el = target;
      el.style.cursor = "";
      // Restore snapping and settle on the nearest card, as a swipe does.
      requestAnimationFrame(() => { el.style.scrollSnapType = snap; });
    }
    target = null; dragging = false;
  };
  const click = (e: MouseEvent) => {
    if (!suppressClick) return;
    suppressClick = false;
    e.preventDefault();
    e.stopPropagation();
  };
  const dragstart = (e: DragEvent) => { if (horizontalScroller(e.target)) e.preventDefault(); }; // no ghost image of covers
  doc.addEventListener("pointerdown", down, true);
  doc.addEventListener("pointermove", move, { capture: true, passive: false });
  doc.addEventListener("pointerup", up, true);
  doc.addEventListener("pointercancel", up, true);
  doc.addEventListener("click", click, true);
  doc.addEventListener("dragstart", dragstart, true);
  return () => {
    doc.removeEventListener("pointerdown", down, true);
    doc.removeEventListener("pointermove", move, true);
    doc.removeEventListener("pointerup", up, true);
    doc.removeEventListener("pointercancel", up, true);
    doc.removeEventListener("click", click, true);
    doc.removeEventListener("dragstart", dragstart, true);
  };
}
