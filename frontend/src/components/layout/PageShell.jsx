import PanelHeader from "./PanelHeader";

/**
 * Detail page frame (settings sections and similar): the shared 60px
 * header with an optional back button, and a scrollable body whose cards
 * use the full pane width up to a comfortable reading measure.
 */
export default function SectionShell({ title, subtitle, onBack, backLabel, actions, children }) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-base-200">
      <PanelHeader title={title} subtitle={subtitle} onBack={onBack} backLabel={backLabel} actions={actions} size="md" border />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="anim-fade w-full max-w-[1100px] space-y-6 px-4 pb-24 pt-5 md:px-8 md:pb-10 xl:px-10">{children}</div>
      </div>
    </div>
  );
}

export function Card({ title, description, children, className = "" }) {
  return (
    <section>
      {title && (
        <div className="mb-2 px-1">
          <h2 className="text-[0.8125rem] font-semibold text-base-content/60">{title}</h2>
          {description && <p className="mt-0.5 text-[0.8125rem] text-base-content/50">{description}</p>}
        </div>
      )}
      <div className={`divide-y divide-base-300/60 overflow-hidden rounded-2xl border border-base-300/60 bg-base-100 ${className}`}>{children}</div>
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
