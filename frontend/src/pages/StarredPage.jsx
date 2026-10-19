import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Star, StarOff } from "lucide-react";
import PanelHeader from "../components/layout/PanelHeader";
import SplitView, { DetailPlaceholder } from "../components/layout/SplitView";
import Avatar from "../components/ui/Avatar";
import { ConversationSkeleton } from "../components/ui/Skeletons";
import { useIsWide } from "../hooks/useMediaQuery";
import { api, errorMessage } from "../lib/api";
import { firstName, formatListTime } from "../lib/format";
import { previewText } from "../lib/preview";
import { setNavDirection } from "../lib/transitions";
import { useAuthStore } from "../store/useAuthStore";
import { conversationTitle, peerOf, useChatStore } from "../store/useChatStore";

function StarredList() {
  const me = useAuthStore((s) => s.authUser);
  const conversations = useChatStore((s) => s.conversations);
  const navigate = useNavigate();
  const wide = useIsWide();
  const [params] = useSearchParams();
  const only = params.get("chat");
  const [state, setState] = useState({ items: null, hasMore: false, loading: false });

  const load = useCallback(async (before) => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await api.get("/messages/starred", { params: { limit: 50, ...(before ? { before } : {}) } });
      setState((s) => ({ items: [...(before ? s.items || [] : []), ...res.data.messages], hasMore: res.data.hasMore, loading: false }));
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't load starred messages"));
      setState((s) => ({ ...s, items: s.items || [], loading: false }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const items = (state.items || []).filter((m) => !only || m.conversation === only);
  const onlyConv = only ? conversations[only] : null;

  const open = (m) => {
    if (!wide) setNavDirection("forward");
    navigate(`/chat/${m.conversation}?message=${m._id}`, { viewTransition: true });
  };

  const unstar = async (m) => {
    setState((s) => ({ ...s, items: s.items.filter((x) => x._id !== m._id) }));
    await useChatStore.getState().star(m, false);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-base-100">
      <PanelHeader
        title="Starred messages"
        subtitle={onlyConv ? `In ${conversationTitle(onlyConv, me._id)}` : undefined}
        onBack={() => {
          if (!wide) setNavDirection("back");
          navigate(only ? `/chat/${only}` : "/chat", { viewTransition: true });
        }}
        backLabel={only ? "Back to chat" : "Back to chats"}
      />
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-6"
        onScroll={(e) => {
          const el = e.currentTarget;
          if (state.hasMore && !state.loading && el.scrollHeight - el.scrollTop - el.clientHeight < 300) load(state.items.at(-1)?.createdAt);
        }}
      >
        {state.items === null ? (
          <ConversationSkeleton rows={5} />
        ) : items.length === 0 ? (
          <div className="anim-fade mx-auto max-w-xs px-4 py-14 text-center">
            <span className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-base-200 text-base-content/45">
              <Star className="size-6" />
            </span>
            <p className="font-semibold">No starred messages</p>
            <p className="mt-1 text-sm text-base-content/55">Star important messages from the message menu to find them here quickly.</p>
          </div>
        ) : (
          items.map((m, i) => {
            const conv = conversations[m.conversation];
            const title = conv ? conversationTitle(conv, me._id) : "Chat";
            const sender = m.sender === me._id ? "You" : firstName(conv?.members.find((x) => x.user._id === m.sender)?.user.fullName || "Someone");
            const peer = conv ? peerOf(conv, me._id) : null;
            return (
              <div key={m._id} className="anim-cascade group flex items-start gap-3 rounded-xl px-2 py-2.5 transition hover:bg-base-content/[0.04]" style={{ "--i": Math.min(i, 12) }}>
                <button type="button" onClick={() => open(m)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                  <Avatar
                    src={conv?.type === "group" ? conv.avatar : peer?.profilePic}
                    name={title}
                    seed={conv?.type === "group" ? conv._id : peer?._id}
                    group={conv?.type === "group"}
                    self={conv?.type === "self"}
                    size={42}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {sender} <span className="font-normal text-base-content/45">in</span> {title}
                      </span>
                      <span className="shrink-0 text-xs text-base-content/45">{formatListTime(m.createdAt)}</span>
                    </span>
                    <span className="mt-1 line-clamp-3 rounded-xl bg-base-200/70 px-3 py-2 text-[0.875rem] text-base-content/80">{previewText(m, { conv, meId: me._id }) || "Message"}</span>
                  </span>
                </button>
                <button type="button" onClick={() => unstar(m)} className="icon-btn icon-btn-sm mt-6 opacity-60 hover:opacity-100" aria-label="Unstar" title="Unstar">
                  <StarOff className="size-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function StarredPage() {
  return (
    <SplitView
      list={<StarredList />}
      detail={<DetailPlaceholder icon={Star} title="Your important messages" body="Tap a starred message to jump straight to it in its chat." />}
    />
  );
}
