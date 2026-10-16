import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import ChatView from "../components/chat/ChatView";
import ConversationList from "../components/chat/ConversationList";
import EmptyChat from "../components/chat/EmptyChat";
import InfoPanel from "../components/chat/InfoPanel";
import { useIsDesktop, useIsWide } from "../hooks/useMediaQuery";
import { useChatStore } from "../store/useChatStore";
import { useUIStore } from "../store/useUIStore";

/**
 * Phones: one pane at a time (list ⇄ chat, with native-like slide
 * transitions and a working back button). Larger screens: list + chat side
 * by side, and the details panel docked on wide desktops.
 */
export default function ChatPage() {
  const { conversationId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const wide = useIsWide();
  const desktop = useIsDesktop();
  const loaded = useChatStore((s) => s.loaded);
  const exists = useChatStore((s) => Boolean(conversationId && s.conversations[conversationId]));
  const infoOpen = useUIStore((s) => s.infoOpen);

  useEffect(() => {
    if (!conversationId || !loaded) return undefined;
    if (!exists) {
      let cancelled = false;
      useChatStore
        .getState()
        .fetchConversation(conversationId)
        .then((conv) => {
          if (!conv && !cancelled) {
            toast.error("That chat isn't available.");
            navigate("/chat", { replace: true });
          }
        });
      return () => {
        cancelled = true;
      };
    }
    useChatStore.getState().openConversation(conversationId);
    return () => useChatStore.getState().closeConversation();
  }, [conversationId, loaded, exists, navigate]);

  // Close per-chat panels when switching chats.
  useEffect(() => {
    useUIStore.setState({ searchOpen: false });
  }, [conversationId]);

  // Deep links like /chat/:id?message=:messageId (reminders, notifications).
  useEffect(() => {
    const messageId = params.get("message");
    if (!messageId || !conversationId || !exists) return;
    useChatStore.getState().jumpToMessage(conversationId, messageId);
    params.delete("message");
    setParams(params, { replace: true });
  }, [params, setParams, conversationId, exists]);

  if (!wide) {
    return conversationId ? <ChatView key={conversationId} conversationId={conversationId} /> : <ConversationList />;
  }

  return (
    <div className="flex min-w-0 flex-1">
      <aside className="flex w-[340px] shrink-0 border-r border-base-300/70 lg:w-[380px]">
        <ConversationList />
      </aside>
      <section className="relative flex min-w-0 flex-1" style={{ viewTransitionName: "chat-pane" }}>
        {conversationId ? <ChatView key={conversationId} conversationId={conversationId} /> : <EmptyChat />}
      </section>
      {desktop && infoOpen && conversationId && exists && (
        <aside className="anim-drawer flex w-[360px] shrink-0 border-l border-base-300/70">
          <InfoPanel conversationId={conversationId} docked />
        </aside>
      )}
    </div>
  );
}
