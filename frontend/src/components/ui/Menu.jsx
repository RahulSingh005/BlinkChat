import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { useIsWide } from "../../hooks/useMediaQuery";
import Popover from "./Popover";
import Sheet from "./Sheet";

/**
 * Action menu. Anchored popover on larger screens (arrow-key navigation);
 * a thumb-friendly bottom sheet on phones.
 *
 * items: [{ label, icon, onSelect, danger, disabled, checked, hint } | "divider" | { section }]
 */
export default function Menu({ open, onClose, anchor, items = [], header = null, title, width = 240 }) {
  const wide = useIsWide();
  if (!open) return null;
  if (!wide) {
    return (
      <Sheet open={open} onClose={onClose} title={title} size="sm" showClose={false}>
        {header}
        <MenuItems items={items} onClose={onClose} large />
      </Sheet>
    );
  }
  return (
    <Popover anchor={anchor} onClose={onClose} width={width} role="menu" className="p-1.5">
      <ArrowKeys />
      {header}
      <MenuItems items={items} onClose={onClose} />
    </Popover>
  );
}

/** Up/down arrow navigation between menu buttons. */
function ArrowKeys() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current?.parentElement;
    if (!root) return undefined;
    const onKey = (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const buttons = [...root.querySelectorAll("[role=menuitem]:not(:disabled)")];
      const i = buttons.indexOf(document.activeElement);
      const next = e.key === "ArrowDown" ? buttons[(i + 1) % buttons.length] : buttons[(i - 1 + buttons.length) % buttons.length];
      next?.focus();
    };
    root.addEventListener("keydown", onKey);
    return () => root.removeEventListener("keydown", onKey);
  }, []);
  return <span ref={ref} hidden />;
}

export function MenuItems({ items, onClose, large = false }) {
  return (
    <div className={large ? "space-y-0.5 pb-1" : ""}>
      {items.filter(Boolean).map((item, i) => {
        if (item === "divider") return <div key={`d${i}`} className="mx-2 my-1 h-px bg-base-300/70" />;
        if (item.section) {
          return (
            <div key={`s${i}`} className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-base-content/45">
              {item.section}
            </div>
          );
        }
        const Icon = item.icon;
        return (
          <button
            key={item.key || item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={`menu-item ${large ? "py-3 text-[0.95rem]" : ""} ${item.danger ? "menu-item-danger" : ""}`}
            onClick={() => {
              if (!item.keepOpen) onClose?.();
              item.onSelect?.();
            }}
          >
            {Icon && <Icon className={`size-[18px] shrink-0 ${item.danger ? "" : "text-base-content/60"}`} />}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.hint && <span className="shrink-0 text-xs text-base-content/45">{item.hint}</span>}
            {item.checked && <Check className="size-4 shrink-0 text-primary" />}
          </button>
        );
      })}
    </div>
  );
}
