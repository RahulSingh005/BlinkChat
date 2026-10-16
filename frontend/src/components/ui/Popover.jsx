import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Floating panel anchored to an element or a point. Flips above the anchor
 * near the bottom edge and stays inside the viewport. Closes on outside
 * press, Escape, resize, or scrolling elsewhere.
 */
export default function Popover({ anchor, onClose, width, children, className = "", align = "end", role = "dialog", autoFocus = true }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: -9999, top: -9999, origin: "top right" });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !anchor) return;
    const isPoint = typeof anchor.getBoundingClientRect !== "function";
    const rect = isPoint ? { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y } : anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const margin = 8;
    let left = isPoint || align === "start" ? rect.left : rect.right - w;
    left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));
    let top = rect.bottom + 6;
    let vertical = "top";
    if (top + h > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - h - 6);
      vertical = "bottom";
    }
    setPos({ left, top, origin: `${vertical} ${left + w / 2 < rect.left + 1 ? "right" : "left"}` });
  }, [anchor, align]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) onClose();
    };
    const onScroll = (e) => {
      if (!ref.current?.contains(e.target)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onClose);
    if (autoFocus) ref.current?.querySelector("button:not(:disabled), input")?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose, autoFocus]);

  return createPortal(
    <div
      ref={ref}
      role={role}
      className={`anim-scale-in fixed z-[90] rounded-2xl border border-base-300/80 bg-base-100 shadow-float ${className}`}
      style={{ left: pos.left, top: pos.top, width, transformOrigin: pos.origin }}
    >
      {children}
    </div>,
    document.body
  );
}
