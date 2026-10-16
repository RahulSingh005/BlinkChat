import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useIsWide } from "../../hooks/useMediaQuery";

const SIZES = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-2xl" };

/**
 * Responsive dialog: a bottom sheet with drag-to-dismiss on phones, a
 * centered card on larger screens. Handles Escape, backdrop clicks, focus
 * restore and a short exit animation.
 */
export default function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  tall = false,
  bare = false,
  showClose = true,
  className = "",
}) {
  const wide = useIsWide();
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const panelRef = useRef(null);
  const restoreRef = useRef(null);
  const drag = useRef(null);
  const [dragY, setDragY] = useState(0);
  const titleId = useId();

  useEffect(() => {
    if (open) {
      restoreRef.current = document.activeElement;
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const t = setTimeout(() => {
        setMounted(false);
        setClosing(false);
        setDragY(0);
        restoreRef.current?.focus?.({ preventScroll: true });
      }, 170);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
      }
    };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => {
      const el = panelRef.current?.querySelector("[data-autofocus], input:not([type=hidden]), textarea, select");
      if (el && wide) el.focus({ preventScroll: true });
      else panelRef.current?.focus({ preventScroll: true });
    }, 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open, onClose, wide]);

  const onDragStart = useCallback(
    (e) => {
      if (wide) return;
      drag.current = { y: e.clientY, t: performance.now() };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [wide]
  );
  const onDragMove = useCallback((e) => {
    if (!drag.current) return;
    setDragY(Math.max(0, e.clientY - drag.current.y));
  }, []);
  const onDragEnd = useCallback(
    (e) => {
      if (!drag.current) return;
      const dy = Math.max(0, e.clientY - drag.current.y);
      const velocity = dy / Math.max(1, performance.now() - drag.current.t);
      drag.current = null;
      if (dy > 110 || velocity > 0.6) onClose?.();
      else setDragY(0);
    },
    [onClose]
  );

  if (!mounted) return null;

  const panelStyle = !wide && dragY ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center md:p-6" role="presentation">
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ${closing ? "opacity-0" : "anim-fade"}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        style={panelStyle}
        className={`relative flex w-full flex-col overflow-hidden bg-base-100 shadow-float outline-none
          rounded-t-3xl md:rounded-3xl ${SIZES[size]} ${tall ? "h-[92dvh] md:h-[min(720px,88dvh)]" : "max-h-[92dvh] md:max-h-[86dvh]"}
          transition-[transform,opacity] duration-200 ease-out
          ${closing ? "translate-y-full opacity-0 md:translate-y-2 md:scale-[0.98]" : wide ? "anim-scale-in" : "anim-sheet"}
          ${className}`}
      >
        {!wide && (
          <div
            className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
          >
            <span className="h-1.5 w-10 rounded-full bg-base-content/15" />
          </div>
        )}
        {!bare && (title || showClose) && (
          <div
            className="flex shrink-0 items-start gap-3 px-5 pb-3 pt-1 md:pt-5"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
          >
            <div className="min-w-0 flex-1">
              {title && (
                <h2 id={titleId} className="text-lg font-semibold tracking-tight">
                  {title}
                </h2>
              )}
              {description && <p className="mt-0.5 text-sm text-base-content/60">{description}</p>}
            </div>
            {showClose && (
              <button type="button" className="icon-btn icon-btn-sm -mr-2 -mt-1" onClick={onClose} aria-label="Close">
                <X className="size-[18px]" />
              </button>
            )}
          </div>
        )}
        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${bare ? "" : "px-5 pb-5"}`}>{children}</div>
        {footer && <div className="safe-bottom shrink-0 border-t border-base-300/70 px-5 py-3">{footer}</div>}
        {!footer && !wide && <div className="safe-bottom shrink-0" />}
      </div>
    </div>,
    document.body
  );
}
