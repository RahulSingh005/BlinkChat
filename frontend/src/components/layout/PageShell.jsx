/** Scrollable page frame for Settings, Profile and Reminders. */
export default function PageShell({ title, subtitle, actions, children }) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-base-200/40">
      <header className="safe-top shrink-0 border-b border-base-300/60 bg-base-100/90 backdrop-blur md:border-none md:bg-transparent">
        <div className="mx-auto flex w-full max-w-2xl items-end gap-3 px-4 pb-3 pt-4 md:px-6 md:pt-8">
          <div className="min-w-0 flex-1">
            <h1 className="text-[1.6rem] font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-base-content/55">{subtitle}</p>}
          </div>
          {actions}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="anim-fade mx-auto w-full max-w-2xl space-y-6 px-4 pb-28 pt-4 md:px-6 md:pb-12">{children}</div>
      </div>
    </div>
  );
}

export function Card({ title, description, children, className = "" }) {
  return (
    <section>
      {title && (
        <div className="mb-2 px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-base-content/50">{title}</h2>
          {description && <p className="mt-0.5 text-[0.8125rem] text-base-content/50">{description}</p>}
        </div>
      )}
      <div className={`divide-y divide-base-300/60 overflow-hidden rounded-2xl border border-base-300/70 bg-base-100 ${className}`}>{children}</div>
    </section>
  );
}

export function LinkRow({ icon: Icon, label, description, onClick, danger = false, right }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-base-content/[0.03] ${danger ? "text-error" : ""}`}>
      {Icon && (
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${danger ? "bg-error/10" : "bg-base-200 text-base-content/70"}`}>
          <Icon className="size-[18px]" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[0.95rem] font-medium">{label}</span>
        {description && <span className={`mt-0.5 block text-[0.8125rem] ${danger ? "text-error/70" : "text-base-content/55"}`}>{description}</span>}
      </span>
      {right}
    </button>
  );
}
