import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Bookmark, Lock, MessageSquarePlus, Users } from "lucide-react";
import { LogoMark } from "../ui/Logo";
import { errorMessage } from "../../lib/api";
import { useAuthStore } from "../../store/useAuthStore";
import { useChatStore } from "../../store/useChatStore";
import { useUIStore } from "../../store/useUIStore";

/** Right-hand pane when no chat is open (tablet/desktop). */
export default function EmptyChat() {
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.authUser);
  const open = useUIStore((s) => s.open);

  const openSaved = async () => {
    try {
      const conv = await useChatStore.getState().openSelf();
      navigate(`/chat/${conv._id}`, { viewTransition: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const actions = [
    { label: "New chat", icon: MessageSquarePlus, onClick: () => open("newChatOpen") },
    { label: "New group", icon: Users, onClick: () => open("newGroupOpen") },
    { label: "Saved", icon: Bookmark, onClick: openSaved },
  ];

  return (
    <div className="wallpaper-plain relative flex flex-1 flex-col items-center justify-center overflow-hidden p-8">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-70" />
      <div className="anim-fade relative flex flex-col items-center text-center">
        <LogoMark size={64} />
        <h2 className="mt-5 text-2xl font-semibold tracking-tight">Hi {me?.fullName?.split(" ")[0] || "there"} 👋</h2>
        <p className="mt-1.5 text-sm text-base-content/55">Pick a chat to start messaging.</p>
        <div className="mt-7 flex gap-3">
          {actions.map(({ label, icon: Icon, onClick }, i) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              className="anim-cascade flex w-24 flex-col items-center gap-2 rounded-2xl border border-base-300 bg-base-100 py-4 text-xs font-medium text-base-content/75 transition hover:-translate-y-0.5 hover:border-primary/40 hover:text-base-content"
              style={{ "--i": i + 2 }}
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="absolute bottom-6 flex items-center gap-1.5 text-xs text-base-content/40">
        <Lock className="size-3" /> Messages are encrypted in transit
      </p>
    </div>
  );
}
