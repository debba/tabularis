import type { NotebookCell } from "../types/notebook";

export function reorderCells(
  cells: NotebookCell[],
  fromIndex: number,
  toIndex: number,
): NotebookCell[] {
  if (fromIndex === toIndex) return cells;
  if (fromIndex < 0 || fromIndex >= cells.length) return cells;
  if (toIndex < 0 || toIndex >= cells.length) return cells;

  const result = [...cells];
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);
  return result;
}

export function getDropIndex(
  _containerRect: DOMRect,
  cellRects: DOMRect[],
  clientY: number,
  dragIndex: number,
): number {
  for (let i = 0; i < cellRects.length; i++) {
    const rect = cellRects[i];
    const midY = rect.top + rect.height / 2;
    if (clientY < midY) {
      return i <= dragIndex ? i : i;
    }
  }
  return cellRects.length - 1;
}
