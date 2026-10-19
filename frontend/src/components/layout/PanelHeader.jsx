import { ArrowLeft } from "lucide-react";

/**
 * Header shared by every list and detail pane. Same height everywhere
 * (h-header = 60px) and a 16px inset, so titles, avatars and list rows line
 * up across panes.
 */
export default function PanelHeader({
  title,
  subtitle,
  onBack,
  backLabel = "Back",
  actions,
  children,
  size = "lg",
  border = false,
  className = "",
}) {
  return (
    <header className={`safe-top z-10 shrink-0 bg-base-100 ${border ? "border-b border-base-300/70" : ""} ${className}`}>
      <div className="flex h-header items-center gap-1 px-4">
        {onBack && (
          <button type="button" className="icon-btn -ml-2.5 mr-0.5" onClick={onBack} aria-label={backLabel} title={backLabel}>
            <ArrowLeft className="size-[22px]" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className={`truncate font-bold tracking-tight ${size === "lg" ? "text-[1.375rem] leading-7" : "text-[1.0625rem] leading-6"}`}>{title}</h1>
          {subtitle && <p className="truncate text-xs text-base-content/55">{subtitle}</p>}
        </div>
        {actions && <div className="-mr-2.5 flex shrink-0 items-center">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
