import { AlarmClock, BarChart3, Bookmark, CalendarClock, Languages, MessageSquarePlus, Search, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { LogoMark } from "../ui/Logo";
import { errorMessage } from "../../lib/api";
import { modKey } from "../../lib/platform";
import { useChatStore } from "../../store/useChatStore";
import { useAiEnabled } from "../../store/useConfigStore";
import { useUIStore } from "../../store/useUIStore";

const TIPS = [
  { icon: CalendarClock, title: "Send at their morning", body: "Right-click send to schedule for a time that suits them." },
  { icon: AlarmClock, title: "Remind me", body: "Turn any message into a reminder so nothing slips through." },
  { icon: BarChart3, title: "Polls, GIFs & locations", body: "Tap + in any chat to share more than text." },
  { icon: Languages, title: "Translate and catch up", body: "Read messages in your language and get a summary of what you missed.", ai: true },
];

/** Right-hand pane when no chat is open (tablet/desktop). */
export default function EmptyChat() {
  const ai = useAiEnabled();
  const navigate = useNavigate();
  const open = useUIStore((s) => s.open);

  const openSaved = async () => {
    try {
      const conv = await useChatStore.getState().openSelf();
      navigate(`/chat/${conv._id}`, { viewTransition: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="wallpaper-plain flex flex-1 items-center justify-center overflow-y-auto p-8">
      <div className="anim-fade w-full max-w-lg text-center">
        <div className="mx-auto mb-5 flex size-20 items-center justify-center rounded-[28px] bg-base-100 shadow-soft">
          <LogoMark size={44} />
        </div>
        <h2 className="text-balance text-2xl font-semibold tracking-tight">Select a chat to start messaging</h2>
        <p className="mx-auto mt-2 max-w-sm text-balance text-sm text-base-content/55">
          Or start a new one. Press <kbd className="kbd kbd-sm">{modKey}</kbd> <kbd className="kbd kbd-sm">K</kbd> to search everything.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" className="btn btn-primary h-10 min-h-0 rounded-full px-5" onClick={() => open("newChatOpen")}>
            <MessageSquarePlus className="size-4" /> New chat
          </button>
          <button type="button" className="btn h-10 min-h-0 rounded-full border-base-300 bg-base-100 px-5" onClick={() => open("newGroupOpen")}>
            <Users className="size-4" /> New group
          </button>
          <button type="button" className="btn h-10 min-h-0 rounded-full border-base-300 bg-base-100 px-5" onClick={openSaved}>
            <Bookmark className="size-4" /> Saved messages
          </button>
        </div>
        <ul className="mt-10 grid gap-2 text-left sm:grid-cols-2">
          {TIPS.filter((t) => !t.ai || ai).map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="anim-cascade flex gap-3 rounded-2xl bg-base-100 p-3.5 shadow-sm" style={{ "--i": i + 2 }}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-[18px]" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-[0.8125rem] leading-snug text-base-content/60">{body}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-base-content/40">
          <Search className="size-3.5" /> Search finds chats, people and messages
        </p>
      </div>
    </div>
  );
}
