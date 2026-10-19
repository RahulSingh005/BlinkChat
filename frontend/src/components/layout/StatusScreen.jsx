import { LogoMark } from "../ui/Logo";

/**
 * Full-screen frame for boot, error and offline states: soft grid
 * background, accent glow and a centered card.
 */
export default function StatusScreen({ icon, title, body, children, details, busy = false, tone = "primary" }) {
  return (
    <div className="app-shell relative flex flex-col items-center justify-center overflow-hidden bg-base-200 p-6 text-center" aria-busy={busy || undefined}>
      <div className="bg-grid pointer-events-none absolute inset-0" />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: tone === "error" ? "oklch(var(--er) / 0.10)" : "oklch(var(--p) / 0.12)" }}
      />
      <div className="anim-scale-in relative flex w-full max-w-sm flex-col items-center">
        <div className="relative">
          <LogoMark size={64} animated={busy} className="drop-shadow-md" />
          {icon && (
            <span className={`absolute -bottom-2 -right-2 flex size-8 items-center justify-center rounded-full border-4 border-base-200 ${tone === "error" ? "bg-error text-error-content" : "bg-base-100 text-base-content/70"}`}>
              {icon}
            </span>
          )}
        </div>
        {title && <h1 className="mt-6 text-balance text-2xl font-bold tracking-tight">{title}</h1>}
        {body && <p className="mt-2 text-balance text-sm leading-relaxed text-base-content/60">{body}</p>}
        {busy && (
          <div className="mt-6 h-1 w-40 overflow-hidden rounded-full bg-base-content/10">
            <div className="boot-bar h-full w-1/3 rounded-full bg-primary" />
          </div>
        )}
        {children && <div className="mt-7 flex w-full flex-col items-center gap-2 sm:flex-row sm:justify-center">{children}</div>}
        {details && (
          <details className="mt-6 w-full rounded-xl border border-base-300 bg-base-100/70 px-4 py-2.5 text-left text-xs text-base-content/60">
            <summary className="cursor-pointer select-none font-medium">Technical details</summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px]">{details}</pre>
          </details>
        )}
      </div>
    </div>
  );
}
