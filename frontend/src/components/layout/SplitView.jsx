import { useIsWide } from "../../hooks/useMediaQuery";

/**
 * Master/detail layout used by every section (chats, updates, calls,
 * reminders, starred, settings). Tablets and desktops show both panes side
 * by side; phones show one at a time.
 */
export default function SplitView({ list, detail, showDetail = false, aside = null }) {
  const wide = useIsWide();
  if (!wide) return showDetail ? detail : list;
  return (
    <div className="flex min-w-0 flex-1">
      <aside className="flex w-[clamp(320px,30vw,420px)] shrink-0 border-r border-base-300/70 bg-base-100">{list}</aside>
      <section className="relative flex min-w-0 flex-1 bg-base-200" style={{ viewTransitionName: "chat-pane" }}>
        {detail}
      </section>
      {aside}
    </div>
  );
}

/** Placeholder for the detail pane when nothing is selected (desktop). */
export function DetailPlaceholder({ icon: Icon, title, body, children }) {
  return (
    <div className="wallpaper-plain flex flex-1 items-center justify-center p-8">
      <div className="anim-fade flex max-w-sm flex-col items-center text-center">
        {Icon && (
          <span className="mb-5 flex size-20 items-center justify-center rounded-[28px] bg-base-100 text-base-content/45 shadow-soft">
            <Icon className="size-9" strokeWidth={1.6} />
          </span>
        )}
        <h2 className="text-balance text-xl font-semibold tracking-tight">{title}</h2>
        {body && <p className="mt-2 text-balance text-sm leading-relaxed text-base-content/55">{body}</p>}
        {children}
      </div>
    </div>
  );
}
