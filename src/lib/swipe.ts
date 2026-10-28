// Row swipe on phones: decides when a horizontal drag commits to an action.

export type SwipeAction = 'pin' | 'archive' | null;
/** Pixels of movement before the gesture is read as horizontal or vertical. */
export const SLOP = 10;
/** Commit distance: a quarter of the row, at least 80px. */
export const commitAt = (width: number) => Math.max(80, width * 0.25);
/** Right pins (or unpins), left archives. */
export const swipeAction = (dx: number, width: number): SwipeAction => (dx >= commitAt(width) ? 'pin' : dx <= -commitAt(width) ? 'archive' : null);
/** After SLOP: horizontal only when clearly more sideways than up/down, so scrolling wins ties. */
export const isHorizontal = (dx: number, dy: number) => Math.abs(dx) > SLOP && Math.abs(dx) > Math.abs(dy) * 1.5;
