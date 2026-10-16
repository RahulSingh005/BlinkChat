/** Loading placeholders that match the real layout, so content doesn't jump. */
export function ConversationSkeleton({ rows = 8 }) {
  return (
    <div className="space-y-1 px-2 py-1" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ opacity: 1 - i * 0.09 }}>
          <div className="skeleton-line size-12 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="flex justify-between gap-6">
              <div className="skeleton-line h-3.5" style={{ width: `${45 + ((i * 17) % 30)}%` }} />
              <div className="skeleton-line h-3 w-9" />
            </div>
            <div className="skeleton-line h-3" style={{ width: `${55 + ((i * 23) % 35)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const BUBBLES = [
  { side: "in", w: 46 },
  { side: "in", w: 30 },
  { side: "out", w: 52 },
  { side: "in", w: 62 },
  { side: "out", w: 28 },
  { side: "out", w: 44 },
  { side: "in", w: 36 },
];

export function MessagesSkeleton() {
  return (
    <div className="flex flex-1 flex-col justify-end gap-2 px-4 py-6" aria-hidden="true">
      {BUBBLES.map((b, i) => (
        <div key={i} className={`flex ${b.side === "out" ? "justify-end" : "justify-start"}`}>
          <div className="skeleton-line h-9 rounded-2xl" style={{ width: `${b.w}%`, maxWidth: 360 }} />
        </div>
      ))}
    </div>
  );
}
