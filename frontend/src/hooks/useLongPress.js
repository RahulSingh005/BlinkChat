import { useCallback, useRef } from "react";
import { vibrate } from "../lib/platform";

/**
 * Long-press for touch screens (message actions, chat context menu).
 * Cancels when the finger moves (so scrolling never triggers it).
 */
export function useLongPress(onLongPress, { delay = 420, moveTolerance = 10 } = {}) {
  const timer = useRef(null);
  const start = useRef(null);
  const fired = useRef(false);

  const clear = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e) => {
      if (e.pointerType === "mouse") return;
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      const target = e.currentTarget;
      clear();
      timer.current = setTimeout(() => {
        fired.current = true;
        vibrate(10);
        onLongPress(e, target);
      }, delay);
    },
    [onLongPress, delay, clear]
  );

  const onPointerMove = useCallback(
    (e) => {
      if (!timer.current || !start.current) return;
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > moveTolerance) clear();
    },
    [moveTolerance, clear]
  );

  // Swallow the click that follows a long press.
  const onClickCapture = useCallback((e) => {
    if (fired.current) {
      e.preventDefault();
      e.stopPropagation();
      fired.current = false;
    }
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onClickCapture,
    onContextMenu: (e) => {
      // Touch browsers fire contextmenu on long-press; we handle it ourselves.
      if (e.nativeEvent?.pointerType !== "mouse" && fired.current) e.preventDefault();
    },
  };
}
