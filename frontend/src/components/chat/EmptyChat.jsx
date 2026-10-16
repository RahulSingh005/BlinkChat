import { AlarmClock, CalendarClock, Languages, MessageSquarePlus, Users } from "lucide-react";
import { modKey } from "../../lib/platform";
import { useAiEnabled } from "../../store/useConfigStore";
import { useUIStore } from "../../store/useUIStore";

const TIPS = [
  { icon: CalendarClock, title: "Send at their morning", body: "Long-press send to schedule a message for a time that suits them." },
  { icon: AlarmClock, title: "Remind me", body: "Turn any message into a reminder so nothing slips through." },
  { icon: Languages, title: "Translate and catch up", body: "Read messages in your language and get a summary of what you missed.", ai: true },
];

/** Right-hand pane when no chat is open (tablet/desktop). */
export default function EmptyChat() {
  const ai = useAiEnabled();
  const open = useUIStore((s) => s.open);

  return (
    <div className="wallpaper-plain flex flex-1 items-center justify-center p-8">
      <div className="anim-fade w-full max-w-md text-center">
        <h2 className="text-balance text-2xl font-semibold tracking-tight">Pick a chat, or start a new one</h2>
        <p className="mt-2 text-sm text-base-content/55">
          Press <kbd className="kbd kbd-sm">{modKey}</kbd> <kbd className="kbd kbd-sm">K</kbd> to search.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button type="button" className="btn btn-primary h-10 min-h-0 rounded-xl" onClick={() => open("newChatOpen")}>
            <MessageSquarePlus className="size-4" /> New chat
          </button>
          <button type="button" className="btn h-10 min-h-0 rounded-xl" onClick={() => open("newGroupOpen")}>
            <Users className="size-4" /> New group
          </button>
        </div>
        <ul className="mt-10 space-y-2 text-left">
          {TIPS.filter((t) => !t.ai || ai).map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3 rounded-2xl border border-base-300/70 bg-base-100 p-3.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-[18px]" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-[0.8125rem] text-base-content/60">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
