import { useEffect, useState } from "react";
import { Check, Search, X } from "lucide-react";
import Avatar from "../ui/Avatar";
import Spinner from "../ui/Spinner";
import { api } from "../../lib/api";

/**
 * Search people by name or exact email. Single mode calls onPick; multi
 * mode keeps a selection with removable chips.
 */
export default function PeoplePicker({ multiple = false, selected = [], onChange, onPick, exclude = [], autoFocus = true, placeholder = "Search by name or email" }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.get("/users/search", { params: { q: q.trim(), limit: 30 }, signal: controller.signal });
        setResults(res.data.users);
      } catch {
        // aborted
      } finally {
        setLoading(false);
      }
    }, q ? 220 : 0);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [q]);

  const isSelected = (u) => selected.some((s) => s._id === u._id);
  const toggle = (u) => {
    if (!multiple) return onPick?.(u);
    onChange(isSelected(u) ? selected.filter((s) => s._id !== u._id) : [...selected, u]);
  };
  const visible = results.filter((u) => !exclude.includes(u._id));

  return (
    <div className="flex min-h-0 flex-col">
      {multiple && selected.length > 0 && (
        <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1">
          {selected.map((u) => (
            <button key={u._id} type="button" onClick={() => toggle(u)} className="anim-scale-in flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 py-1 pl-1 pr-2 text-sm font-medium text-primary">
              <Avatar src={u.profilePic} name={u.fullName} seed={u._id} size={24} />
              {u.fullName.split(" ")[0]}
              <X className="size-3.5" />
            </button>
          ))}
        </div>
      )}
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-base-content/40" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          data-autofocus={autoFocus ? "" : undefined}
          className="field pl-10"
          aria-label="Search people"
        />
      </div>
      <div className="min-h-[240px]">
        {!q && !loading && visible.length > 0 && <div className="section-title mt-2">People on BlinkChat</div>}
        {loading && !visible.length ? (
          <div className="flex justify-center py-10">
            <Spinner className="size-5 text-base-content/40" />
          </div>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-base-content/50">
            {q ? "No one found. Try their full email address." : "Search for someone by name or email."}
          </p>
        ) : (
          <ul className="-mx-2">
            {visible.map((u, i) => (
              <li key={u._id}>
                <button
                  type="button"
                  onClick={() => toggle(u)}
                  disabled={u.blocked && !multiple}
                  className="anim-cascade flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-base-content/[0.05] disabled:opacity-50"
                  style={{ "--i": Math.min(i, 10) }}
                >
                  <Avatar src={u.profilePic} name={u.fullName} seed={u._id} size={44} online={u.online} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{u.fullName}</span>
                    <span className="block truncate text-[0.8125rem] text-base-content/55">{u.blocked ? "Blocked" : u.about || u.emailHint}</span>
                  </span>
                  {multiple && (
                    <span className={`flex size-6 items-center justify-center rounded-full border-2 transition ${isSelected(u) ? "border-primary bg-primary text-primary-content" : "border-base-300"}`}>
                      {isSelected(u) && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
