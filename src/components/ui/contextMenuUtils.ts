/**
 * ContextMenu utility functions for position calculation and viewport constraints
 */

export interface MenuPosition {
  top: number;
  left: number;
}

export interface ViewportConstraints {
  viewportWidth: number;
  viewportHeight: number;
  menuWidth: number;
  menuHeight: number;
  clickX: number;
  clickY: number;
  margin?: number;
}

/**
 * Calculates the optimal position for a context menu to stay within viewport bounds
 * @param constraints - Viewport and menu dimensions
 * @returns Adjusted top/left position
 */
export function calculateContextMenuPosition(
  constraints: ViewportConstraints
): MenuPosition {
  const {
    viewportWidth,
    viewportHeight,
    menuWidth,
    menuHeight,
    clickX,
    clickY,
    margin = 10,
  } = constraints;

  let adjustedX = clickX;
  let adjustedY = clickY;

  // Adjust horizontal position if menu overflows right edge
  if (clickX + menuWidth > viewportWidth - margin) {
    adjustedX = viewportWidth - menuWidth - margin;
  }

  // Adjust vertical position if menu overflows bottom edge
  if (clickY + menuHeight > viewportHeight - margin) {
    adjustedY = viewportHeight - menuHeight - margin;
  }

  // Ensure menu doesn't go off the left edge
  if (adjustedX < margin) {
    adjustedX = margin;
  }

  // Ensure menu doesn't go off the top edge
  if (adjustedY < margin) {
    adjustedY = margin;
  }

  return { top: adjustedY, left: adjustedX };
}

/**
 * Determines if the menu should be positioned to the left of the click point
 * @param clickX - X coordinate of click
 * @param menuWidth - Width of the menu
 * @param viewportWidth - Width of the viewport
 * @returns true if menu should appear to the left
 */
export function shouldPositionLeft(
  clickX: number,
  menuWidth: number,
  viewportWidth: number,
  margin: number = 10
): boolean {
  return clickX + menuWidth > viewportWidth - margin;
}

/**
 * Determines if the menu should be positioned above the click point
 * @param clickY - Y coordinate of click
 * @param menuHeight - Height of the menu
 * @param viewportHeight - Height of the viewport
 * @returns true if menu should appear above
 */
export function shouldPositionAbove(
  clickY: number,
  menuHeight: number,
  viewportHeight: number,
  margin: number = 10
): boolean {
  return clickY + menuHeight > viewportHeight - margin;
}

/**
 * Clamps a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
