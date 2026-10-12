/** One shooting surface, responsive target cells; simulation never reads this layout. */
export function gallerySlots(width: number) {
  const columns = width >= 650 ? 6 : 3,
    cell = (width - 24) / columns;
  return Array.from({ length: 6 }, (_, i) => ({
    x: 12 + (i % columns) * cell + 6,
    y: 200 + Math.floor(i / columns) * 130,
    width: cell - 12,
    height: 120,
  }));
}
